/**
 * EQUITY CURVE — Trade list → kümülatif P&L serisini hesaplar.
 *
 * Her kapanan trade için bir nokta: kümülatif PnL + drawdown.
 * Başlangıç noktası (0, 0) eklenir (baseline).
 */

import type { TradeRecord } from "./types";

export interface EquityPoint {
  /** Trade kapanış zamanı (epoch ms) — ilk nokta = 0 */
  closedAt: number;
  /** Kümülatif PnL bu noktaya kadar */
  cumPnlUsd: number;
  /** Bu noktada peak değer (en yüksek kümülatif PnL) */
  peak: number;
  /** Drawdown = peak - cumPnl (her zaman >= 0) */
  drawdownUsd: number;
}

/**
 * Trade list → equity curve noktaları.
 * Kronolojik sırada. Boş list → [] döner.
 */
export function computeEquityCurve(
  trades: readonly TradeRecord[],
): EquityPoint[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);

  let cumPnl = 0;
  let peak = 0;
  const points: EquityPoint[] = [];

  // Başlangıç noktası (baseline)
  points.push({
    closedAt: sorted[0].closedAt - 1,
    cumPnlUsd: 0,
    peak: 0,
    drawdownUsd: 0,
  });

  for (const trade of sorted) {
    cumPnl += trade.pnlUsd;
    if (cumPnl > peak) peak = cumPnl;
    points.push({
      closedAt: trade.closedAt,
      cumPnlUsd: cumPnl,
      peak,
      drawdownUsd: Math.max(0, peak - cumPnl),
    });
  }

  return points;
}
