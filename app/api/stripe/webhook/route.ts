import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { dbSelect, dbUpsert, isDbConfigured } from "@/lib/db/server";
import { patchClerkPublicMetadata } from "@/lib/clerk/metadata";
import { getVipInviteLink, saveVipInviteLink } from "@/lib/db/vipInvites";
import { createVipInviteLink } from "@/lib/notify/telegram/vipInvite";

// Stripe sends raw body — disable Next.js body parsing
export const runtime = "nodejs";

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: { userId?: string };
      subscription?: string;
      /** customer.subscription.* event'lerinde dolu — Stripe Subscription.status */
      status?: string;
      /** checkout.session.completed'de dolu — Stripe Customer ID */
      customer?: string;
    };
  };
}

/** Stripe subscription durumları → hangi Clerk plan'ına eşleniyor. */
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=")),
  ) as Record<string, string>;
  const { t, v1 } = parts;
  if (!t || !v1) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

async function setClerkPlan(userId: string, plan: "pro" | "free"): Promise<void> {
  await patchClerkPublicMetadata(userId, { plan });
}

/**
 * Pro'ya ilk geçişte VIP Telegram grubuna tek kullanımlık davet linki
 * üretir — bkz. lib/notify/telegram/vipInvite.ts dosya başı yorumu (kapsam,
 * env var ayrımı, member_limit=1 gerekçesi). Idempotent: link zaten varsa
 * (aynı kullanıcı için ikinci kez tetiklenen event) yeniden ÜRETİLMEZ.
 *
 * BEST-EFFORT — hiçbir hatayı fırlatmaz. TELEGRAM_VIP_COMMUNITY_CHAT_ID
 * tanımsızsa (henüz kurulmadıysa) sessizce atlanır; bu webhook'un asıl işi
 * (plan'ı pro'ya çekmek) bu adımdan asla etkilenmemeli — Stripe'a 500
 * dönüp event'i sonsuza dek retry ettirmenin bedeli, kullanıcının Pro
 * erişimini kaybetmesinden çok daha ağır.
 */
async function ensureVipInviteLink(userId: string): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    const existing = await getVipInviteLink(userId);
    if (existing) return;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_VIP_COMMUNITY_CHAT_ID;
    if (!botToken || !chatId) {
      console.warn("[stripe webhook] TELEGRAM_VIP_COMMUNITY_CHAT_ID/TELEGRAM_BOT_TOKEN eksik — VIP davet linki atlandı.");
      return;
    }

    const result = await createVipInviteLink({ botToken, chatId });
    if (!result.ok || !result.inviteLink) {
      console.warn("[stripe webhook] VIP davet linki üretilemedi:", result.errorMessage);
      Sentry.captureMessage("VIP Telegram davet linki üretilemedi", {
        level: "warning",
        extra: { userId, errorMessage: result.errorMessage },
      });
      return;
    }

    await saveVipInviteLink(userId, result.inviteLink);
  } catch (err) {
    console.error("[stripe webhook] ensureVipInviteLink başarısız:", err);
    Sentry.captureMessage("ensureVipInviteLink hata fırlattı", {
      level: "warning",
      extra: { userId, err: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * invoice.payment_failed event'inin Invoice objesinde metadata doğrudan
 * yok — sahibini bulmak için ilişkili Subscription'ı REST ile çekiyoruz
 * (subscription oluşturulurken metadata.userId orada set edilmişti, bkz.
 * app/api/stripe/checkout/route.ts → subscription_data[metadata][userId]).
 */
async function getSubscriptionUserId(subscriptionId: string, stripeKey: string): Promise<string | null> {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${stripeKey}:`).toString("base64")}` },
  });
  if (!res.ok) return null;
  const sub = (await res.json()) as { metadata?: { userId?: string } };
  return sub.metadata?.userId ?? null;
}

/**
 * IDEMPOTENCY — Stripe aynı event'i birden fazla kez teslim edebilir (ağ
 * hatası, retry). event.id'yi stripe_events tablosunda işaretleyip ikinci
 * teslimatı atlıyoruz. Supabase yapılandırılmamışsa kontrol sessizce
 * atlanır — best-effort bir koruma, hard bir bağımlılık değil.
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const rows = await dbSelect<{ event_id: string }>(
      "stripe_events",
      `event_id=eq.${eventId}&select=event_id`,
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[stripe webhook] idempotency kontrolü başarısız, işleniyor gibi devam:", err);
    return false;
  }
}

async function markProcessed(eventId: string, eventType: string): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await dbUpsert("stripe_events", { event_id: eventId, event_type: eventType });
  } catch (err) {
    console.error("[stripe webhook] idempotency kaydı yazılamadı:", err);
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as StripeEvent;

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = event.data.object.metadata?.userId;
        const customerId = event.data.object.customer;
        if (userId) {
          await patchClerkPublicMetadata(userId, {
            plan: "pro",
            ...(customerId ? { stripeCustomerId: customerId } : {}),
          });
          await ensureVipInviteLink(userId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        // Subscription canceled — downgrade to free
        const userId = event.data.object.metadata?.userId;
        if (userId) await setClerkPlan(userId, "free");
        break;
      }
      case "customer.subscription.updated": {
        // Trial → active, past_due, unpaid, paused vb. durum geçişleri.
        // active/trialing → pro; her şey diğer her şey (past_due/unpaid/
        // canceled/incomplete_expired/paused) → free. checkout.session.completed
        // ile YARIŞ RİSKİ YOK — ikisi de aynı sonuca (pro) yazıyor, idempotent.
        const userId = event.data.object.metadata?.userId;
        const status = event.data.object.status;
        if (userId && status) {
          const plan = ACTIVE_SUBSCRIPTION_STATUSES.has(status) ? "pro" : "free";
          await setClerkPlan(userId, plan);
          if (plan === "pro") await ensureVipInviteLink(userId);
        }
        break;
      }
      case "invoice.payment_failed": {
        // Kart reddi / başarısız yenileme — kullanıcıyı hemen free'ye çek.
        // Stripe kendi Smart Retries döngüsünü ayrıca çalıştırır; ödeme
        // sonradan başarılı olursa customer.subscription.updated (status:
        // active) planı zaten pro'ya geri yazar — burada kalıcı bir "ban"
        // yok, sadece ödeme düzelene kadar kısıtlı erişim.
        const subscriptionId = event.data.object.subscription;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (subscriptionId && stripeKey) {
          const userId = await getSubscriptionUserId(subscriptionId, stripeKey);
          if (userId) await setClerkPlan(userId, "free");
        }
        break;
      }
      default:
        // Unhandled event types — acknowledge and move on
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  await markProcessed(event.id, event.type);
  return NextResponse.json({ received: true });
}
