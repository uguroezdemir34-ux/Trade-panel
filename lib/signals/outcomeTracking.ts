/**
 * GO SİNYAL OUTCOME EŞİĞİ — client (useGoSignalOutcomeTracker.ts) ve
 * sunucu (app/api/cron/signal-check/route.ts) tarafında AYNI "adverse"
 * tanımını kullanmak için paylaşılan tek kaynak. Pencere genişlikleri
 * (15-20dk vs 15-75dk gibi) kasıtlı olarak PAYLAŞILMAZ — client 30sn'de
 * bir çalışıp dar bir pencere yakalayabiliyor, sunucu saatte bir çalıştığı
 * için (2-cron Hobby plan limiti nedeniyle ayrı bir cron eklenmedi) çok
 * daha geniş bir tolerans penceresi kullanır. Sadece "ne kadarlık ters
 * hareket adverse sayılır" sorusunun cevabı ortak.
 *
 * lib/score/'a dokunmaz — skor hesaplamasını etkilemez, sadece sinyal
 * SONRASI fiyat hareketini sınıflandırır.
 */

/** Sinyal yönünün tersine bu yüzdeden fazla hareket = adverse */
export const ADVERSE_THRESHOLD_PCT = 0.5;

/**
 * Yön bazlı hareket yüzdesini hesaplar — LONG için pozitif hareket iyi,
 * SHORT için negatif hareket iyi (movePctDir > 0 = sinyal yönünde).
 */
export function directionalMovePct(
  triggerPrice: number,
  currentPrice: number,
  direction: "LONG" | "SHORT" | string,
): number {
  const movePct = ((currentPrice - triggerPrice) / triggerPrice) * 100;
  return direction === "LONG" ? movePct : -movePct;
}

export function isAdverseMove(movePctDir: number): boolean {
  return movePctDir < -ADVERSE_THRESHOLD_PCT;
}
