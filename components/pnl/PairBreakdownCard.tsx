"use client";

/**
 * PAIR BREAKDOWN CARD — P&L performance segmented by pair.
 *
 * Shows each pair's trade count, win rate, avg P&L, and total P&L.
 * Sorted by total P&L descending. Hidden if fewer than 2 pairs traded.
 */

import { useMemo } from "react";
import type { TradeRecord } from "@/lib/pnl/types";
import type { Pair } from "@/lib/constants/pairs";

interface PairRow {
  pair: Pair;
  trades: number;
  wins: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
}

interface Props {
  trades: readonly TradeRecord[];
}

export function PairBreakdownCard({ trades }: Props): React.ReactElement | null {
  const rows = useMemo<PairRow[]>(() => {
    const map = new Map<Pair, TradeRecord[]>();
    for (const t of trades) {
      const arr = map.get(t.pair) ?? [];
      arr.push(t);
      map.set(t.pair, arr);
    }
    if (map.size < 2) return [];

    return [...map.entries()]
      .map(([pair, ts]) => {
        const wins = ts.filter((t) => t.pnlUsd > 0).length;
        const total = ts.reduce((s, t) => s + t.pnlUsd, 0);
        return {
          pair,
          trades: ts.length,
          wins,
          winRate: (wins / ts.length) * 100,
          avgPnl: total / ts.length,
          totalPnl: total,
        };
      })
      .sort((a, b) => b.totalPnl - a.totalPnl);
  }, [trades]);

  if (rows.length === 0) return null;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.totalPnl)));

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        📊 Performance by Pair
      </h3>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="text-text-t4 border-b border-border">
            <th className="text-left py-1 pr-2">Pair</th>
            <th className="text-right py-1 pr-2">Trades</th>
            <th className="text-right py-1 pr-2">WR%</th>
            <th className="text-right py-1 pr-2">Avg $</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sign = row.totalPnl >= 0 ? "+" : "";
            const pnlColor = row.totalPnl > 0 ? "text-green-400" : row.totalPnl < 0 ? "text-red-400" : "text-text-t3";
            const wrColor = row.winRate >= 55 ? "text-green-400" : row.winRate >= 45 ? "text-yellow-400" : "text-red-400";
            const barW = maxAbs > 0 ? (Math.abs(row.totalPnl) / maxAbs) * 100 : 0;

            return (
              <tr key={row.pair} className="border-b border-border/30">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-t2 font-semibold w-12">{row.pair}</span>
                    <div className="flex-1 h-1 rounded-full bg-border/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.totalPnl >= 0 ? "bg-green-500/50" : "bg-red-500/50"}`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="text-text-t3 text-right py-1.5 pr-2 tabular-nums">
                  {row.trades}
                </td>
                <td className={`text-right py-1.5 pr-2 tabular-nums ${wrColor}`}>
                  {row.winRate.toFixed(0)}%
                </td>
                <td className={`text-right py-1.5 pr-2 tabular-nums ${row.avgPnl >= 0 ? "text-text-t3" : "text-red-400"}`}>
                  {row.avgPnl >= 0 ? "+" : ""}{row.avgPnl.toFixed(2)}
                </td>
                <td className={`text-right py-1.5 tabular-nums font-semibold ${pnlColor}`}>
                  {sign}${Math.abs(row.totalPnl).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
