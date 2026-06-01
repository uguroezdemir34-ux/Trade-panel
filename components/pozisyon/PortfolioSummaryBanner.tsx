"use client";

/**
 * PORTFOLIO SUMMARY BANNER — Aggregate P&L and exposure for all open positions.
 *
 * Shows total unrealized P&L, total notional exposure, and direction split.
 * Hidden when no open positions exist.
 */

import { useMemo } from "react";
import type { Position } from "@/lib/okx/positions";

interface Props {
  positions: Position[];
}

export function PortfolioSummaryBanner({ positions }: Props): React.ReactElement | null {
  const summary = useMemo(() => {
    if (positions.length === 0) return null;

    const totalUpl = positions.reduce((s, p) => s + p.upl, 0);
    const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
    const longs = positions.filter((p) => p.direction === "LONG").length;
    const shorts = positions.filter((p) => p.direction === "SHORT").length;
    const avgLeverage = positions.reduce((s, p) => s + p.leverage, 0) / positions.length;

    return { totalUpl, totalNotional, longs, shorts, count: positions.length, avgLeverage };
  }, [positions]);

  if (!summary) return null;

  const { totalUpl, totalNotional, longs, shorts, count, avgLeverage } = summary;
  const isPos = totalUpl >= 0;
  const uplSign = isPos ? "+" : "";
  const uplColor = totalUpl > 0 ? "text-green-400" : totalUpl < 0 ? "text-red-400" : "text-text-t2";
  const borderColor = totalUpl > 0 ? "border-green-500/20" : totalUpl < 0 ? "border-red-500/20" : "border-border";
  const bgColor = totalUpl > 0 ? "bg-green-500/5" : totalUpl < 0 ? "bg-red-500/5" : "bg-bg-card";

  return (
    <div className={`rounded-lg border p-4 ${borderColor} ${bgColor}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-text-t4 font-mono text-2xs tracking-widest uppercase mb-1">
            Portfolio — {count} position{count !== 1 ? "s" : ""}
          </div>
          <div className={`font-mono text-2xl font-bold tabular-nums ${uplColor}`}>
            {uplSign}${Math.abs(totalUpl).toFixed(2)}
          </div>
          <div className="text-text-t4 font-mono text-2xs mt-0.5">
            Unrealized P&L
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-text-t3 font-mono text-xs tabular-nums">
            ${totalNotional.toFixed(0)} notional
          </div>
          <div className="text-text-t4 font-mono text-2xs tabular-nums">
            {avgLeverage.toFixed(0)}× avg leverage
          </div>
          <div className="flex items-center gap-2 mt-1">
            {longs > 0 && (
              <span className="text-green-400 font-mono text-2xs font-semibold">
                ▲ {longs}L
              </span>
            )}
            {shorts > 0 && (
              <span className="text-red-400 font-mono text-2xs font-semibold">
                ▼ {shorts}S
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
