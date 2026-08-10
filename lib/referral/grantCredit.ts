/**
 * REFERRAL ÖDÜL — davet eden kişiye 1 ay Pro kredisi + erken erişim
 * sayacı. Davet edilen kullanıcının İLK başarılı ödemesinde (NOWPayments
 * webhook VEYA Google Play verify-google, ikisi de çağırır) tetiklenir.
 *
 * Kredi, nowpayments_subscriptions.current_period_end'i uzatarak verilir
 * — YENİ bir tablo/cron açmak yerine mevcut günlük süre-dolum kontrolünü
 * (lib/billing/subscriptionCheck.ts) aynen tekrar kullanır. source='referral_credit'
 * ile gerçek ödemelerden ayrı loglanır (migration 022).
 *
 * paid_referral_count 3'e ulaşınca `earlyAccessGranted` Clerk flag'i
 * set edilir — NOT: bu flag'i şu an tüketen (kontrol eden) bir feature
 * yok, sadece işaretleniyor. "X otomasyonuna erken erişim" fikri
 * incelendiğinde X paylaşımının kullanıcı bazlı değil, tek bir admin
 * cron mekanizması olduğu görüldü — per-user bir kapı noktası yok. Bu
 * flag'in neyi açacağı (yeni bir özellik mi, mevcut bir Pro özelliğinin
 * erken sunumu mu) ayrı bir ürün kararı gerektiriyor, burada sadece
 * altyapı (sayaç + flag) hazırlandı.
 */

import { dbUpsert } from "@/lib/db/server";
import { getNowPaymentsSubscription } from "@/lib/db/nowpayments";
import {
  getOrCreateUserReferral,
  getUserReferral,
  markCreditGranted,
  incrementPaidReferralCount,
  type UserReferralRow,
} from "@/lib/db/userReferrals";
import { patchClerkPublicMetadata, findClerkUserEmailById } from "@/lib/clerk/metadata";

const CREDIT_DAYS = 30;
const EARLY_ACCESS_THRESHOLD = 3;

interface NowPaymentsSubscriptionUpsert {
  user_id: string;
  plan: "pro";
  status: "active";
  current_period_end: string;
  source: "referral_credit";
}

/**
 * @param referredUserId Az önce ilk kez başarılı ödeme yapan kullanıcı.
 * Bu kullanıcının kendi user_referrals satırında referred_by doluysa VE
 * credit_granted henüz false ise, referred_by'ın sahibine kredi verilir.
 * Aksi halde (referred_by yok, ya da bu zaten bir yenileme ödemesi) no-op.
 */
export async function grantReferralCreditIfEligible(referredUserId: string): Promise<void> {
  // Ödeyen kişi hiç /ayarlar'a uğramadan doğrudan /upgrade'e gidip
  // ödemiş olabilir — bu durumda user_referrals satırı henüz yok. Burada
  // tembel oluşturuyoruz (aynı getOrCreateUserReferral, ReferralCard'ın
  // kullandığıyla birebir aynı fonksiyon) — email lazım, Clerk'ten okunur.
  let referredRow = await getUserReferral(referredUserId);
  if (!referredRow) {
    const email = await findClerkUserEmailById(referredUserId);
    referredRow = await getOrCreateUserReferral(referredUserId, email);
  }
  if (!referredRow || !referredRow.referred_by || referredRow.credit_granted) return;

  const { findUserIdByReferralCode } = await import("@/lib/db/userReferrals");
  const referrerUserId = await findUserIdByReferralCode(referredRow.referred_by);
  if (!referrerUserId) return; // kod artık geçersiz/silinmiş olabilir — sessizce atla

  // credit_granted'ı ÖNCE işaretle (kredi verme başarısız olsa bile bir
  // daha denenmesin — tekrar denemek istersek elle credit_granted=false
  // yapılabilir, ama sessiz sonsuz retry riski daha kötü).
  await markCreditGranted(referredUserId);

  const existing = await getNowPaymentsSubscription(referrerUserId);
  const base = existing?.current_period_end ? new Date(existing.current_period_end) : new Date();
  const start = base.getTime() > Date.now() ? base : new Date();
  const newPeriodEnd = new Date(start.getTime() + CREDIT_DAYS * 24 * 60 * 60_000).toISOString();

  const row: NowPaymentsSubscriptionUpsert = {
    user_id: referrerUserId,
    plan: "pro",
    status: "active",
    current_period_end: newPeriodEnd,
    source: "referral_credit",
  };
  await dbUpsert("nowpayments_subscriptions", row, "user_id");
  await patchClerkPublicMetadata(referrerUserId, { plan: "pro" });

  const count = await incrementPaidReferralCount(referrerUserId);
  if (count === EARLY_ACCESS_THRESHOLD) {
    await patchClerkPublicMetadata(referrerUserId, { earlyAccessGranted: true });
  }
}

export type { UserReferralRow };
