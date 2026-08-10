/**
 * USER REFERRALS DB HELPER — server-only.
 *
 * user_referrals (migration 021), waitlist'ten (007) BAĞIMSIZ, Clerk
 * userId'ye bağlı. getOrCreateUserReferral() TEMBEL (lazy) oluşturma
 * yapar — mevcut waitlist kullanıcıları için YENİ kod üretmez, waitlist
 * satırı varsa hem referral_code'unu HEM referred_by'ını aynen kopyalar
 * (referred_by kopyalanmazsa referral zinciri hiç kurulamaz — beta
 * kapısı hâlâ aktif olduğu için tüm gerçek kullanıcılar bu yoldan geçer,
 * bkz. migration 021 dosya başı yorumu). Waitlist satırı yoksa (ör.
 * hesap admin tarafından doğrudan açıldı) yeni bir kod üretir,
 * referred_by null kalır.
 */

import { dbSelect, dbUpsert, dbUpdate, isDbConfigured } from "./server";

export interface UserReferralRow {
  user_id: string;
  referral_code: string;
  referred_by: string | null;
  credit_granted: boolean;
  paid_referral_count: number;
  created_at: string;
}

function generateReferralCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** @returns null sadece Supabase yapılandırılmamışsa — aksi halde her zaman bir satır döner (yoksa oluşturur). */
export async function getOrCreateUserReferral(
  userId: string,
  email: string | null,
): Promise<UserReferralRow | null> {
  if (!isDbConfigured()) return null;

  const existing = await dbSelect<UserReferralRow>("user_referrals", `user_id=eq.${encodeURIComponent(userId)}`);
  if (existing.length > 0) return existing[0];

  let code: string | null = null;
  let referredBy: string | null = null;
  if (email) {
    const waitlistRows = await dbSelect<{ referral_code: string; referred_by: string | null }>(
      "waitlist",
      `email=eq.${encodeURIComponent(email.toLowerCase())}&select=referral_code,referred_by`,
    );
    if (waitlistRows.length > 0) {
      code = waitlistRows[0].referral_code;
      referredBy = waitlistRows[0].referred_by;
    }
  }
  if (!code) code = generateReferralCode();

  await dbUpsert("user_referrals", { user_id: userId, referral_code: code, referred_by: referredBy }, "user_id");

  const inserted = await dbSelect<UserReferralRow>("user_referrals", `user_id=eq.${encodeURIComponent(userId)}`);
  return inserted[0] ?? null;
}

/** Bir referral kodunun sahibinin userId'sini döner — kredi verirken/checkout indiriminde kullanılır. */
export async function findUserIdByReferralCode(code: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const rows = await dbSelect<{ user_id: string }>(
    "user_referrals",
    `referral_code=eq.${encodeURIComponent(code.trim().toUpperCase())}&select=user_id`,
  );
  return rows[0]?.user_id ?? null;
}

/**
 * Bir kullanıcının kendi satırını okur (var olduğu varsayılır — ödeme
 * webhook'ları çağırmadan önce zaten getOrCreateUserReferral ile
 * oluşturulmuş olmalı, ama satır yine de yoksa null döner — çağıran
 * taraf bu durumda krediyi atlar, hata fırlatmaz).
 */
export async function getUserReferral(userId: string): Promise<UserReferralRow | null> {
  if (!isDbConfigured()) return null;
  const rows = await dbSelect<UserReferralRow>("user_referrals", `user_id=eq.${encodeURIComponent(userId)}`);
  return rows[0] ?? null;
}

/** İlk başarılı ödeme sonrası çağrılır — bir daha tetiklenmesin diye flag'i kalıcı olarak true yapar. */
export async function markCreditGranted(referredUserId: string): Promise<void> {
  if (!isDbConfigured()) return;
  await dbUpdate<UserReferralRow>(
    "user_referrals",
    { credit_granted: true },
    `user_id=eq.${encodeURIComponent(referredUserId)}`,
  );
}

/** Referrer'ın ödeme yapan davet sayacını 1 artırır — erken erişim viralite eşiği için. */
export async function incrementPaidReferralCount(referrerUserId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = await getUserReferral(referrerUserId);
  const next = (row?.paid_referral_count ?? 0) + 1;
  await dbUpdate<UserReferralRow>(
    "user_referrals",
    { paid_referral_count: next },
    `user_id=eq.${encodeURIComponent(referrerUserId)}`,
  );
  return next;
}
