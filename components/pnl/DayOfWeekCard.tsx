"use client";

/**
 * DAY-OF-WEEK CARD — Performance broken down by day (Mon-Sun).
 *
 * Shows trade count, win rate bar, total P&L per weekday.
 * Useful for identifying calendar biases.
 * Hidden if fewer than 7 trades (need spread across multiple days).
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

interface DayRow {
  label: string;
  trades: number;
  wins: number;
  winRate: number;
  totalPnl: number;
}

export function DayOfWeekCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const rows = useMemo<DayRow[]>(() => {
    if (trades.length < 7) return [];

    const byDay: { trades: TradeRecord[]; wins: number; total: number }[] = DAY_KEYS.map(() => ({
      trades: [],
      wins: 0,
      total: 0,
    }));

    for (const tr of trades) {
      // getDay(): 0=Sun, 1=Mon ... 6=Sat → map to Mon-Sun (index 0-6)
      const jsDay = new Date(tr.closedAt).getDay();
      const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 ... Sun=6
      byDay[idx].trades.push(tr);
      if (tr.pnlUsd > 0) byDay[idx].wins++;
      byDay[idx].total += tr.pnlUsd;
    }

    return DAY_KEYS.map((key, i) => {
      const n = byDay[i].trades.length;
      return {
        label: key,
        trades: n,
        wins: byDay[i].wins,
        winRate: n === 0 ? 0 : (byDay[i].wins / n) * 100,
        totalPnl: byDay[i].total,
      };
    });
  }, [trades]);

  if (rows.length === 0) return null;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.totalPnl)), 1);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        📅 {t("pnl.dayOfWeek.title")}
      </h3>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const barW = (Math.abs(row.totalPnl) / maxAbs) * 100;
          const isPositive = row.totalPnl >= 0;
          const wrColor =
            row.trades === 0
              ? "text-text-t4"
              : row.winRate >= 60
              ? "text-green-400"
              : row.winRate >= 45
              ? "text-yellow-400"
              : "text-red-400";
          const pnlColor = isPositive ? "text-green-400" : "text-red-400";

          return (
            <div key={row.label} className="flex items-center gap-2 font-mono text-xs">
              {/* Day label */}
              <span className="text-text-t3 w-7 shrink-0">{t(`pnl.dayOfWeek.${row.label}`)}</span>

              {/* Bar */}
              <div className="flex-1 h-2 rounded-full bg-border/30 overflow-hidden">
                {row.trades > 0 && (
                  <div
                    className={`h-full rounded-full ${isPositive ? "bg-green-500/60" : "bg-red-500/60"}`}
                    style={{ width: `${barW}%` }}
                  />
                )}
              </div>

              {/* WR */}
              <span className={`w-9 text-right tabular-nums text-2xs ${wrColor}`}>
                {row.trades === 0 ? "—" : `${row.winRate.toFixed(0)}%`}
              </span>

              {/* Total P&L */}
              <span className={`w-16 text-right tabular-nums font-semibold ${row.trades === 0 ? "text-text-t4" : pnlColor}`}>
                {row.trades === 0 ? "—" : `${isPositive ? "+" : ""}$${Math.abs(row.totalPnl).toFixed(0)}`}
              </span>

              {/* Count */}
              <span className="text-text-t4 w-5 text-right tabular-nums text-2xs">
                {row.trades === 0 ? "" : row.trades}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
