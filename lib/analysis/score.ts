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
 * srProximity bant eşikleri (%0.5/%1.5/%2.5), lib/sr/detect.ts'teki
 * calcPenalty() ile AYNI eşikler — ölçek 8/20=0.4x küçültülmüş (srProximity
 * max ±8, calcPenalty max ±20). Bu bir kod bağımlılığı DEĞİL (lib/score/*'a
 * hiçbir import yok, Kural 0 kapsamı dışında kalsın diye) — sadece aynı
 * "ne kadar yakınsa o kadar önemli" mesafe mantığının bilinçli bir
 * kopyası, S/R'de kaçınılan "iki farklı kaynak birbirinden sapar" riskini
 * burada da azaltmak için.
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

/** EMA50 vs EMA200 + fiyat vs EMA50 — ikisi de mevcutsa toplanır, biri eksikse (yetersiz veri) o bileşen 0 katkı yapar. */
function computeTrendAlignment(closes: readonly number[], currentPrice: number): number {
  const ema50 = ema(closes, { period: 50 });
  const ema200 = ema(closes, { period: 200 });

  let score = 0;
  if (ema50 !== null && ema200 !== null) {
    if (ema50 > ema200) score += TREND_EMA_CROSS_WEIGHT;
    else if (ema50 < ema200) score -= TREND_EMA_CROSS_WEIGHT;
  }
  if (ema50 !== null) {
    if (currentPrice > ema50) score += TREND_PRICE_VS_EMA50_WEIGHT;
    else if (currentPrice < ema50) score -= TREND_PRICE_VS_EMA50_WEIGHT;
  }
  return score;
}

/** RSI 0..100 → -10..+10 doğrusal, 50=nötr merkez. rsi() default period (14) — composeScoreInput.ts'in skor motorunda kullandığı AYNI default. */
function computeRsiPosition(closes: readonly number[]): number {
  const rsiVal = rsi(closes);
  if (rsiVal === null) return 0; // yetersiz veri → nötr katkı (aşağıdaki not: dönüş tipi non-nullable olduğu için)
  const raw = (rsiVal - 50) * (10 / 50);
  return Math.max(-10, Math.min(10, raw));
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

export function calculateAIScore(
  k1h: Candle[],
  srLevels: SrLevels,
  currentPrice: number,
): AIScoreResult {
  const closes = k1h.map((c) => c.c);

  const trendAlignment = computeTrendAlignment(closes, currentPrice);
  const rsiPosition = computeRsiPosition(closes);
  const srProximity = computeSrProximity(srLevels);

  const rawScore = 50 + trendAlignment + rsiPosition + srProximity;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    breakdown: { trendAlignment, rsiPosition, srProximity },
    disclaimer: DISCLAIMER,
  };
}
