"use client";

/**
 * STREAK BANNER — Consecutive win/loss streak indicator.
 *
 * Shows a colored banner when the trader has 3+ consecutive wins
 * or losses based on closed trades sorted by closedAt.
 * Returns null if no streak of 3+.
 */

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";

export function StreakBanner(): React.ReactElement | null {
  const trades = useTradesStore((s) => s.trades);

  const streak = useMemo(() => {
    const closed = trades
      .filter((t) => t.status === "closed" && t.exit != null)
      .sort((a, b) => (a.exit?.closedAt ?? 0) - (b.exit?.closedAt ?? 0));

    if (closed.length < 3) return null;

    let streak = 0;
    const lastPnl = closed[closed.length - 1].exit!.pnlUsd;
    const isWin = lastPnl > 0;

    for (let i = closed.length - 1; i >= 0; i--) {
      const pnl = closed[i].exit!.pnlUsd;
      if (isWin ? pnl > 0 : pnl < 0) {
        streak++;
      } else {
        break;
      }
    }

    if (streak < 3) return null;
    return { streak, isWin };
  }, [trades]);

  if (!streak) return null;

  if (streak.isWin) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/8 px-3 py-2">
        <span className="text-green-400 font-mono text-2xs font-bold tracking-widest shrink-0">
          🔥 HOT STREAK
        </span>
        <span className="text-text-t2 font-mono text-xs">
          {streak.streak} consecutive wins — stay disciplined, avoid FOMO sizing
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2">
      <span className="text-red-400 font-mono text-2xs font-bold tracking-widest shrink-0">
        ⚠ LOSS STREAK
      </span>
      <span className="text-text-t2 font-mono text-xs">
        {streak.streak} consecutive losses — consider reducing size or pausing
      </span>
    </div>
  );
}
