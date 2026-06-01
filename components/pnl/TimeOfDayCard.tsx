"use client";

/**
 * TIME-OF-DAY CARD — P&L breakdown by hour-of-day.
 *
 * Groups trades into 4-hour windows: 00-04, 04-08, 08-12, 12-16, 16-20, 20-24.
 * Shows win rate + total P&L bar for each session. Hidden if < 5 trades.
 */

import { useMemo } from "react";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const SESSIONS = [
  { label: "00-04", start: 0,  end: 4  },
  { label: "04-08", start: 4,  end: 8  },
  { label: "08-12", start: 8,  end: 12 },
  { label: "12-16", start: 12, end: 16 },
  { label: "16-20", start: 16, end: 20 },
  { label: "20-24", start: 20, end: 24 },
];

export function TimeOfDayCard({ trades }: Props): React.ReactElement | null {
  const data = useMemo(() => {
    if (trades.length < 5) return null;

    const sessions = SESSIONS.map((s) => ({
      ...s,
      count: 0,
      wins: 0,
      totalPnl: 0,
    }));

    for (const t of trades) {
      const hour = new Date(t.closedAt).getHours();
      const session = sessions.find((s) => hour >= s.start && hour < s.end);
      if (!session) continue;
      session.count++;
      if (t.pnlUsd > 0) session.wins++;
      session.totalPnl += t.pnlUsd;
    }

    const maxAbsPnl = Math.max(...sessions.map((s) => Math.abs(s.totalPnl)), 1);
    return { sessions, maxAbsPnl };
  }, [trades]);

  if (!data) return null;

  const { sessions, maxAbsPnl } = data;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        ⏰ Time of Day
      </h3>

      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          if (s.count === 0) return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-text-t4 font-mono text-2xs w-12 shrink-0">{s.label}</span>
              <div className="flex-1 h-4 rounded-sm bg-border/10" />
              <span className="text-text-t4 font-mono text-2xs w-8 text-right">—</span>
            </div>
          );

          const wr = s.wins / s.count;
          const barPct = (Math.abs(s.totalPnl) / maxAbsPnl) * 100;
          const isPos = s.totalPnl >= 0;
          const barColor = isPos ? "#22c55e" : "#ef4444";

          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-text-t3 font-mono text-2xs w-12 shrink-0">{s.label}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 relative h-4 bg-border/10 rounded-sm overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{ width: `${barPct}%`, background: barColor, opacity: 0.7 }}
                  />
                  <span
                    className="absolute inset-0 flex items-center px-1.5 font-mono tabular-nums"
                    style={{ fontSize: 9, color: barColor }}
                  >
                    {isPos ? "+" : ""}{s.totalPnl.toFixed(1)}
                  </span>
                </div>
              </div>
              <span
                className="font-mono text-2xs w-10 text-right tabular-nums"
                style={{ color: wr >= 0.5 ? "#22c55e" : "#ef4444" }}
              >
                {(wr * 100).toFixed(0)}%
              </span>
              <span className="text-text-t4 font-mono text-2xs w-8 text-right tabular-nums">
                {s.count}t
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
