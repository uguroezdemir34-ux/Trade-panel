"use client";

/**
 * PORTFOLIO ANALYTICS HOOK — Computes VaR + correlation matrix from live store data.
 *
 * Data sources:
 *   - candleStore["pair_4h"]: 200 × 4h candles → 199 return data points (~33 days)
 *   - positionStore.positions: open perpetual futures positions
 *
 * Returns memoized analytics — only recomputes when candles or positions change.
 */

import { useMemo } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { dailyReturns } from "@/lib/market/correlation";
import { PAIRS } from "@/lib/constants/pairs";
import { computeHistoricalVaR, type VaRResult, type PortfolioPosition } from "@/lib/portfolio/var";
import { buildCorrelationMatrix, type CorrelationMatrix } from "@/lib/portfolio/correlation";

export interface PortfolioAnalytics {
  /** Historical 1-day VaR for current open positions — null if no positions or insufficient data */
  varResult: VaRResult | null;
  /** Pairwise correlation matrix for all pairs with available candle data */
  correlationMatrix: CorrelationMatrix;
  /** Number of pairs with sufficient candle data for correlation */
  pairsWithData: number;
}

export function usePortfolioAnalytics(): PortfolioAnalytics {
  const candles = useCandleStore((s) => s.candles);
  const positions = usePositionStore((s) => s.positions);

  return useMemo(() => {
    // Step 1: compute 4h returns for all pairs
    const returnsByPair: Record<string, number[]> = {};
    for (const pair of PAIRS) {
      const key = `${pair}_4h` as const;
      const cs = candles[key];
      if (cs && cs.length >= 11) {
        returnsByPair[pair] = dailyReturns(cs.map((c) => c.close));
      }
    }

    const pairsWithData = Object.keys(returnsByPair).length;

    // Step 2: correlation matrix
    const correlationMatrix = buildCorrelationMatrix(returnsByPair);

    // Step 3: map open positions (LONG/SHORT only, non-zero notional)
    const portfolioPositions: PortfolioPosition[] = positions
      .filter(
        (p): p is typeof p & { direction: "LONG" | "SHORT" } =>
          (p.direction === "LONG" || p.direction === "SHORT") && Math.abs(p.notional) > 0,
      )
      .map((p) => ({
        pair: p.pair,
        direction: p.direction,
        notionalUsd: Math.abs(p.notional),
      }));

    // Step 4: compute VaR
    const varResult =
      portfolioPositions.length > 0
        ? computeHistoricalVaR(portfolioPositions, returnsByPair)
        : null;

    return { varResult, correlationMatrix, pairsWithData };
  }, [candles, positions]);
}
