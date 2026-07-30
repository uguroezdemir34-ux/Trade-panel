/**
 * GET /api/admin/overview — Clerk kullanıcı listesi: email, kayıt tarihi,
 * son giriş tarihi, ödeme durumu. Admin-only (bkz. lib/auth/admin.ts).
 *
 * ÖDEME DURUMU KAYNAĞI — BİLEREK stripe_events DEĞİL: o tablo (bkz.
 * supabase/migrations/005_create_stripe_events.sql) sadece webhook
 * idempotency ledger'ı — event_id/event_type/processed_at, hiçbir
 * kullanıcı/customer referansı yok, buradan "aktif/pasif" TÜRETİLEMEZ.
 * Gerçek güncel ödeme durumu zaten app/api/stripe/webhook/route.ts
 * tarafından her Stripe event'inde Clerk publicMetadata.plan alanına
 * yazılıyor ("pro"/"enterprise" → aktif, "free"/yok → pasif) — bu route
 * SubscriptionGate.tsx/lib/auth/subscription.ts ile AYNI kaynağı okuyor,
 * ayrı bir doğruluk kaynağı icat etmiyor.
 *
 * Clerk Backend API list-users endpoint'i (GET /v1/users) — email/
 * created_at/public_metadata alan adları middleware.ts'teki
 * fetchClerkUserInfo() (tek kullanıcı GET /v1/users/{id}) ile birebir
 * aynı şekil, orada zaten doğrulanmış. last_sign_in_at alanı bu kod
 * tabanında BAŞKA HİÇBİR YERDE kullanılmıyor — Clerk'in dokümante ettiği
 * alan adı bu, ama bu sandbox'ta CLERK_SECRET_KEY/ağ erişimi olmadığı
 * için canlı bir response'a karşı doğrulanamadı (CLAUDE.md §0.1 madde 2).
 *
 * limit=500 — Clerk'in list-users endpoint'inde izin verilen üst sınır,
 * sayfalama (offset) YOK. Kapalı beta ölçeğinde (şu an ~10 kişilik ilk
 * dalga) yeterli; kullanıcı sayısı 500'ü geçerse bu route eksik liste
 * döner — sessizce değil, ileride görünür bir "daha fazla var" uyarısı
 * gerekecek, şimdilik kapsam dışı bırakıldı.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { isAdminUserId } from "@/lib/auth/admin";

const CLERK_USERS_LIMIT = 500;

interface ClerkUserListItem {
  id: string;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  created_at?: number;
  last_sign_in_at?: number | null;
  public_metadata?: { plan?: string };
}

interface OverviewRow {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  paymentStatus: "active" | "inactive";
}

function primaryEmail(user: ClerkUserListItem): string {
  const primary = user.email_addresses?.find(
    (e) => e.id === user.primary_email_address_id,
  );
  return primary?.email_address ?? user.email_addresses?.[0]?.email_address ?? "—";
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) {
    return NextResponse.json({ error: "CLERK_SECRET_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${CLERK_USERS_LIMIT}&order_by=-created_at`,
      { headers: { Authorization: `Bearer ${clerkKey}` } },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Clerk list-users failed (${res.status}): ${err}`);
    }
    const json = (await res.json()) as unknown;
    // Clerk'in list-users endpoint'i düz dizi de dönebilir, {data:[...]} da —
    // lib/clerk/metadata.ts'teki findClerkUserIdByEmail ile aynı toleranslı okuma.
    const users = Array.isArray(json)
      ? (json as ClerkUserListItem[])
      : ((json as { data?: ClerkUserListItem[] })?.data ?? []);

    const rows: OverviewRow[] = users.map((u) => ({
      id: u.id,
      email: primaryEmail(u),
      createdAt: u.created_at ? new Date(u.created_at).toISOString() : null,
      lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
      paymentStatus:
        u.public_metadata?.plan === "pro" || u.public_metadata?.plan === "enterprise"
          ? "active"
          : "inactive",
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/admin/overview]", err);
    return NextResponse.json({ error: "Clerk fetch failed" }, { status: 500 });
  }
}
