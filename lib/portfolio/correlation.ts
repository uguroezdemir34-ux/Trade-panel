/**
 * PORTFOLIO CORRELATION MATRIX — Pairwise Pearson correlation for all pairs.
 *
 * Uses the existing pearson() and dailyReturns() utilities from lib/market/correlation.ts.
 * Only includes pairs that have ≥ 10 return data points.
 */

import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { pearson } from "@/lib/market/correlation";

export interface CorrelationMatrix {
  /** Pairs that have sufficient data (row/column order) */
  pairs: Pair[];
  /** n × n matrix — null for insufficient data, 1 on diagonal */
  data: (number | null)[][];
  /** Minimum return series length used across all pairs */
  returnCount: number;
}

export function buildCorrelationMatrix(
  returnsByPair: Record<string, number[]>,
): CorrelationMatrix {
  const availablePairs = PAIRS.filter(
    (p) => (returnsByPair[p] ?? []).length >= 10,
  );

  const n = availablePairs.length;

  if (n === 0) {
    return { pairs: [], data: [], returnCount: 0 };
  }

  const matrix: (number | null)[][] = Array.from(
    { length: n },
    () => new Array<number | null>(n).fill(null),
  );

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-correlation is always 1
    for (let j = i + 1; j < n; j++) {
      const ri = returnsByPair[availablePairs[i]] ?? [];
      const rj = returnsByPair[availablePairs[j]] ?? [];
      const r = pearson(ri, rj);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  const returnCount = Math.min(
    ...availablePairs.map((p) => (returnsByPair[p] ?? []).length),
  );

  return { pairs: availablePairs, data: matrix, returnCount };
}
