"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

interface Bucket {
  label: string;
  min: number;  // inclusive
  max: number;  // exclusive (Infinity for last bucket)
  count: number;
  isWin: boolean;
}

const BUCKETS_DEF: Omit<Bucket, "count">[] = [
  { label: "< -4%", min: -Infinity, max: -0.04, isWin: false },
  { label: "-4→-2%", min: -0.04, max: -0.02, isWin: false },
  { label: "-2→0%", min: -0.02, max: 0, isWin: false },
  { label: "0→+2%", min: 0, max: 0.02, isWin: true },
  { label: "+2→+4%", min: 0.02, max: 0.04, isWin: true },
  { label: "> +4%", min: 0.04, max: Infinity, isWin: true },
];

export function PnlDistribution({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const { buckets, hasData } = useMemo(() => {
    const tradesWithPct = trades.filter((t) => typeof t.pnlPct === "number");
    if (tradesWithPct.length === 0) return { buckets: [], hasData: false };

    const buckets: Bucket[] = BUCKETS_DEF.map((def) => ({ ...def, count: 0 }));

    for (const t of tradesWithPct) {
      const pct = t.pnlPct!;
      for (const b of buckets) {
        if (pct >= b.min && pct < b.max) {
          b.count++;
          break;
        }
      }
    }

    return { buckets, hasData: true };
  }, [trades]);

  if (!hasData) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("pnl.distribution.title")}
        </span>
        <span className="text-text-t4 font-mono text-2xs">
          {total} {t("pnl.distribution.trades")}
        </span>
      </div>

      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {buckets.map((b) => {
          const heightPct = total === 0 ? 0 : (b.count / maxCount) * 100;
          const color = b.isWin ? "#22c55e" : "#ef4444";
          const pct = total > 0 ? ((b.count / total) * 100).toFixed(0) : "0";

          return (
            <div
              key={b.label}
              className="flex flex-col items-center justify-end flex-1 h-full gap-0.5"
            >
              {/* Count label */}
              {b.count > 0 && (
                <span
                  className="font-mono tabular-nums"
                  style={{ fontSize: 8, color }}
                >
                  {b.count}
                </span>
              )}
              {/* Bar */}
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max(heightPct, b.count > 0 ? 4 : 0)}%`,
                  background: b.count === 0 ? "var(--color-border)" : color,
                  opacity: b.count === 0 ? 0.2 : 0.8,
                }}
                title={`${b.label}: ${b.count} trades (${pct}%)`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
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
