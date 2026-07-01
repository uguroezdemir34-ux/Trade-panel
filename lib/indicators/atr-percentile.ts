/**
 * ATR Percentile — v55.51 panel ile birebir.
 * Kaynak: panel_v55_51.html satır 6514-6557.
 *
 * Mevcut ATR'ın son N barlık dağılım içinde nerede durduğunu ölçer (0-100).
 * Rejim tespiti: compression/normal/expansion/extreme_expansion.
 *
 * Akademik referans: "ATR percentile rank" volatilite rejimi standardı.
 */

import type { Candle } from "@/types/candle";

export type AtrRegime =
  | "compression"
  | "normal"
  | "expansion"
  | "extreme_expansion";

export interface AtrPercentileResult {
  percentile: number;
  regime: AtrRegime;
  current: number;
  sampleSize: number;
  /** current ATR / son 20 bar ATR ortalaması — 0.80-1.20 optimal pencere */
  atrRatio: number;
}

export function atrPercentile(
  candles: readonly Candle[],
  period = 14,
): AtrPercentileResult | null {
  if (!candles || candles.length < period * 2) return null;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].h;
    const l = candles[i].l;
    const pc = candles[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  // Her bar için ATR (rolling mean of TRs) — basit ortalama, Wilder değil.
  // (ATR fonksiyonuyla tutarlı.)
  const atrSeries: number[] = [];
  for (let i = period; i <= trs.length; i++) {
    const window = trs.slice(i - period, i);
    let sum = 0;
    for (let j = 0; j < window.length; j++) sum += window[j];
    atrSeries.push(sum / period);
  }
  if (atrSeries.length < 5) return null;

  const current = atrSeries[atrSeries.length - 1];

  // Percentile rank: empirical CDF — current'tan küçük veya eşit kaç tane var.
  let count = 0;
  for (const v of atrSeries) {
    if (v <= current) count++;
  }
  const percentile = Math.round((count / atrSeries.length) * 100);

  let regime: AtrRegime;
  if (percentile < 20) regime = "compression";
  else if (percentile > 95) regime = "extreme_expansion";
  else if (percentile > 80) regime = "expansion";
  else regime = "normal";

  // ATR ratio: son 20 bar ortalamasına göre mevcut konum
  const lb = Math.min(20, atrSeries.length);
  let ratioSum = 0;
  for (let i = atrSeries.length - lb; i < atrSeries.length; i++) ratioSum += atrSeries[i];
  const mean20 = ratioSum / lb;
  const atrRatio = mean20 > 0 ? current / mean20 : 1;

  return {
    percentile,
    regime,
    current,
    sampleSize: atrSeries.length,
    atrRatio,
  };
}
