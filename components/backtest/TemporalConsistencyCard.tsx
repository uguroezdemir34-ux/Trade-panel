"use client";

/**
 * TEMPORAL CONSISTENCY CARD — Score-threshold × time-period performance heatmap.
 *
 * Rows = minScore thresholds. Columns = time periods (monthly/bimonthly).
 * Each cell = EV(R) color-coded. Reveals whether the edge holds across market regimes.
 */

import { useMemo } from "react";
import { computeTemporalConsistency } from "@/lib/backtest/temporalConsistency";
import type { BacktestResult, HeatmapCell } from "@/lib/backtest/types";

interface Props {
  result: BacktestResult;
}

function cellBg(cell: HeatmapCell): string {
  if (cell.n < 3 || cell.ev === null) return "bg-surface-s1 text-text-t4";
  if (cell.ev > 0.5) return "bg-signal-green/20 text-signal-green";
  if (cell.ev > 0.1) return "bg-signal-green/10 text-signal-green";
  if (cell.ev > -0.1) return "bg-transparent text-text-t3";
  if (cell.ev > -0.5) return "bg-signal-red/10 text-signal-red";
  return "bg-signal-red/20 text-signal-red";
}

export function TemporalConsistencyCard({ result }: Props) {
  const minScores = useMemo(() => {
    if (result.trades.length === 0) return [70, 75, 80, 85, 90];
    const minInData = Math.min(...result.trades.map((t) => t.score));
    const base = Math.max(60, Math.floor(minInData / 5) * 5);
    return [base, base + 5, base + 10, base + 15, base + 20].filter((s) => s <= 95);
  }, [result.trades]);

  // Choose period count based on data range
  const nPeriods = useMemo(() => {
    if (result.trades.length < 10) return 4;
    const sorted = [...result.trades].sort((a, b) => a.entryTs - b.entryTs);
    const rangeMs = sorted[sorted.length - 1].entryTs - sorted[0].entryTs;
    const rangeMonths = rangeMs / (30 * 24 * 3600_000);
    if (rangeMonths >= 18) return 6;
    if (rangeMonths >= 9) return 4;
    return 3;
  }, [result.trades]);

  const { minScores: scores, periodLabels, grid } = useMemo(
    () => computeTemporalConsistency(result.trades, minScores, nPeriods),
    [result.trades, minScores, nPeriods],
  );

  if (result.trades.length < 10 || periodLabels.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <div className="font-mono text-sm font-semibold text-text-t1 tracking-wider mb-2">
          🗓 Temporal Consistency
        </div>
        <p className="font-mono text-2xs text-text-t4">
          Yeterli backtest trade&apos;i yok (min 10 trade gerekli).
        </p>
      </div>
    );
  }

  // Count how many cells are green (ev > 0)
  const totalCells = grid.flat().filter((c) => c.n >= 3 && c.ev !== null);
  const greenCells = totalCells.filter((c) => c.ev !== null && c.ev > 0);
  const consistencyPct =
    totalCells.length > 0
      ? Math.round((greenCells.length / totalCells.length) * 100)
      : null;

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-text-t1 tracking-wider">
            🗓 Temporal Consistency
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-t4">
            Score threshold × time period · {nPeriods} periods · {result.trades.length} trades
          </div>
        </div>
        {consistencyPct !== null && (
          <div className="text-right shrink-0">
            <div className="font-mono text-2xs text-text-t4">Green cells</div>
            <div className={`font-mono text-xl font-bold tabular-nums ${consistencyPct >= 60 ? "text-signal-green" : consistencyPct >= 40 ? "text-amber-400" : "text-signal-red"}`}>
              {consistencyPct}%
            </div>
          </div>
        )}
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full font-mono text-2xs">
          <thead>
            <tr className="border-b border-border bg-surface-s1 text-text-t4">
              <th className="px-3 py-2 text-left whitespace-nowrap">Score ≥</th>
              {periodLabels.map((lbl) => (
                <th key={lbl} className="px-2 py-2 text-center whitespace-nowrap">{lbl}</th>
              ))}
              <th className="px-3 py-2 text-right">All periods</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((ms, si) => {
              const rowCells = grid[si];
              const allTrades = result.trades.filter((t) => t.score >= ms);
              const allWins = allTrades.filter((t) => t.rMultiple > 0);
              const wr = allTrades.length > 0 ? allWins.length / allTrades.length : null;
              const avgWin = allWins.length > 0 ? allWins.reduce((s, t) => s + t.rMultiple, 0) / allWins.length : 0;
              const allLosses = allTrades.filter((t) => t.rMultiple <= 0);
              const avgLoss = allLosses.length > 0 ? Math.abs(allLosses.reduce((s, t) => s + t.rMultiple, 0) / allLosses.length) : 0;
              const totalEv = wr !== null && allTrades.length >= 3
                ? wr * avgWin - (1 - wr) * avgLoss
                : null;
              const totalCell: HeatmapCell = { n: allTrades.length, ev: totalEv, winRate: wr !== null ? wr * 100 : null };

              return (
                <tr key={ms} className="border-b border-border/30">
                  <td className="px-3 py-1.5 font-bold text-text-t2">≥{ms}</td>
                  {rowCells.map((cell, pi) => (
                    <td
                      key={pi}
                      className={`px-2 py-1.5 text-center tabular-nums ${cellBg(cell)}`}
                      title={cell.n >= 3 ? `N=${cell.n}, WR=${cell.winRate?.toFixed(0)}%` : `N=${cell.n} (insufficient)`}
                    >
                      {cell.n < 3 ? (
                        <span className="text-text-t4">·</span>
                      ) : cell.ev === null ? (
                        "—"
                      ) : (
                        `${cell.ev >= 0 ? "+" : ""}${cell.ev.toFixed(2)}`
                      )}
                    </td>
                  ))}
                  <td className={`px-3 py-1.5 text-right tabular-nums font-bold ${cellBg(totalCell)}`}>
                    {totalCell.ev !== null
                      ? `${totalCell.ev >= 0 ? "+" : ""}${totalCell.ev.toFixed(2)}R`
                      : "—"}
                    {totalCell.n > 0 && (
                      <span className="text-text-t4 font-normal ml-1">({totalCell.n})</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 font-mono text-2xs text-text-t4">
        Values = EV(R). · = fewer than 3 trades (not shown). A consistent strategy shows
        green cells across multiple time periods, not just in one phase.
      </div>
    </div>
  );
}
