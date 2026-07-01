/**
 * POC — Point of Control (Kontrol Noktası)
 *
 * Son N barlık 1H mum serisinden hacim profili oluşturur ve en fazla
 * işlem yapılan fiyat seviyesini (POC) hesaplar.
 *
 * Her mumun hacmi High-Low aralığına eşit dağıtılır (basit yaklaşım).
 * 200 bucket × fiyat aralığı → max hacim bucket'ı = POC.
 *
 * Kullanım:
 *   - Fiyat < POC + LONG  → POC direnç görevi görür  → soft block
 *   - Fiyat > POC + SHORT → POC destek görevi görür  → soft block
 *   - Fiyat POC'u hacimli kırıyorsa bu koşullar geçersizdir
 *     (sweep detection + volRatio ile kombine edilmeli)
 */

import type { Candle } from "@/types/candle";

export interface PocResult {
  /** Kontrol noktası fiyatı — en yoğun hacim seviyesi */
  poc: number;
  /** Mevcut fiyat POC'un üstünde mi */
  abovePoc: boolean;
  /** Mesafe yüzdesi: (currentPrice - poc) / poc × 100 */
  distancePct: number;
  /** POC güç oranı: POC bucket hacmi / toplam hacim (0-1) */
  pocStrength: number;
}

const BUCKETS = 200;
const PERIOD_BARS = 168; // 7 gün × 24 saat

export function computePoc(
  candles: readonly Candle[],
  currentPrice: number,
  periodBars = PERIOD_BARS,
): PocResult | null {
  if (!currentPrice || currentPrice <= 0) return null;
  const bars = candles.slice(-periodBars);
  if (bars.length < 24) return null; // minimum 1 gün

  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (const b of bars) {
    if (b.h > rangeHigh) rangeHigh = b.h;
    if (b.l < rangeLow) rangeLow = b.l;
  }
  if (rangeHigh <= rangeLow || !isFinite(rangeHigh) || !isFinite(rangeLow)) return null;

  const bucketSize = (rangeHigh - rangeLow) / BUCKETS;
  const vol = new Float64Array(BUCKETS);

  for (const bar of bars) {
    if (bar.v <= 0 || bar.h <= bar.l) continue;
    const startB = Math.max(0, Math.floor((bar.l - rangeLow) / bucketSize));
    const endB   = Math.min(BUCKETS - 1, Math.floor((bar.h - rangeLow) / bucketSize));
    const count  = endB - startB + 1;
    const vpb    = bar.v / count;
    for (let b = startB; b <= endB; b++) vol[b] += vpb;
  }

  let maxVol = 0;
  let maxBucket = 0;
  let totalVol = 0;
  for (let i = 0; i < BUCKETS; i++) {
    totalVol += vol[i];
    if (vol[i] > maxVol) { maxVol = vol[i]; maxBucket = i; }
  }

  const poc = rangeLow + (maxBucket + 0.5) * bucketSize;
  const pocStrength = totalVol > 0 ? maxVol / totalVol : 0;
  const distancePct = ((currentPrice - poc) / poc) * 100;

  return {
    poc,
    abovePoc: distancePct > 0,
    distancePct,
    pocStrength,
  };
}
