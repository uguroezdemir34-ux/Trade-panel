/**
 * TEMPORAL CONSISTENCY — Score-threshold × time-period performance grid.
 *
 * Answers: "Does this system work consistently across different market phases?"
 *
 * Uses existing BacktestTrade[] (no additional engine runs).
 * Grid rows = minScore thresholds; columns = time periods (e.g. monthly).
 * Each cell shows EV(R) for trades in that (score, period) combination.
 */

import type { BacktestTrade, HeatmapCell, TemporalConsistencyResult } from "./types";

function cellStats(trades: BacktestTrade[]): HeatmapCell {
  const n = trades.length;
  if (n < 3) return { n, ev: null, winRate: null };
  const wins = trades.filter((t) => t.rMultiple > 0);
  const losses = trades.filter((t) => t.rMultiple <= 0);
  const wr = wins.length / n;
  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length)
    : 0;
  return {
    n,
    ev: wr * avgWin - (1 - wr) * avgLoss,
    winRate: wr * 100,
  };
}

function periodLabel(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const startStr = `${monthNames[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`;
  const end = new Date(endMs - 1);
  const endStr = `${monthNames[end.getMonth()]} ${String(end.getFullYear()).slice(2)}`;
  return startStr === endStr ? startStr : `${startStr}–${endStr}`;
}

export function computeTemporalConsistency(
  trades: BacktestTrade[],
  minScores: number[],
  nPeriods: number,
): TemporalConsistencyResult {
  if (trades.length < 10 || minScores.length === 0) {
    return { minScores, periodLabels: [], grid: [] };
  }

  const sorted = [...trades].sort((a, b) => a.entryTs - b.entryTs);
  const minTs = sorted[0].entryTs;
  const maxTs = sorted[sorted.length - 1].entryTs;
  const periodMs = (maxTs - minTs) / nPeriods;

  const periodBoundaries: Array<{ start: number; end: number }> = Array.from(
    { length: nPeriods },
    (_, p) => ({
      start: minTs + p * periodMs,
      end: minTs + (p + 1) * periodMs,
    }),
  );

  const periodLabels = periodBoundaries.map((b) => periodLabel(b.start, b.end));

  // Pre-bucket trades by period
  const byPeriod: BacktestTrade[][] = periodBoundaries.map(({ start, end }) =>
    sorted.filter((t) => t.entryTs >= start && t.entryTs < end),
  );

  const grid: HeatmapCell[][] = minScores.map((ms) =>
    byPeriod.map((periodTrades) =>
      cellStats(periodTrades.filter((t) => t.score >= ms)),
    ),
  );

  return { minScores, periodLabels, grid };
}
