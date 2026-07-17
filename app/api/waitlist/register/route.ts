/**
 * POST /api/waitlist/register — kapalı beta waitlist kaydı.
 *
 * Auth GEREKTİRMEZ (bkz. middleware.ts isPublicRoute) — kullanıcı henüz
 * Clerk hesabı açmadan, WaitlistScreen'den doğrudan çağrılır.
 *
 * Aynı email tekrar gönderilirse hata DÖNMEZ — mevcut kaydın pozisyonunu
 * geri döner (idempotent, "Şu email zaten kayıtlı" gibi bir hata yerine
 * kullanıcı deneyimi için daha doğru: sayfayı yenileyip tekrar
 * gönderirse aynı sıra numarasını görmeli).
 *
 * REFERRAL OTOMATİK ONAY — "Invite 3 friends to skip the queue" vaadinin
 * gerçek karşılığı: yeni bir kayıt `referred_by` ile geliyorsa, o kodu
 * üreten kişinin kaç kişiyi davet ettiği sayılır; 3'e ulaşınca davet eden
 * kişi otomatik onaylanır (bkz. lib/waitlist/approve.ts — hesabı zaten
 * varsa Clerk betaAccess'i anında set edilir, yoksa hesap açtığında
 * middleware.ts'teki fallback senkronize eder).
 */

import { NextRequest, NextResponse } from "next/server";
import { dbSelect, dbUpsert, isDbConfigured } from "@/lib/db/server";
import { approveWaitlistEmail } from "@/lib/waitlist/approve";

const REFERRALS_TO_SKIP_QUEUE = 3;

interface WaitlistRow {
  id: number;
  referral_code: string;
  status: string;
}

function generateReferralCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * `referralCode`'u üreten kişinin kaç kişiyi davet ettiğini sayar;
 * REFERRALS_TO_SKIP_QUEUE'a ulaştıysa o kişiyi otomatik onaylar. Onay
 * başarısız olsa bile (network vb.) bu, YENİ kaydın kendi başarılı
 * dönüşünü ENGELLEMEMELİ — bu yüzden hata burada yutulur, sadece loglanır.
 */
async function maybeAutoApproveReferrer(referralCode: string): Promise<void> {
  try {
    const referrer = await dbSelect<{ email: string }>(
      "waitlist",
      `referral_code=eq.${encodeURIComponent(referralCode)}&select=email`,
    );
    if (referrer.length === 0) return;

    const referredCount = await dbSelect<{ id: number }>(
      "waitlist",
      `referred_by=eq.${encodeURIComponent(referralCode)}&select=id`,
    );
    if (referredCount.length < REFERRALS_TO_SKIP_QUEUE) return;

    await approveWaitlistEmail(referrer[0].email);
  } catch (err) {
    console.error("[/api/waitlist/register] referral auto-approve başarısız:", err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Waitlist not configured" }, { status: 503 });
  }

  let body: { email?: string; referredBy?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    const existing = await dbSelect<WaitlistRow>(
      "waitlist",
      `email=eq.${encodeURIComponent(email)}&select=id,referral_code,status`,
    );
    if (existing.length > 0) {
      const row = existing[0];
      return NextResponse.json({
        position: row.id,
        referralCode: row.referral_code,
        status: row.status,
        alreadyRegistered: true,
      });
    }

    const referralCode = generateReferralCode();
    const referredBy = body.referredBy?.trim().toUpperCase() || null;
    await dbUpsert(
      "waitlist",
      {
        email,
        referral_code: referralCode,
        referred_by: referredBy,
        status: "waiting",
      },
      "email",
    );

    const inserted = await dbSelect<WaitlistRow>(
      "waitlist",
      `email=eq.${encodeURIComponent(email)}&select=id,referral_code,status`,
    );
    const row = inserted[0];
    if (!row) throw new Error("Insert succeeded but row not found");

    if (referredBy) {
      await maybeAutoApproveReferrer(referredBy);
    }

    return NextResponse.json({
      position: row.id,
      referralCode: row.referral_code,
      status: row.status,
      alreadyRegistered: false,
    });
  } catch (err) {
    console.error("[/api/waitlist/register]", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
