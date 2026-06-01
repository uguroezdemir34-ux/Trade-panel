"use client";

/**
 * HISTORICAL EDGE — Shows backtest scan stats for the active pair.
 *
 * Reads from backtestStore.scanRows (cached scan results). If the user
 * has run a multi-pair scan, this shows EV, WR, Sharpe, and PF for the
 * currently active pair without requiring a separate backtest run.
 *
 * Hidden when no scan data is available for the pair.
 */

import { useMemo } from "react";
import { useBacktestStore } from "@/lib/store/backtestStore";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
}

export function HistoricalEdge({ pair }: Props): React.ReactElement | null {
  const scanRows = useBacktestStore((s) => s.scanRows);
  const scanConfig = useBacktestStore((s) => s.scanConfig);
  const scanStatus = useBacktestStore((s) => s.scanStatus);

  const row = useMemo(
    () => scanRows.find((r) => r.pair === pair && r.status === "done"),
    [scanRows, pair],
  );

  if (!row || scanStatus === "scanning") return null;

  const evColor = row.ev !== null && row.ev > 0 ? "text-green-400" : row.ev !== null && row.ev < 0 ? "text-red-400" : "text-text-t4";
  const wrColor = row.winRate >= 55 ? "text-green-400" : row.winRate >= 45 ? "text-yellow-400" : "text-red-400";
  const pfColor = row.profitFactor !== null && row.profitFactor >= 1.5 ? "text-green-400" : row.profitFactor !== null && row.profitFactor >= 1 ? "text-yellow-400" : "text-red-400";
  const isPositive = row.ev !== null && row.ev > 0;

  const borderColor = isPositive ? "border-green-400/20" : "border-border";
  const bgColor = isPositive ? "bg-green-400/5" : "";

  return (
    <div className={`rounded-lg border px-3 py-2 font-mono ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-text-t4 text-2xs tracking-widest uppercase">
          Geçmiş Edge
        </span>
        {scanConfig && (
          <span className="text-text-t4 text-2xs">
            {scanConfig.dataMonths}mo · F&G {scanConfig.frozenFg}
            {scanConfig.minScore ? ` · ≥${scanConfig.minScore}` : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className={`text-sm font-bold tabular-nums ${evColor}`}>
            {row.ev !== null ? `${row.ev > 0 ? "+" : ""}${row.ev.toFixed(3)}` : "—"}
          </div>
          <div className="text-text-t4 text-2xs">EV/t</div>
        </div>
        <div>
          <div className={`text-sm font-bold tabular-nums ${wrColor}`}>
            {row.winRate.toFixed(0)}%
          </div>
          <div className="text-text-t4 text-2xs">WR</div>
        </div>
        <div>
          <div className={`text-sm font-bold tabular-nums ${
            row.sharpe !== null && row.sharpe > 0.5 ? "text-green-400" :
            row.sharpe !== null && row.sharpe > 0 ? "text-yellow-400" :
            row.sharpe !== null ? "text-red-400" : "text-text-t4"
          }`}>
            {row.sharpe !== null ? row.sharpe.toFixed(2) : "—"}
          </div>
          <div className="text-text-t4 text-2xs">Sharpe</div>
        </div>
        <div>
          <div className={`text-sm font-bold tabular-nums ${pfColor}`}>
            {row.profitFactor !== null ? row.profitFactor.toFixed(2) : "—"}
          </div>
          <div className="text-text-t4 text-2xs">PF</div>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-2xs text-text-t4">
        <span>{row.totalTrades}t</span>
        <span>▲{row.longWinRate !== null ? `${row.longWinRate.toFixed(0)}%` : "—"}</span>
        <span>▼{row.shortWinRate !== null ? `${row.shortWinRate.toFixed(0)}%` : "—"}</span>
        <span className="ml-auto">MaxDD {row.maxDrawdownR.toFixed(1)}R</span>
      </div>
    </div>
  );
}
