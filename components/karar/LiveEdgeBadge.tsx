"use client";

/**
 * LIVE EDGE BADGE — Real-trade EV for the active pair.
 *
 * Reads closed trades with rMultiple for the selected pair and computes:
 *   EV = WR × avgWin_R − (1−WR) × avgLoss_R
 *   WR = from closed trades
 *
 * Hidden if fewer than 5 closed trades exist for the pair.
 * Color: green if EV > 0, amber if 0, red if EV < 0.
 */

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
}

export function LiveEdgeBadge({ pair }: Props): React.ReactElement | null {
  const trades = useTradesStore((s) => s.trades);

  const edge = useMemo(() => {
    const closed = trades.filter(
      (t) =>
        t.pair === pair &&
        t.status === "closed" &&
        t.exit != null &&
        typeof t.exit.rMultiple === "number",
    );
    if (closed.length < 5) return null;

    const rs = closed.map((t) => t.exit!.rMultiple!);
    const wins = rs.filter((r) => r > 0);
    const losses = rs.filter((r) => r <= 0);

    const wr = wins.length / rs.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, r) => s + r, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length) : 0;

    const ev = wr * avgWin - (1 - wr) * avgLoss;

    const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
    const std = Math.sqrt(rs.reduce((s, r) => s + (r - mean) ** 2, 0) / rs.length);
    const sharpe = std > 0 ? mean / std : null;

    return { ev, wr, avgWin, avgLoss, n: rs.length, sharpe };
  }, [trades, pair]);

  if (!edge) return null;

  const { ev, wr, n, sharpe } = edge;
  const isPos = ev > 0;
  const isNeg = ev < 0;

  const color = isPos ? "#22c55e" : isNeg ? "#ef4444" : "#f59e0b";
  const bgColor = isPos ? "rgba(34,197,94,0.08)" : isNeg ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)";
  const borderColor = isPos ? "rgba(34,197,94,0.3)" : isNeg ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)";

  return (
    <div
      className="rounded-lg border px-3 py-2 flex items-center gap-4"
      style={{ background: bgColor, borderColor }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">
          Live Edge ({n} trades)
        </span>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
            EV {ev >= 0 ? "+" : ""}{ev.toFixed(3)}R
          </span>
          <span className="text-text-t4 font-mono text-2xs tabular-nums">
            WR {(wr * 100).toFixed(0)}%
          </span>
          {sharpe !== null && (
            <span className="text-text-t4 font-mono text-2xs tabular-nums">
              Sharpe {sharpe.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
