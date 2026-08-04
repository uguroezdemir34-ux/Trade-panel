/**
 * EXIT SIMULATOR — Backtesting TP/SL hit detection.
 *
 * Mirrors the live checkTpSlHit() logic in lib/trades/state.ts:
 *   LONG:  high >= TP → TP hit;  low <= SL → SL hit
 *   SHORT: low <= TP → TP hit;  high >= SL → SL hit
 *
 * Priority: SL checked first (risk-first), then TP2, then TP1.
 * If both SL and TP hit on the same bar: conservative → SL wins.
 */

import type { Candle } from "@/lib/okx/candles";

export interface ExitResult {
  exitTs: number;
  exitPrice: number;
  exitReason: "tp1" | "tp2" | "sl" | "timeout";
  barsHeld: number;
  /** Max favorable excursion — ham fiyat farkı (her zaman ≥0), R'a bölme çağıran tarafta */
  mfePrice: number;
  /** Max adverse excursion — ham fiyat farkı (her zaman ≥0), R'a bölme çağıran tarafta */
  maePrice: number;
}

/**
 * Scan `futureCandles` for the first TP/SL hit.
 *
 * Entry is assumed at bar 0 close (the signal bar's close price).
 * Scan starts from bar 1 onwards (next candle after entry).
 *
 * @param maxBars Maximum bars to hold before timing out (default 48h = 48 1h bars)
 */
export function simulateExit(
  direction: "LONG" | "SHORT",
  entryPrice: number,
  stopPrice: number,
  tp1Price: number,
  tp2Price: number,
  futureCandles: readonly Candle[],
  maxBars = 48,
): ExitResult {
  const isLong = direction === "LONG";
  const limit = Math.min(maxBars, futureCandles.length);

  // MFE/MAE — running max, bar 0'dan exit bar'a kadar (dahil). rMultiple/
  // exitReason/barsHeld hesabına hiç etkisi yok, saf paralel gözlem. 0'dan
  // başladığı için (Math.max yerine `>` karşılaştırması) hep ≥0 kalır —
  // tek bir bar'ın anlık sapması negatif olsa bile running max bunu görmez.
  let mfePrice = 0;
  let maePrice = 0;

  for (let i = 0; i < limit; i++) {
    const c = futureCandles[i];

    const favorable = isLong ? c.high - entryPrice : entryPrice - c.low;
    const adverse = isLong ? entryPrice - c.low : c.high - entryPrice;
    if (favorable > mfePrice) mfePrice = favorable;
    if (adverse > maePrice) maePrice = adverse;

    // SL check first (risk priority)
    const slHit = isLong ? c.low <= stopPrice : c.high >= stopPrice;
    if (slHit) {
      return { exitTs: c.ts, exitPrice: stopPrice, exitReason: "sl", barsHeld: i + 1, mfePrice, maePrice };
    }

    // TP2 check (more aggressive target)
    const tp2Hit = isLong ? c.high >= tp2Price : c.low <= tp2Price;
    if (tp2Hit) {
      return { exitTs: c.ts, exitPrice: tp2Price, exitReason: "tp2", barsHeld: i + 1, mfePrice, maePrice };
    }

    // TP1 check
    const tp1Hit = isLong ? c.high >= tp1Price : c.low <= tp1Price;
    if (tp1Hit) {
      return { exitTs: c.ts, exitPrice: tp1Price, exitReason: "tp1", barsHeld: i + 1, mfePrice, maePrice };
    }
  }

  // Timeout: exit at last available candle close
  const lastBar = futureCandles[limit - 1] ?? { ts: 0, close: entryPrice };
  return {
    exitTs: lastBar.ts,
    exitPrice: lastBar.close,
    exitReason: "timeout",
    barsHeld: limit,
    mfePrice,
    maePrice,
  };
}

/**
 * Simple ATR over last `period` candles (not Wilder — rolling average of TR).
 * Used in the backtest engine to compute SL/TP distances without importing
 * the indicator module (which may have side effects in some environments).
 */
export function simpleAtr(candles: readonly Candle[], period = 14): number {
  const trs: number[] = [];
  for (let i = Math.max(1, candles.length - period); i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(
      Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)),
    );
  }
  if (trs.length === 0) return 0;
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}
