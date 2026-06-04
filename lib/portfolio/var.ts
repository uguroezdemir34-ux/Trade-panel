/**
 * PORTFOLIO VaR — Historical Value at Risk (fully-historical simulation).
 *
 * Algorithm:
 *   1. Align each position's return series to the same length
 *   2. For each time period t, compute portfolio P&L:
 *        pnl[t] = Σ notional_i × return_i[t] × sign_i
 *   3. Scale 4h returns → 1-day via √6 factor
 *   4. VaR = −percentile(sorted_pnl, α)
 *
 * Assumptions:
 *   - Input returns are 4h period returns from OKX candles
 *   - Positions are perpetual futures (notional = size × markPx)
 *   - Direction NEUTRAL filtered upstream
 */

import type { Pair } from "@/lib/constants/pairs";

export interface PortfolioPosition {
  pair: Pair;
  direction: "LONG" | "SHORT";
  notionalUsd: number;
}

export interface VaRResult {
  /** 1-day VaR at 95% confidence (USD loss) */
  var95Usd: number;
  /** 1-day VaR at 99% confidence (USD loss) */
  var99Usd: number;
  /** Expected Shortfall / CVaR at 95% (USD) */
  cvar95Usd: number;
  /** Portfolio 1-day volatility — 1σ USD */
  portfolioVolUsd: number;
  /** Sum of all position notionals */
  totalNotionalUsd: number;
  /** Number of historical scenarios used */
  scenarios: number;
  /** Standalone 95% VaR contribution per pair (USD) */
  contributions: Record<string, number>;
}

/** √6: converts 4h volatility to 1-day (24h = 6 × 4h periods) */
const SCALE_4H_TO_1D = Math.sqrt(6);

export function computeHistoricalVaR(
  positions: PortfolioPosition[],
  returnsByPair: Record<string, number[]>,
): VaRResult | null {
  if (positions.length === 0) return null;

  // Validate: every position must have a return series ≥ 10 points
  for (const pos of positions) {
    if ((returnsByPair[pos.pair] ?? []).length < 10) return null;
  }

  // Align all series to same length (shortest one)
  const nScenarios = Math.min(
    ...positions.map((p) => (returnsByPair[p.pair] ?? []).length),
  );
  if (nScenarios < 10) return null;

  const totalNotional = positions.reduce((s, p) => s + p.notionalUsd, 0);

  // Build portfolio P&L and per-position contribution arrays
  const portfolioPnl: number[] = new Array(nScenarios).fill(0);
  const rawContribs: Record<string, number[]> = {};

  for (const pos of positions) {
    const returns = (returnsByPair[pos.pair] ?? []).slice(-nScenarios);
    const sign = pos.direction === "LONG" ? 1 : -1;
    const contrib = new Array<number>(nScenarios);
    for (let t = 0; t < nScenarios; t++) {
      const pnl = pos.notionalUsd * returns[t] * sign;
      portfolioPnl[t] += pnl;
      contrib[t] = pnl;
    }
    rawContribs[pos.pair] = contrib;
  }

  // Scale to 1-day
  const dailyPnl = portfolioPnl.map((v) => v * SCALE_4H_TO_1D);
  const sorted = [...dailyPnl].sort((a, b) => a - b);

  const idx95 = Math.max(0, Math.floor(sorted.length * 0.05));
  const idx99 = Math.max(0, Math.floor(sorted.length * 0.01));

  const var95 = Math.max(0, -sorted[idx95]);
  const var99 = Math.max(0, -sorted[idx99]);

  const tail95 = sorted.slice(0, idx95 + 1);
  const cvar95 = tail95.length > 0
    ? Math.max(0, -(tail95.reduce((s, v) => s + v, 0) / tail95.length))
    : var95;

  const mean = dailyPnl.reduce((s, v) => s + v, 0) / dailyPnl.length;
  const variance = dailyPnl.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnl.length;
  const portfolioVol = Math.sqrt(variance);

  // Per-position standalone VaR contribution
  const contributions: Record<string, number> = {};
  for (const pos of positions) {
    const scaled = (rawContribs[pos.pair] ?? []).map((v) => v * SCALE_4H_TO_1D);
    const sortedC = [...scaled].sort((a, b) => a - b);
    const ci = Math.max(0, Math.floor(sortedC.length * 0.05));
    contributions[pos.pair] = Math.max(0, -sortedC[ci]);
  }

  return {
    var95Usd: var95,
    var99Usd: var99,
    cvar95Usd: cvar95,
    portfolioVolUsd: portfolioVol,
    totalNotionalUsd: totalNotional,
    scenarios: nScenarios,
    contributions,
  };
}
