"use client";

import type { MonthlyAggregate } from "@/lib/pnl/monthly";

interface Props {
  months: MonthlyAggregate[];
}

export function MonthlyBreakdown({ months }: Props): React.ReactElement | null {
  if (months.length === 0) return null;

  const maxAbs = months.reduce((m, mo) => Math.max(m, Math.abs(mo.totalPnlUsd)), 0.01);

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          Monthly Breakdown
        </span>
        <span className="text-text-t4 font-mono text-2xs">
          {months.length} {months.length === 1 ? "month" : "months"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {months.map((mo) => {
          const isProfit = mo.totalPnlUsd >= 0;
          const barPct = (Math.abs(mo.totalPnlUsd) / maxAbs) * 100;
          const sign = mo.totalPnlUsd > 0 ? "+" : mo.totalPnlUsd < 0 ? "" : "";
          const wrColor =
            mo.winRate >= 0.6
              ? "text-green-400"
              : mo.winRate >= 0.5
              ? "text-yellow-400"
              : mo.winRate > 0
              ? "text-red-400"
              : "text-text-t4";

          return (
            <div key={mo.yearMonth} className="flex items-center gap-2">
              {/* Month label */}
              <span className="text-text-t3 font-mono text-2xs w-16 shrink-0">
                {mo.label}
              </span>

              {/* Bar track */}
              <div className="flex-1 h-4 relative flex items-center">
                <div className="absolute inset-0 rounded-sm overflow-hidden bg-border/20">
                  <div
                    className={`h-full rounded-sm transition-all ${
                      mo.tradeCount === 0
                        ? "bg-border/30"
                        : isProfit
                        ? "bg-green-500/60"
                        : "bg-red-500/60"
                    }`}
                    style={{ width: mo.tradeCount === 0 ? "0%" : `${barPct}%` }}
                  />
                </div>
                {/* PnL label on bar */}
                {mo.tradeCount > 0 && (
                  <span
                    className={`absolute left-1.5 font-mono text-2xs tabular-nums font-semibold ${
                      isProfit ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {sign}${Math.abs(mo.totalPnlUsd).toFixed(0)}
                  </span>
                )}
              </div>

              {/* Trade count */}
              <span className="text-text-t4 font-mono text-2xs tabular-nums w-7 text-right shrink-0">
                {mo.tradeCount}t
              </span>

              {/* Win rate */}
              <span className={`font-mono text-2xs tabular-nums w-8 text-right shrink-0 ${wrColor}`}>
                {mo.tradeCount > 0 ? `${Math.round(mo.winRate * 100)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 border-t border-border/30 pt-2">
        <span className="text-text-t4 font-mono text-2xs">t = trades</span>
        <span className="text-text-t4 font-mono text-2xs">% = win rate</span>
      </div>
    </div>
  );
}
