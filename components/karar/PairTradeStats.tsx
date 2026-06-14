"use client";

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import type { Pair } from "@/lib/constants/pairs";

/**
 * PairTradeStats — karar sayfası pair detayında kompakt performans özeti.
 *
 * Son N kapanmış trade (live state) için:
 *   count · winRate · avgR · son trade P&L
 *
 * Arşiv trades dahil değil (lazy yükleme gerektirir);
 * yeterli live history için 48h içi işlem yapanlar için yeterli.
 */
export function PairTradeStats({ pair }: { pair: Pair }): React.ReactElement | null {
  const trades = useTradesStore((s) => s.trades);

  const stats = useMemo(() => {
    const closed = trades.filter(
      (t) => t.pair === pair && t.status === "closed" && t.exit != null,
    );
    if (closed.length === 0) return null;

    const wins = closed.filter((t) => (t.exit?.pnlUsd ?? 0) > 0).length;
    const winRate = (wins / closed.length) * 100;

    const rVals = closed
      .map((t) => t.exit?.rMultiple)
      .filter((r): r is number => r !== undefined);
    const avgR = rVals.length > 0 ? rVals.reduce((s, r) => s + r, 0) / rVals.length : null;

    const last = closed[closed.length - 1];

    return { count: closed.length, winRate, avgR, last };
  }, [trades, pair]);

  if (!stats) return null;

  const wrColor = stats.winRate >= 60
    ? "text-green-400"
    : stats.winRate >= 40
    ? "text-yellow-400/80"
    : "text-red-400/70";

  const rColor =
    stats.avgR === null
      ? "text-text-t4"
      : stats.avgR >= 0
      ? "text-green-400/70"
      : "text-red-400/70";

  const lastPnl = stats.last.exit?.pnlUsd ?? null;
  const lastColor = lastPnl === null ? "" : lastPnl >= 0 ? "text-green-400/60" : "text-red-400/60";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded border border-border/30 bg-surface-s1/50 font-mono text-2xs">
      <span className="text-text-t4 tracking-wider shrink-0">{stats.count} işlem</span>
      <span className={`tabular-nums font-semibold ${wrColor}`}>
        {stats.winRate.toFixed(0)}% W
      </span>
      {stats.avgR !== null && (
        <span className={`tabular-nums ${rColor}`}>
          {stats.avgR >= 0 ? "+" : ""}{stats.avgR.toFixed(2)}R avg
        </span>
      )}
      {lastPnl !== null && (
        <span className={`tabular-nums ml-auto ${lastColor}`}>
          son {lastPnl >= 0 ? "+" : ""}${lastPnl.toFixed(0)}
        </span>
      )}
    </div>
  );
}
