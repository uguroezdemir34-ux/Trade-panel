/**
 * US MARKET HOLIDAYS — NYSE 2026 takvimi.
 *
 * lib/score/macroScore.ts'in isUSMarketOpen() fonksiyonu için referans veri.
 * Sadece 2026 kapsıyor — yıl değişince manuel güncellenmeli (yeni yıl listesi
 * eklenip isUSMarketHoliday/isUSMarketHalfDay ilgili yılın listesine bakacak
 * şekilde genişletilmeli).
 */

/** NYSE'nin tam kapalı olduğu günler (2026, ET tarihi). */
export const NYSE_HOLIDAYS_2026: readonly string[] = [
  "2026-01-01", // Yılbaşı
  "2026-01-19", // Martin Luther King Jr. Günü
  "2026-02-16", // Washington's Birthday (Presidents' Day)
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Bağımsızlık Günü (4 Temmuz Cumartesi'ye denk geldiği için gözlemlenen tarih)
  "2026-09-07", // İşçi Bayramı (Labor Day)
  "2026-11-26", // Şükran Günü
  "2026-12-25", // Noel
];

/** NYSE'nin 13:00 ET'de erken kapandığı günler (2026, ET tarihi). */
export const NYSE_HALF_DAYS_2026: readonly string[] = [
  "2026-11-27", // Şükran Günü sonrası (Black Friday)
  "2026-12-24", // Noel arifesi
];

/** dateStr formatı: "YYYY-MM-DD" (ET tarihi — bkz. macroScore.ts getETDateString). */
export function isUSMarketHoliday(dateStr: string): boolean {
  return NYSE_HOLIDAYS_2026.includes(dateStr);
}

/** dateStr formatı: "YYYY-MM-DD" (ET tarihi — bkz. macroScore.ts getETDateString). */
export function isUSMarketHalfDay(dateStr: string): boolean {
  return NYSE_HALF_DAYS_2026.includes(dateStr);
}
