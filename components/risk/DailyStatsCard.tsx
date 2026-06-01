"use client";

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";

function todayBounds() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { start: d.getTime(), end: d.getTime() + 86_400_000 };
}

export function DailyStatsCard(): React.ReactElement {
  const trades = useTradesStore((s) => s.trades);

  const stats = useMemo(() => {
    const { start, end } = todayBounds();

    const opened = trades.filter((t) => t.openedAt >= start && t.openedAt < end);
    const closed = trades.filter(
      (t) => t.status === "closed" && t.exit != null && t.exit.closedAt >= start && t.exit.closedAt < end,
    );

    const pnl = closed.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);
    const wins = closed.filter((t) => (t.exit?.pnlUsd ?? 0) > 0).length;
    const losses = closed.filter((t) => (t.exit?.pnlUsd ?? 0) < 0).length;
    const wr = closed.length > 0 ? (wins / closed.length) * 100 : null;

    // Current streak from ALL closed trades (most recent last)
    const allClosed = [...trades]
      .filter((t) => t.status === "closed" && t.exit != null)
      .sort((a, b) => a.exit!.closedAt - b.exit!.closedAt);

    let streak = 0;
    let streakType: "win" | "loss" | null = null;
    if (allClosed.length > 0) {
      const lastType = (allClosed[allClosed.length - 1].exit!.pnlUsd ?? 0) > 0 ? "win" : "loss";
      streakType = lastType;
      for (let i = allClosed.length - 1; i >= 0; i--) {
        const isWin = (allClosed[i].exit!.pnlUsd ?? 0) > 0;
        if ((lastType === "win" && isWin) || (lastType === "loss" && !isWin)) {
          streak++;
        } else {
          break;
        }
      }
    }

    return { opened: opened.length, closed: closed.length, pnl, wins, losses, wr, streak, streakType };
  }, [trades]);

  const pnlColor = stats.pnl > 0 ? "text-green-400" : stats.pnl < 0 ? "text-red-400" : "text-text-t3";
  const pnlSign = stats.pnl > 0 ? "+" : "";
  const wrColor = stats.wr === null ? "text-text-t4" : stats.wr >= 55 ? "text-green-400" : stats.wr >= 45 ? "text-yellow-400" : "text-red-400";
  const streakColor = stats.streakType === "win" ? "text-green-400" : stats.streakType === "loss" ? "text-red-400" : "text-text-t4";
  const streakLabel = stats.streak >= 2 && stats.streakType
    ? `${stats.streakType === "win" ? "🔥" : "⚠"} ${stats.streak} ${stats.streakType}`
    : "—";

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        📅 Today's Stats
      </h3>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Opened" value={stats.opened.toString()} />
        <Stat label="Closed" value={stats.closed.toString()} />
        <Stat
          label="P&L"
          value={stats.closed > 0 ? `${pnlSign}$${Math.abs(stats.pnl).toFixed(2)}` : "—"}
          color={stats.closed > 0 ? pnlColor : undefined}
        />
        <Stat
          label="Win Rate"
          value={stats.wr !== null ? `${stats.wr.toFixed(0)}%` : "—"}
          color={stats.wr !== null ? wrColor : undefined}
          hint={stats.closed > 0 ? `${stats.wins}W/${stats.losses}L` : undefined}
        />
      </div>
      {stats.streak >= 2 && (
        <div className={`mt-2 pt-2 border-t border-border/30 font-mono text-xs ${streakColor}`}>
          {streakLabel} streak
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${color ?? "text-text-t1"}`}>
        {value}
      </span>
      {hint && <span className="text-text-t4 font-mono text-2xs">{hint}</span>}
    </div>
  );
}
