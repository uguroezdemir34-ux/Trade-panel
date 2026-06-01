"use client";

/**
 * PAIR EV LEADERBOARD — Live EV ranking from real closed trades.
 *
 * For each pair that has ≥ 3 closed trades with rMultiple:
 *   EV = WR × avgWin_R − (1−WR) × avgLoss_R
 * Sorted by EV descending. Hidden if fewer than 2 pairs have enough data.
 */

import { useMemo } from "react";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

interface PairEv {
  pair: Pair;
  ev: number;
  wr: number;
  n: number;
  avgWin: number;
  avgLoss: number;
}

export function PairEvLeaderboard({ trades }: Props): React.ReactElement | null {
  const rows = useMemo<PairEv[]>(() => {
    const result: PairEv[] = [];

    for (const pair of PAIRS) {
      const pairTrades = trades.filter(
        (t) => t.pair === pair && typeof t.rMultiple === "number",
      );
      if (pairTrades.length < 3) continue;

      const rs = pairTrades.map((t) => t.rMultiple!);
      const wins = rs.filter((r) => r > 0);
      const losses = rs.filter((r) => r <= 0);

      const wr = wins.length / rs.length;
      const avgWin = wins.length > 0 ? wins.reduce((s, r) => s + r, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length) : 0;
      const ev = wr * avgWin - (1 - wr) * avgLoss;

      result.push({ pair, ev, wr, n: rs.length, avgWin, avgLoss });
    }

    return result.sort((a, b) => b.ev - a.ev);
  }, [trades]);

  if (rows.length < 2) return null;

  const maxAbsEv = Math.max(...rows.map((r) => Math.abs(r.ev)), 0.001);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        📊 Pair EV Leaderboard
      </h3>

      <div className="flex flex-col gap-1.5">
        {rows.map((row, idx) => {
          const isPos = row.ev > 0;
          const color = isPos ? "#22c55e" : "#ef4444";
          const barPct = (Math.abs(row.ev) / maxAbsEv) * 100;

          return (
            <div key={row.pair} className="flex items-center gap-2">
              {/* Rank */}
              <span className="text-text-t4 font-mono text-2xs w-4 text-right shrink-0">
                {idx + 1}
              </span>

              {/* Pair */}
              <span className="font-mono text-xs font-semibold text-text-t2 w-10 shrink-0">
                {row.pair}
              </span>

              {/* Bar */}
              <div className="flex-1 relative h-4 bg-border/10 rounded-sm overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${barPct}%`, background: color, opacity: 0.65 }}
                />
                <span
                  className="absolute inset-0 flex items-center px-1.5 font-mono tabular-nums"
                  style={{ fontSize: 9, color }}
                >
                  EV {isPos ? "+" : ""}{row.ev.toFixed(3)}R
                </span>
              </div>

              {/* WR */}
              <span
                className="font-mono text-2xs tabular-nums w-9 text-right shrink-0"
                style={{ color: row.wr >= 0.5 ? "#22c55e" : "#ef4444" }}
              >
                {(row.wr * 100).toFixed(0)}%
              </span>

              {/* Trade count */}
              <span className="text-text-t4 font-mono text-2xs w-6 text-right shrink-0 tabular-nums">
                {row.n}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-end gap-4">
        <span className="text-text-t4 font-mono text-2xs">WR%</span>
        <span className="text-text-t4 font-mono text-2xs">Trades</span>
      </div>
    </div>
  );
}
