"use client";

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";

interface DayBucket {
  key: string;
  label: string;
  pnl: number;
  isToday: boolean;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildBuckets(trades: ReturnType<typeof useTradesStore.getState>["trades"]): DayBucket[] {
  const todayKey = new Date().toISOString().slice(0, 10);
  const buckets: DayBucket[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: key === todayKey ? "●" : DAY_LABELS[d.getUTCDay()],
      pnl: 0,
      isToday: key === todayKey,
    });
  }

  for (const trade of trades) {
    if (trade.status !== "closed" || !trade.exit) continue;
    const closedKey = new Date(trade.exit.closedAt).toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.key === closedKey);
    if (bucket) bucket.pnl += trade.exit.pnlUsd;
  }

  return buckets;
}

export function WeeklyPnlBar(): React.ReactElement | null {
  const trades = useTradesStore((s) => s.trades);

  const buckets = useMemo(() => buildBuckets(trades), [trades]);

  // Only render if at least one day has trades
  const hasAny = buckets.some((b) => b.pnl !== 0);
  if (!hasAny) return null;

  const maxAbs = Math.max(...buckets.map((b) => Math.abs(b.pnl)), 1);
  const weekTotal = buckets.reduce((s, b) => s + b.pnl, 0);

  return (
    <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase">
          7 Günlük P&L
        </span>
        <span className={`font-mono text-2xs font-semibold tabular-nums ${weekTotal >= 0 ? "text-signal-green" : "text-signal-red"}`}>
          {weekTotal >= 0 ? "+" : ""}{weekTotal.toFixed(0)}$
        </span>
      </div>

      <div className="flex items-end gap-1.5 h-12">
        {buckets.map((b) => {
          const heightPct = Math.abs(b.pnl) / maxAbs;
          const barH = Math.max(heightPct * 40, b.pnl !== 0 ? 3 : 1);
          const positive = b.pnl >= 0;
          return (
            <div key={b.key} className="flex flex-col items-center flex-1 gap-0.5">
              {/* Bar — grows upward from bottom */}
              <div className="flex flex-col justify-end w-full" style={{ height: 44 }}>
                {b.pnl !== 0 ? (
                  <div
                    className={`w-full rounded-sm ${positive ? "bg-green-400/70" : "bg-red-400/70"} ${b.isToday ? "opacity-100" : "opacity-60"}`}
                    style={{ height: barH }}
                    title={`${b.key}: ${b.pnl >= 0 ? "+" : ""}${b.pnl.toFixed(0)}$`}
                  />
                ) : (
                  <div className="w-full h-px bg-border/30" />
                )}
              </div>
              <span className={`font-mono text-[8px] tabular-nums ${b.isToday ? "text-text-t2 font-bold" : "text-text-t4"}`}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
