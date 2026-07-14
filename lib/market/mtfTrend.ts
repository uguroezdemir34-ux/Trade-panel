/**
 * MULTI-TIMEFRAME TREND — 1h / 4h / 1d için trend yönü.
 *
 * Yöntem: Her timeframe için EMA20 hesaplanır, son kapanışla karşılaştırılır.
 *  - close > EMA20 → up
 *  - close < EMA20 → down
 *  - sapma < 0.1% → flat
 *
 * Üç timeframe için "trend score":
 *  - 3 up → "Güçlü yükseliş" (cls: "strong_up")
 *  - 2 up → "Yükseliş" (cls: "up")
 *  - mix → "Karışık" (cls: "mixed")
 *  - 2 down → "Düşüş" (cls: "down")
 *  - 3 down → "Güçlü düşüş" (cls: "strong_down")
 *
 * Bu özellikle "Karar" sekmesindeki sinyal motorunun yan-bilgisi —
 * Piyasa sekmesi için saf görünür özet.
 */

import { ema } from "@/lib/indicators/ema";
import type { Candle } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";

export type TrendDirection = "up" | "flat" | "down";

/** Not: "15m" 3 UX görevi (karar/piyasa/grafik mini kart şeritleri) için
 *  eklendi — SADECE görüntü amaçlı computeTimeframeTrend() çağrılarında
 *  kullanılır. computeMtfTrend() (aşağıda) HÂLÂ sadece 1h/4h/1d'yi
 *  hesaba katıyor — bu union'ın genişlemesi o fonksiyonun davranışını
 *  DEĞİŞTİRMEZ, sadece computeTimeframeTrend()'in tf parametresine yeni
 *  bir etiket eklemeye izin verir. */
export interface TimeframeTrend {
  /** Timeframe etiketi */
  tf: "15m" | "1h" | "4h" | "1d";
  /** Yön */
  direction: TrendDirection;
  /** EMA20 değeri */
  ema20: number | null;
  /** Son kapanış */
  lastClose: number | null;
  /** Sapma yüzdesi (close - ema)/ema, signed */
  deviation: number;
}

export type MtfClass =
  | "strong_up"
  | "up"
  | "mixed"
  | "down"
  | "strong_down"
  | "no_data";

export interface MtfTrendResult {
  pair: Pair;
  trends: TimeframeTrend[];
  /** Toplu yön sınıfı */
  cls: MtfClass;
  /** Up sayısı */
  upCount: number;
  /** Down sayısı */
  downCount: number;
  /** Flat sayısı */
  flatCount: number;
}

/** Flat sınırı (yüzde) */
const FLAT_THRESHOLD = 0.001; // 0.1%

/**
 * Tek timeframe için trend yönü.
 */
export function computeTimeframeTrend(
  tf: "15m" | "1h" | "4h" | "1d",
  candles: readonly Candle[],
): TimeframeTrend {
  // Repainting fix: açık/canlı mum (confirm=false) trend yönünü manipüle
  // etmesin — sadece kapanmış mumlar EMA20/lastClose hesabına girer.
  const confirmed = candles.filter((c) => c.confirm);

  if (confirmed.length < 20) {
    return {
      tf,
      direction: "flat",
      ema20: null,
      lastClose: null,
      deviation: 0,
    };
  }

  const closes = confirmed.map((c) => c.close);
  const ema20 = ema(closes, { period: 20 });
  const lastClose = closes[closes.length - 1];

  if (ema20 === null || lastClose === undefined) {
    return {
      tf,
      direction: "flat",
      ema20: null,
      lastClose: null,
      deviation: 0,
    };
  }

  const deviation = (lastClose - ema20) / ema20;
  let direction: TrendDirection = "flat";
  if (deviation > FLAT_THRESHOLD) direction = "up";
  else if (deviation < -FLAT_THRESHOLD) direction = "down";

  return { tf, direction, ema20, lastClose, deviation };
}

/**
 * 3 timeframe'i toplu özetle.
 */
export function computeMtfTrend(
  pair: Pair,
  candles1h: readonly Candle[],
  candles4h: readonly Candle[],
  candles1d: readonly Candle[],
): MtfTrendResult {
  const trends = [
    computeTimeframeTrend("1h", candles1h),
    computeTimeframeTrend("4h", candles4h),
    computeTimeframeTrend("1d", candles1d),
  ];

  const upCount = trends.filter((t) => t.direction === "up").length;
  const downCount = trends.filter((t) => t.direction === "down").length;
  const flatCount = trends.filter((t) => t.direction === "flat").length;

  let cls: MtfClass;
  if (trends.every((t) => t.lastClose === null)) {
    cls = "no_data";
  } else if (upCount === 3) {
    cls = "strong_up";
  } else if (downCount === 3) {
    cls = "strong_down";
  } else if (upCount >= 2 && downCount === 0) {
    cls = "up";
  } else if (downCount >= 2 && upCount === 0) {
    cls = "down";
  } else {
    cls = "mixed";
  }

  return { pair, trends, cls, upCount, downCount, flatCount };
}

/**
 * 4 timeframe'lik (15m/1h/4h/1d) GÖRÜNTÜLEME dizisi — SKORLAMA amaçlı
 * DEĞİL. computeMtfTrend()'in "kaç TF hizalı" (cls/upCount/downCount)
 * çekirdek mantığını KULLANMAZ/DEĞİŞTİRMEZ — orchestrator.ts'in MTF gate'i
 * (composeScoreInput → mtfResult.cls) hâlâ SADECE computeMtfTrend()'in
 * kendi, ayrı 3-TF (1h/4h/1d) çağrısına bağlı (useScoreEngine.ts:247,
 * bu fonksiyona hiç dokunmuyor). Bu, karar/piyasa/grafik sayfalarındaki
 * mini kart şeritlerinde 15m okunu göstermek için eklenen, saf/bağımsız
 * bir yardımcı — 3 UX görevi (2026-07-14) kapsamında eklendi.
 */
export function computeDisplayTrends(
  candles15m: readonly Candle[],
  candles1h: readonly Candle[],
  candles4h: readonly Candle[],
  candles1d: readonly Candle[],
): TimeframeTrend[] {
  return [
    computeTimeframeTrend("15m", candles15m),
    computeTimeframeTrend("1h", candles1h),
    computeTimeframeTrend("4h", candles4h),
    computeTimeframeTrend("1d", candles1d),
  ];
}
