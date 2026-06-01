"use client";

/**
 * ENTRY QUALITY CHART — Score distribution of winning vs losing trades.
 *
 * Shows a stacked bar chart across score buckets (<70, 70-79, 80-89, 90-99, 100)
 * with green (wins) and red (losses) segments, helping traders see which score
 * range produces the best outcomes.
 *
 * Hidden if fewer than 5 trades have score data.
 */

import { useMemo } from "react";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const BUCKETS = [
  { label: "<70",    min: 0,  max: 70  },
  { label: "70-79",  min: 70, max: 80  },
  { label: "80-89",  min: 80, max: 90  },
  { label: "90-99",  min: 90, max: 100 },
  { label: "100",    min: 100, max: 101 },
];

export function EntryQualityChart({ trades }: Props): React.ReactElement | null {
  const data = useMemo(() => {
    const withScore = trades.filter((t) => typeof t.score === "number");
    if (withScore.length < 5) return null;

    const buckets = BUCKETS.map((b) => ({
      ...b,
      wins: 0,
      losses: 0,
    }));

    for (const t of withScore) {
      const score = t.score!;
      const bucket = buckets.find((b) => score >= b.min && score < b.max);
      if (!bucket) continue;
      if (t.pnlUsd > 0) bucket.wins++;
      else if (t.pnlUsd < 0) bucket.losses++;
    }

    const maxTotal = Math.max(...buckets.map((b) => b.wins + b.losses), 1);
    return { buckets, maxTotal, total: withScore.length };
  }, [trades]);

  if (!data) return null;

  const { buckets, maxTotal } = data;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        🎯 Entry Quality by Score
      </h3>

      <div className="flex flex-col gap-2">
        {buckets.map((b) => {
          const total = b.wins + b.losses;
          const wr = total > 0 ? b.wins / total : null;
          const barWidthPct = (total / maxTotal) * 100;
          const winWidthPct = total > 0 ? (b.wins / total) * 100 : 0;

          return (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-text-t3 font-mono text-2xs w-12 shrink-0">{b.label}</span>
              <div className="flex-1">
                {total === 0 ? (
                  <div className="h-5 bg-border/10 rounded-sm" />
                ) : (
                  <div
                    className="h-5 rounded-sm overflow-hidden relative"
                    style={{ width: `${barWidthPct}%` }}
                  >
                    {/* Wins (green) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-green-500/60"
                      style={{ width: `${winWidthPct}%` }}
                    />
                    {/* Losses (red) */}
                    <div
                      className="absolute inset-y-0 right-0 bg-red-500/60"
                      style={{ width: `${100 - winWidthPct}%` }}
                    />
                    {/* Label */}
                    <span className="absolute inset-0 flex items-center justify-center font-mono tabular-nums text-white/90" style={{ fontSize: 9 }}>
                      {b.wins}W / {b.losses}L
                    </span>
                  </div>
                )}
              </div>
              <span
                className="font-mono text-2xs tabular-nums w-9 text-right shrink-0"
                style={{ color: wr === null ? "var(--color-text-t4)" : wr >= 0.6 ? "#22c55e" : wr >= 0.5 ? "#f59e0b" : "#ef4444" }}
              >
                {wr !== null ? `${(wr * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-4 text-text-t4 font-mono text-2xs">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-green-500/60 rounded-sm" />Wins</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-red-500/60 rounded-sm" />Losses</span>
      </div>
    </div>
  );
}
