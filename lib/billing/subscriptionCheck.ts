/**
 * ABONELIK SÜRESİ KONTROLÜ — sadece süresi dolmuş NOWPayments aboneliklerini
 * free'ye düşürür (uzatma/yükseltme ASLA burada yapılmaz, o yalnızca
 * doğrulanmış IPN webhook'u ile olur — bkz. lib/db/nowpayments.ts).
 *
 * Günlük kadans yeterli (billing period gün mertebesinde, saatlik hassasiyet
 * gerekmiyor) — Vercel Hobby 2-cron limiti nedeniyle ayrı bir cron açmak
 * yerine mevcut /api/cron/daily-summary'ye İZOLE bir adım olarak eklendi:
 * bu fonksiyonun hata fırlatması günlük Telegram özetini etkilememeli,
 * ve tersi de geçerli — bu yüzden çağıran taraf (route.ts) kendi try/catch'i
 * içinde, ayrı olarak çağırmalı.
 */

import { getExpiredActiveSubscriptions, markSubscriptionExpired } from "@/lib/db/nowpayments";
import { patchClerkPublicMetadata } from "@/lib/clerk/metadata";

export interface SubscriptionCheckResult {
  checked: number;
  downgraded: number;
  errors: number;
}

export async function checkExpiredNowPaymentsSubscriptions(): Promise<SubscriptionCheckResult> {
  const expired = await getExpiredActiveSubscriptions();
  let downgraded = 0;
  let errors = 0;

  for (const sub of expired) {
    try {
      await markSubscriptionExpired(sub.user_id);
      await patchClerkPublicMetadata(sub.user_id, { plan: "free" });
      downgraded++;
    } catch (err) {
      // Tek kullanıcının hatası diğerlerini durdurmaz — devam et.
      console.error(`[subscription-check] ${sub.user_id} düşürülemedi:`, err);
      errors++;
    }
  }

  return { checked: expired.length, downgraded, errors };
}
