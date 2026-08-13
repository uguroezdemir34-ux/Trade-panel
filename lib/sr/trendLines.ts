/**
 * TREND ÇİZGİSİ TESPİTİ — v1 YENİ ÖZELLİK (görsel katman turu).
 *
 * Mevcut S/R altyapısı (lib/sr/detect.ts, levels.ts) sadece YATAY seviyeler
 * üretiyor. Bu dosya lib/sr/swing.ts'teki swing pivot noktalarını
 * (findAllSwingHighs/findAllSwingLows — TEKRAR YAZILMADI, doğrudan import
 * edilip kullanılıyor) birleştirerek DİYAGONAL bir çizgi üretir: basit
 * 2-nokta doğrusal projeksiyon, regresyon değil.
 *
 * GO yönüyle uyumlu seçim:
 *   LONG  → son 2 swing LOW  (yükselen destek çizgisi adayı)
 *   SHORT → son 2 swing HIGH (düşen direnç çizgisi adayı)
 *
 * "confirmed" — p1/p2 dışında, daha eski bir 3. swing noktası çizginin O
 * NOKTADAKİ projeksiyonuna confirmToleranceP ct içinde düşüyorsa true.
 * Sadece 2 nokta varsa (3.'yü doğrulayacak veri yok) confirmed=false —
 * bu REDDEDİLMEZ, sadece zayıf/gözlemsel bir sinyal olarak işaretlenir
 * (kullanıcı kararı: bu tur onay eşiğini sıkılaştırmıyor, veri kalitesini
 * gözlemliyoruz).
 *
 * Yetersiz swing noktası (< 2) → null. Uydurma çizgi YOK.
 */

import { findAllSwingHighs, findAllSwingLows, type PivotPoint } from "./swing";
import type { Candle } from "@/types/candle";

export type TrendLineDirection = "LONG" | "SHORT";

export interface TrendLineResult {
  direction: TrendLineDirection;
  /** Daha eski nokta (düşük idx) */
  p1: PivotPoint;
  /** Daha yeni nokta (yüksek idx) */
  p2: PivotPoint;
  /** Bar başına fiyat değişimi — (p2.price - p1.price) / (p2.idx - p1.idx) */
  slope: number;
  /** Çizginin son (en güncel) bar idx'ine projeksiyonu — "şu an çizgi
   *  nerede" sorusunun cevabı, çizim/anlatım için kullanılır. */
  currentProjectedPrice: number;
  /** p1/p2 DIŞINDA, çizgiye toleransta bulunan en yakın 3. nokta (varsa) */
  confirmingPoint: PivotPoint | null;
  /** confirmingPoint bulunduysa true — SADECE 2 noktalı çizgiler false.
   *  Bu tur onay eşiğini ETKİLEMİYOR, sadece görünürlük için. */
  confirmed: boolean;
}

export interface TrendLineOptions {
  lookback?: number;
  n?: number;
  maxCount?: number;
  /** Üçüncü nokta teyidi için tolerans % (fiyatın çizgi projeksiyonundan
   *  sapma payı). Varsayılan 1.0 — detect.ts'in yatay seviye toleransından
   *  (levels.ts → calculateLevelStrength: %0.5) BİLEREK biraz daha geniş:
   *  ekstrapole edilmiş bir çizgi boyunca gürültü birikir, tek bir sabit
   *  seviyeden daha hassas bir eşik gerçekçi olmaz. */
  confirmTolerancePct?: number;
}

// findAllSwingHighs/Lows'un kendi varsayılanlarıyla (lib/sr/swing.ts)
// TUTARLI — detect.ts'in 4H pivot çağrısıyla aynı lookback/n
// (findAllSwingHighs(k4h, 60, 3, 5)), maxCount=5: en yakın 2'si çizgi için,
// kalan 3'ü 3. nokta adayı havuzu.
const DEFAULT_LOOKBACK = 60;
const DEFAULT_N = 3;
const DEFAULT_MAX_COUNT = 5;
const DEFAULT_CONFIRM_TOLERANCE_PCT = 1.0;

/**
 * @param candles Tek bir zaman dilimi (4H önerilir — detect.ts'in "primer,
 *   daha güvenilir" pivot kaynağıyla ve görsel katmanın kullandığı grafik
 *   zaman dilimiyle tutarlı). Kısa-alan şekli (@/types/candle — o/h/l/c/v),
 *   OKX-şekilli DEĞİL — çağıran toIndicatorCandle() ile önceden çevirmeli
 *   (lib/sr/detect.ts ile AYNI sözleşme).
 * @param direction GO sinyalinin yönü — LONG için destek, SHORT için direnç
 *   çizgisi aranır.
 */
export function detectTrendLine(
  candles: readonly Candle[],
  direction: TrendLineDirection,
  options: TrendLineOptions = {},
): TrendLineResult | null {
  const lookback = options.lookback ?? DEFAULT_LOOKBACK;
  const n = options.n ?? DEFAULT_N;
  const maxCount = options.maxCount ?? DEFAULT_MAX_COUNT;
  const tolerancePct = options.confirmTolerancePct ?? DEFAULT_CONFIRM_TOLERANCE_PCT;

  const pivots =
    direction === "LONG"
      ? findAllSwingLows(candles, lookback, n, maxCount)
      : findAllSwingHighs(candles, lookback, n, maxCount);

  if (pivots.length < 2) return null;

  // pivots[0] en yeni (en yüksek idx), pivots[1] ondan bir önceki —
  // findAllSwingHighs/Lows'un kendi sıralaması (swing.ts dosya başı yorumu:
  // "yakın→uzak").
  const p2 = pivots[0];
  const p1 = pivots[1];
  if (p2.idx === p1.idx) return null; // teorik olarak olmamalı, savunma

  const slope = (p2.price - p1.price) / (p2.idx - p1.idx);
  const lastIdx = candles.length - 1;
  const currentProjectedPrice = p1.price + slope * (lastIdx - p1.idx);

  // 3. nokta arayışı — p1/p2 dışında kalan pivot adayları, her biri
  // KENDİ idx'indeki çizgi projeksiyonuna karşı test edilir. En yakını seçilir.
  let confirmingPoint: PivotPoint | null = null;
  let bestDeviationPct = Infinity;
  for (let i = 2; i < pivots.length; i++) {
    const candidate = pivots[i];
    const projected = p1.price + slope * (candidate.idx - p1.idx);
    if (projected <= 0) continue;
    const deviationPct = (Math.abs(candidate.price - projected) / projected) * 100;
    if (deviationPct <= tolerancePct && deviationPct < bestDeviationPct) {
      bestDeviationPct = deviationPct;
      confirmingPoint = candidate;
    }
  }

  return {
    direction,
    p1,
    p2,
    slope,
    currentProjectedPrice,
    confirmingPoint,
    confirmed: confirmingPoint !== null,
  };
}
