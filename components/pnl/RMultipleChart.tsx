"use client";

/**
 * R-MULTIPLE CHART — Distribution of R-multiples from live trades.
 *
 * Buckets: ≤-2R, -2→-1R, -1→0R, 0→+1R, +1→+2R, ≥+2R
 * Shows histogram bars colored by sign, count label, and avg R below.
 *
 * Hidden if fewer than 5 trades have rMultiple data.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const BUCKETS = [
  { label: "≤-2R",    min: -Infinity, max: -2,   isWin: false },
  { label: "-2→-1R",  min: -2,        max: -1,   isWin: false },
  { label: "-1→0R",   min: -1,        max: 0,    isWin: false },
  { label: "0→+1R",   min: 0,         max: 1,    isWin: true  },
  { label: "+1→+2R",  min: 1,         max: 2,    isWin: true  },
  { label: "≥+2R",    min: 2,         max: Infinity, isWin: true },
];

export function RMultipleChart({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const data = useMemo(() => {
    const withR = trades.filter((t) => typeof t.rMultiple === "number");
    if (withR.length < 5) return null;

    const buckets = BUCKETS.map((b) => ({
      ...b,
      count: 0,
    }));

    for (const t of withR) {
      const r = t.rMultiple!;
      for (const b of buckets) {
        if (r >= b.min && r < b.max) {
          b.count++;
          break;
        }
      }
    }

    const avgR = withR.reduce((s, t) => s + t.rMultiple!, 0) / withR.length;
    const maxCount = Math.max(...buckets.map((b) => b.count), 1);
    return { buckets, avgR, total: withR.length, maxCount };
  }, [trades]);

  if (!data) return null;

  const { buckets, avgR, total, maxCount } = data;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          📉 {t("pnl.rMultipleChart.title")}
        </h3>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-text-t4">{t("pnl.rMultipleChart.avgR")}</span>
          <span className={avgR >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
            {avgR >= 0 ? "+" : ""}{avgR.toFixed(2)}R
          </span>
          <span className="text-text-t4">{total} {t("pnl.rMultipleChart.trades")}</span>
        </div>
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1.5" style={{ height: 72 }}>
        {buckets.map((b) => {
          const heightPct = (b.count / maxCount) * 100;
          const color = b.isWin ? "#22c55e" : "#ef4444";
          const pct = ((b.count / total) * 100).toFixed(0);

          return (
            <div key={b.label} className="flex flex-col items-center flex-1 h-full justify-end gap-0.5">
              {b.count > 0 && (
                <span className="font-mono tabular-nums" style={{ fontSize: 8, color }}>
                  {b.count}
                </span>
              )}
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max(heightPct, b.count > 0 ? 4 : 0)}%`,
                  background: b.count === 0 ? "var(--color-border)" : color,
                  opacity: b.count === 0 ? 0.15 : 0.8,
                }}
                title={`${b.label}: ${b.count} (${pct}%)`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis */}
      <div className="mt-1 flex gap-1.5">
        {buckets.map((b) => (
          <div
            key={b.label}
            className="flex-1 text-center font-mono"
            style={{ fontSize: 7, color: b.isWin ? "#22c55e" : "#ef4444", opacity: 0.75 }}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
