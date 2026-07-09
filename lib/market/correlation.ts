/**
 * CORRELATION UTILITIES — Shared Pearson correlation for candle data.
 *
 * KORELASYON MATRİSİ genişletmesi: tam 24×24 grid yerine (mobilde
 * okunmaz, 576 hücre) seçilebilir-anchor yaklaşımı — herhangi bir pair
 * "anchor" seçilip diğer 23'e karşı korelasyonu görülebilir. Bu, tam
 * matrisin (276 çift) TEK BİR SATIRINI hesaplar (O(23), tam matrisin
 * O(276)'sından çok daha ucuz) — CorrelationCard zaten sadece tek anchor
 * gösteriyor, tüm matrisi hesaplayıp göstermemek gereksiz iş olurdu.
 */

import type { Candle } from "@/lib/okx/candles";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return out;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;
  const xs = x.slice(-n);
  const ys = y.slice(-n);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx;
    const ey = ys[i] - my;
    num += ex * ey;
    dx2 += ex * ex;
    dy2 += ey * ey;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}

export interface AnchorCorrelationEntry {
  pair: Pair;
  r: number;
}

/**
 * Bir "anchor" pair'in diğer 23 pair'e göre günlük getiri korelasyonunu
 * hesaplar — korelasyon matrisinin tek bir satırı. `candlesByPair`
 * candleStore'un ham şekli (`"BTC_1d"` gibi anahtarlar).
 */
export function computeAnchorCorrelations(
  candlesByPair: Partial<Record<string, Candle[]>>,
  anchor: Pair,
  window = 30,
): AnchorCorrelationEntry[] | null {
  const anchorCandles = candlesByPair[`${anchor}_1d`];
  if (!anchorCandles || anchorCandles.length < 10) return null;

  const anchorCloses = anchorCandles.slice(-window - 1).map((c) => c.close);
  const anchorRet = dailyReturns(anchorCloses);

  const out: AnchorCorrelationEntry[] = [];
  for (const pair of PAIRS) {
    if (pair === anchor) continue;
    const candles = candlesByPair[`${pair}_1d`];
    if (!candles || candles.length < 10) continue;

    const closes = candles.slice(-window - 1).map((c) => c.close);
    const ret = dailyReturns(closes);
    const r = pearson(anchorRet, ret);
    if (r !== null) out.push({ pair, r });
  }

  return out.sort((a, b) => b.r - a.r);
}
