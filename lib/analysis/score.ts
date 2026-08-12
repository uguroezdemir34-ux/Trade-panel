/**
 * AI SKOR — kural tabanlı, kalibre edilmemiş yön eğilimi skoru.
 *
 * lib/score/* (skor motoru) DEĞİL — ayrı, deneysel bir "AI senaryo" özelliği
 * için. Kendi EMA/RSI hesaplamasını YAZMIYOR, lib/indicators/'daki mevcut
 * saf fonksiyonları kullanıyor (ema.ts, rsi.ts) — MACD ve Bollinger Bands
 * BİLİNÇLİ OLARAK kullanılmıyor: skor motoru da MACD kullanmıyor (aynı
 * disiplin, ikinci bir kaynak açılmıyor), BB ise bu skorun 3 bileşenli
 * (trendAlignment/rsiPosition/srProximity) tasarımına dahil edilmedi —
 * onaylanan arayüzde bir bbPosition alanı yok.
 *
 * KOPYA — lib/sr/detect.ts calcPenalty() ile senkron tutulmalı: srProximity
 * bant eşikleri (%0.5/%1.5/%2.5) calcPenalty ile AYNI, ölçek 8/20=0.4x
 * küçültülmüş (srProximity max ±8, calcPenalty max ±20). BİLEREK EKSİK
 * bırakılan kısım: calcPenalty'nin strength çarpanı (×0.5/1.0/1.5) burada
 * YOK, sadece mesafe bandı kopyalandı (basitleştirme önerildi, kullanıcı onayı bekleniyor).
 * Bu bir kod bağımlılığı DEĞİL (lib/score/*'a hiçbir import yok, Kural 0
 * kapsamı dışında kalsın diye) — yani lib/sr/detect.ts'teki calcPenalty
 * ileride değişirse bu kopya OTOMATİK GÜNCELLENMEZ, sessizce bayatlar.
 * Değiştiren kişi bu dosyayı da elle senkronlamalı.
 */

import type { SrLevels } from "@/lib/sr/detect";
import type { Candle } from "@/types/candle";
import { ema } from "@/lib/indicators/ema";
import { rsi } from "@/lib/indicators/rsi";

export interface AIScoreBreakdown {
  trendAlignment: number; // -15..+15
  rsiPosition: number; // -10..+10
  srProximity: number; // -8..+8
}

export interface AIScoreResult {
  score: number; // 0-100, 50=nötr, >50 boğa yönlü, <50 ayı yönlü
  breakdown: AIScoreBreakdown;
  disclaimer: string;
}

const DISCLAIMER = "Kural tabanlı skor, kalibre edilmemiş, yatırım tavsiyesi değildir.";

const TREND_EMA_CROSS_WEIGHT = 10; // ema50 vs ema200 (yapısal trend)
const TREND_PRICE_VS_EMA50_WEIGHT = 5; // fiyat vs ema50 (kısa vadeli konum)
// 10 + 5 = 15 → trendAlignment'ın üst sınırıyla eşleşiyor.

/**
 * EMA50 vs EMA200 + fiyat vs EMA50. İkisinden biri bile yetersiz veriden
 * null dönerse (ema200 için 200 bar gerekiyor) TÜM sonuç null — kısmi/
 * eksik bir trend okumasını tam sayıymış gibi göstermemek için (kullanıcı
 * kararı, 2026-08-12: "yetersiz veri sessizce 0 değil, null dönsün").
 */
function computeTrendAlignment(closes: readonly number[], currentPrice: number): number | null {
  const ema50 = ema(closes, { period: 50 });
  const ema200 = ema(closes, { period: 200 });
  if (ema50 === null || ema200 === null) return null;

  let score = 0;
  if (ema50 > ema200) score += TREND_EMA_CROSS_WEIGHT;
  else if (ema50 < ema200) score -= TREND_EMA_CROSS_WEIGHT;

  if (currentPrice > ema50) score += TREND_PRICE_VS_EMA50_WEIGHT;
  else if (currentPrice < ema50) score -= TREND_PRICE_VS_EMA50_WEIGHT;

  return score;
}

/**
 * RSI → eşik + sınırlı-doğrusal, MEAN-REVERSION (kullanıcı kararı,
 * 2026-08-12, orijinal spesifikasyona dönüş): momentum okumasının
 * (yüksek RSI = boğa) TERSİ — yüksek RSI aşırı alım/reversal riski,
 * NEGATİF.
 *   RSI > 70  → sabit -10 (aşırı alım, reversal riski)
 *   RSI < 30  → sabit +10 (aşırı satım, tepki fırsatı)
 *   30-70 arası → (rsi-50)/20 * 3 (±3 aralığında yumuşak geçiş)
 * BİLEREK süreksiz: RSI=69.9→~+3, RSI=70.1→-10 — ara bölgede işaret bile
 * ters (yumuşak geçiş bölgesi zayıf/gürültülü sinyal, eşik ise net bir
 * mean-reversion ayrımı temsil ediyor). Bu kullanıcının açık talebi, düz
 * eğime kasıtlı olarak tercih edilmedi.
 * rsi() default period (14) — composeScoreInput.ts'in skor motorunda
 * kullandığı AYNI default.
 */
function computeRsiPosition(closes: readonly number[]): number | null {
  const rsiVal = rsi(closes);
  if (rsiVal === null) return null; // yetersiz veri — nötr 0 DEĞİL, çağıran taraf null'ı ele almalı
  if (rsiVal > 70) return -10;
  if (rsiVal < 30) return 10;
  return ((rsiVal - 50) / 20) * 3;
}

/** calcPenalty (lib/sr/detect.ts) ile aynı mesafe bantları, 0.4x ölçekli — bkz. dosya başı yorumu. */
function proximityMagnitude(distPct: number): number {
  if (distPct <= 0.5) return 8;
  if (distPct <= 1.5) return 4;
  if (distPct <= 2.5) return 2;
  return 0;
}

/** En yakın seviye (direnç veya destek, hangisi yakınsa) yönünü ve büyüklüğünü belirler. İkisi de yoksa veya eşit mesafedeyse 0. */
function computeSrProximity(srLevels: SrLevels): number {
  const distR = srLevels.nearest_resistance?.distance_pct ?? Infinity;
  const distS = srLevels.nearest_support?.distance_pct ?? Infinity;

  if (!isFinite(distR) && !isFinite(distS)) return 0;
  if (distR < distS) return -proximityMagnitude(distR); // dirence yakın → ayı yönlü baskı
  if (distS < distR) return proximityMagnitude(distS); // desteğe yakın → boğa yönlü baskı
  return 0; // eşit mesafe (nadir durum)
}

/**
 * @returns Yetersiz mum verisi varsa (trendAlignment veya rsiPosition
 *   hesaplanamadıysa) null — sessizce nötr/varsayılan bir skor DEĞİL.
 *   srProximity bunun dışında: yakında hiç S/R seviyesi bulunamaması
 *   ("nearest_resistance"/"nearest_support" ikisi de null) EKSİK VERİ
 *   değil, GEÇERLİ bir sonuçtur (0 katkı) — null'a düşürmez.
 */
export function calculateAIScore(
  k1h: Candle[],
  srLevels: SrLevels,
  currentPrice: number,
): AIScoreResult | null {
  const closes = k1h.map((c) => c.c);

  const trendAlignment = computeTrendAlignment(closes, currentPrice);
  const rsiPosition = computeRsiPosition(closes);
  if (trendAlignment === null || rsiPosition === null) return null;

  const srProximity = computeSrProximity(srLevels);

  const rawScore = 50 + trendAlignment + rsiPosition + srProximity;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    breakdown: { trendAlignment, rsiPosition, srProximity },
    disclaimer: DISCLAIMER,
  };
}
