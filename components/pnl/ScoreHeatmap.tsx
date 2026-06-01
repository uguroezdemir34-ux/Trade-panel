"use client";

/**
 * SCORE HEATMAP — Win rate and avg P&L by score bracket.
 *
 * Buckets: <70, 70-79, 80-89, 90-99, 100
 * Shows count, win rate bar, avg pnl — helps validate
 * which score ranges are actually profitable.
 * Hidden if fewer than 5 trades have a score.
 */

import { useMemo } from "react";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

interface ScoreBucket {
  label: string;
  min: number;
  max: number;
  trades: number;
  wins: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
}

const BUCKET_DEFS = [
  { label: "<70",  min: 0,   max: 70  },
  { label: "70-79", min: 70,  max: 80  },
  { label: "80-89", min: 80,  max: 90  },
  { label: "90-99", min: 90,  max: 100 },
  { label: "100",   min: 100, max: 101 },
];

export function ScoreHeatmap({ trades }: Props): React.ReactElement | null {
  const buckets = useMemo<ScoreBucket[]>(() => {
    const withScore = trades.filter((t) => typeof t.score === "number");
    if (withScore.length < 5) return [];

    return BUCKET_DEFS.map(({ label, min, max }) => {
      const ts = withScore.filter((t) => t.score! >= min && t.score! < max);
      if (ts.length === 0) return { label, min, max, trades: 0, wins: 0, winRate: 0, avgPnl: 0, totalPnl: 0 };
      const wins = ts.filter((t) => t.pnlUsd > 0).length;
      const total = ts.reduce((s, t) => s + t.pnlUsd, 0);
      return {
        label, min, max,
        trades: ts.length,
        wins,
        winRate: (wins / ts.length) * 100,
        avgPnl: total / ts.length,
        totalPnl: total,
      };
    }).filter((b) => b.trades > 0);
  }, [trades]);

  if (buckets.length === 0) return null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        📈 Score Heatmap
      </h3>
      <div className="flex flex-col gap-2">
        {buckets.map((b) => {
          const wrColor =
            b.winRate >= 60
              ? "text-green-400"
              : b.winRate >= 45
              ? "text-yellow-400"
              : "text-red-400";
          const barColor =
            b.winRate >= 60
              ? "bg-green-500"
              : b.winRate >= 45
              ? "bg-yellow-500"
              : "bg-red-500";
          const avgColor = b.avgPnl >= 0 ? "text-green-400" : "text-red-400";

          return (
            <div key={b.label} className="flex items-center gap-3 font-mono text-xs">
              {/* Score label */}
              <span className="text-text-t2 font-semibold w-14 shrink-0 tabular-nums">
                {b.label}
              </span>
              {/* Win rate bar */}
              <div className="flex-1 h-2 rounded-full bg-border/30 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} opacity-70`}
                  style={{ width: `${b.winRate}%` }}
                />
              </div>
              {/* Stats */}
              <span className={`w-10 text-right tabular-nums ${wrColor}`}>
                {b.winRate.toFixed(0)}%
              </span>
              <span className={`w-14 text-right tabular-nums ${avgColor}`}>
                {b.avgPnl >= 0 ? "+" : ""}{b.avgPnl.toFixed(2)}
              </span>
              <span className="text-text-t4 w-8 text-right tabular-nums">
                {b.trades}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end gap-4 font-mono text-2xs text-text-t4">
        <span>WR%</span>
        <span className="w-14 text-right">Avg$</span>
        <span className="w-8 text-right">N</span>
      </div>
    </div>
  );
}
