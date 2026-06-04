/**
 * MARKET REGIME DETECTOR — Piyasa rejimini (trending/ranging/volatile) tespit eder.
 *
 * Kullandığı indikatörler:
 *   - ADX (14): trend gücü
 *   - ATR% (14): volatilite yüzdesi
 *   - EMA 20/50/200: trend yönü ve hizası
 *
 * Çıktı: regime + confidence + adaptif eşik önerisi.
 * Bileşen değişikliği yok — skor motoru dokunulmaz, sadece bilgi sağlar.
 */

import type { Candle } from "@/lib/okx/candles";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { adx as computeAdx } from "@/lib/indicators/adx";
import { atr as computeAtr } from "@/lib/indicators/atr";
import { emaSeries } from "@/lib/indicators/ema";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MarketRegime =
  | "trending_bull"
  | "trending_bear"
  | "ranging"
  | "volatile"
  | "uncertain";

export interface RegimeResult {
  regime: MarketRegime;
  /** 0–1 arası güven skoru */
  confidence: number;
  adxValue: number | null;
  /** ATR'nin güncel fiyata oranı (%) */
  atrPct: number | null;
  emaStack: "bull" | "bear" | "mixed";
  /** Base GO eşiği (dışarıdan verilir, default 70) */
  baseThreshold: number;
  /** Rejime göre önerilen eşik */
  suggestedThreshold: number;
  /** Ayarlama miktarı (+/-) */
  thresholdAdjustment: number;
  /** İnsan okunabilir açıklama */
  thresholdReason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ADX_TRENDING_MIN = 25;
const ADX_RANGING_MAX  = 20;
const ATR_PCT_VOLATILE = 2.5; // 1h ATR > %2.5 → volatile

// ─── Main function ────────────────────────────────────────────────────────────

export function detectRegime(
  candles1h: Candle[],
  baseThreshold = 70,
): RegimeResult {
  const uncertain = (adxValue?: number | null): RegimeResult => ({
    regime: "uncertain",
    confidence: 0,
    adxValue: adxValue ?? null,
    atrPct: null,
    emaStack: "mixed",
    baseThreshold,
    suggestedThreshold: baseThreshold,
    thresholdAdjustment: 0,
    thresholdReason: "Yetersiz veri — varsayılan eşik kullanılıyor",
  });

  if (candles1h.length < 60) return uncertain();

  const indCandles = candles1h.map(toIndicatorCandle);
  const closes = candles1h.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  if (!currentPrice) return uncertain();

  // ─── ADX ───
  const adxResult = computeAdx(indCandles, 14);
  const adxValue = adxResult?.adx ?? null;

  // ─── ATR as % of price ───
  const atrValue = computeAtr(indCandles, { period: 14 });
  const atrPct = atrValue != null && currentPrice > 0
    ? (atrValue / currentPrice) * 100
    : null;

  // ─── EMA stack alignment ───
  const ema20v  = emaSeries(closes, { period: 20 });
  const ema50v  = emaSeries(closes, { period: 50 });
  const ema200v = emaSeries(closes, { period: 200 });
  const ema20   = ema20v[ema20v.length - 1];
  const ema50   = ema50v[ema50v.length - 1];
  const ema200  = ema200v[ema200v.length - 1];

  let emaStack: "bull" | "bear" | "mixed" = "mixed";
  if (ema20 !== null && ema50 !== null && ema200 !== null) {
    if (currentPrice > ema20 && ema20 > ema50 && ema50 > ema200) {
      emaStack = "bull";
    } else if (currentPrice < ema20 && ema20 < ema50 && ema50 < ema200) {
      emaStack = "bear";
    }
  }

  // ─── Regime classification (priority: volatile > trending > ranging) ───
  let regime: MarketRegime;
  let confidence: number;

  if (atrPct !== null && atrPct > ATR_PCT_VOLATILE) {
    regime = "volatile";
    confidence = Math.min(1, (atrPct - ATR_PCT_VOLATILE) / ATR_PCT_VOLATILE);
  } else if (adxValue !== null && adxValue >= ADX_TRENDING_MIN) {
    regime = emaStack === "bull" ? "trending_bull"
           : emaStack === "bear" ? "trending_bear"
           : "trending_bull"; // ADX high but EMA mixed → default bull (direction uncertain)
    confidence = Math.min(1, (adxValue - ADX_RANGING_MAX) / 30);
  } else if (adxValue !== null && adxValue < ADX_RANGING_MAX) {
    regime = "ranging";
    confidence = Math.min(1, (ADX_RANGING_MAX - adxValue) / ADX_RANGING_MAX);
  } else {
    // ADX in transition zone 20-25
    return { ...uncertain(adxValue), confidence: 0.2, adxValue, atrPct, emaStack };
  }

  // ─── Adaptive threshold ───
  let thresholdAdjustment: number;
  let thresholdReason: string;

  switch (regime) {
    case "trending_bull":
      thresholdAdjustment = -5;
      thresholdReason = "Yükselen trend — eşik düşürüldü (trend takibi kolaylaşır)";
      break;
    case "trending_bear":
      thresholdAdjustment = -5;
      thresholdReason = "Düşen trend — eşik düşürüldü (kısa trend takibi kolaylaşır)";
      break;
    case "ranging":
      thresholdAdjustment = +7;
      thresholdReason = "Yatay piyasa — eşik yükseltildi (mean reversion riskli)";
      break;
    case "volatile":
      thresholdAdjustment = +10;
      thresholdReason = "Yüksek volatilite — eşik yükseltildi (fiyat hareketi öngörülemez)";
      break;
    default:
      thresholdAdjustment = 0;
      thresholdReason = "Nötr rejim — varsayılan eşik";
  }

  const suggestedThreshold = Math.max(60, Math.min(90, baseThreshold + thresholdAdjustment));

  return {
    regime,
    confidence,
    adxValue,
    atrPct,
    emaStack,
    baseThreshold,
    suggestedThreshold,
    thresholdAdjustment,
    thresholdReason,
  };
}
