"use client";

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useAccountStore } from "@/lib/store/accountStore";

export function SessionStatsBar(): React.ReactElement | null {
  const trades = useTradesStore((s) => s.trades);
  const lastDailyResetAt = useAccountStore((s) => s.lastDailyResetAt);

  const stats = useMemo(() => {
    const todayTrades = trades.filter(
      (t) => t.status === "closed" && (t.exit?.closedAt ?? 0) >= lastDailyResetAt,
    );
    if (todayTrades.length === 0) return null;

    const wins = todayTrades.filter((t) => (t.exit?.pnlUsd ?? 0) > 0).length;
    const losses = todayTrades.length - wins;
    const totalPnl = todayTrades.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);

    // Current streak (newest first)
    const sorted = [...todayTrades].sort(
      (a, b) => (b.exit?.closedAt ?? 0) - (a.exit?.closedAt ?? 0),
    );
    const isFirstWin = (sorted[0].exit?.pnlUsd ?? 0) > 0;
    let streak = 0;
    for (const t of sorted) {
      if (((t.exit?.pnlUsd ?? 0) > 0) !== isFirstWin) break;
      streak++;
    }

    return {
      todayTrades,
      wins,
      losses,
      totalPnl,
      streak: isFirstWin ? streak : -streak,
    };
  }, [trades, lastDailyResetAt]);

  if (!stats) return null;

  const { todayTrades, wins, losses, totalPnl, streak } = stats;
  const pnlPositive = totalPnl >= 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-s1 px-3 py-1.5 font-mono text-2xs">
      <span className="text-text-t4 tracking-wider uppercase shrink-0">Bugün</span>
      <span className={`font-semibold tabular-nums shrink-0 ${pnlPositive ? "text-signal-green" : "text-signal-red"}`}>
        {pnlPositive ? "+" : ""}{totalPnl.toFixed(0)}$
      </span>
      <span className="text-text-t3 shrink-0">{wins}W / {losses}L</span>
      {streak !== 0 && (
        <span className={`shrink-0 font-bold ${streak > 0 ? "text-green-400" : "text-red-400"}`}>
          {Math.abs(streak)}{streak > 0 ? "▲" : "▼"}
        </span>
      )}
      {/* Mini trade outcome dots — last 10, oldest→newest */}
      <div className="flex gap-0.5 ml-auto">
        {todayTrades
          .slice(-10)
          .map((t, i) => (
            <div
              key={i}
              className={`h-2 w-1.5 rounded-sm ${(t.exit?.pnlUsd ?? 0) > 0 ? "bg-green-400/70" : "bg-red-400/70"}`}
            />
          ))}
      </div>
    </div>
  );
}
