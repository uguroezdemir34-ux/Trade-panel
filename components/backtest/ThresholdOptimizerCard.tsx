"use client";

/**
 * THRESHOLD OPTIMIZER CARD — Backtest sonuçlarından optimal eşik analizi.
 *
 * Her skor eşiği için: trade sayısı, win rate, EV (R ve %) gösterir.
 * Optimal eşiği ★ ile işaretler, mevcut eşiği ← ile gösterir.
 */

import { useMemo } from "react";
import { optimizeThreshold } from "@/lib/ml/thresholdOptimizer";
import type { BacktestResult } from "@/lib/backtest/types";

interface Props {
  result: BacktestResult;
  /** Mevcut minScore ayarı (default 70) */
  currentThreshold?: number;
}

export function ThresholdOptimizerCard({ result, currentThreshold = 70 }: Props) {
  const opt = useMemo(
    () => optimizeThreshold(result.trades, currentThreshold),
    [result.trades, currentThreshold],
  );

  const { curve, optimal, currentPoint, totalTrades } = opt;

  const evDiff =
    optimal && currentPoint && optimal.evR !== null && currentPoint.evR !== null
      ? optimal.evR - currentPoint.evR
      : null;

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="font-mono text-sm font-semibold text-text-t1 tracking-wider">
            📊 Score Threshold Optimizer
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-t4">
            Optimal entry score cutoff from {totalTrades} backtest trades · min 10 trades/threshold
          </div>
        </div>
        {optimal && (
          <div className="text-right shrink-0 ml-4">
            <div className="font-mono text-2xs text-text-t4">Optimal</div>
            <div className="font-mono text-2xl font-bold text-brand tabular-nums">
              {optimal.threshold}
            </div>
            {optimal.winRate !== null && (
              <div className="font-mono text-2xs text-text-t4">
                {(optimal.winRate * 100).toFixed(0)}% WR
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <SummaryBox
          label="Current"
          value={String(currentThreshold)}
          sub={currentPoint?.evR !== null && currentPoint?.evR !== undefined
            ? `EV: ${currentPoint.evR > 0 ? "+" : ""}${currentPoint.evR.toFixed(2)}R`
            : "—"}
        />
        <SummaryBox
          label="Optimal ★"
          value={optimal ? String(optimal.threshold) : "—"}
          sub={optimal?.evR !== null && optimal?.evR !== undefined
            ? `EV: ${optimal.evR > 0 ? "+" : ""}${optimal.evR.toFixed(2)}R`
            : "—"}
          highlight={!!optimal}
        />
        <SummaryBox
          label="EV Improvement"
          value={evDiff !== null
            ? `${evDiff >= 0 ? "+" : ""}${evDiff.toFixed(2)}R`
            : "—"}
          sub={optimal ? `${optimal.tradeCount} trades` : ""}
          color={evDiff !== null
            ? evDiff > 0 ? "text-signal-green" : evDiff < 0 ? "text-signal-red" : undefined
            : undefined}
        />
      </div>

      {/* Curve table */}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full font-mono text-2xs">
          <thead>
            <tr className="border-b border-border bg-surface-s1 text-text-t4">
              <th className="px-3 py-2 text-left">Score ≥</th>
              <th className="px-3 py-2 text-right">Trades</th>
              <th className="px-3 py-2 text-right">Win%</th>
              <th className="px-3 py-2 text-right">AvgWin R</th>
              <th className="px-3 py-2 text-right">AvgLoss R</th>
              <th className="px-3 py-2 text-right font-bold">EV (R)</th>
            </tr>
          </thead>
          <tbody>
            {curve.map((p) => {
              const isOptimal  = optimal  && p.threshold === optimal.threshold;
              const isCurrent  = currentPoint && p.threshold === currentPoint.threshold;
              const isInsufficient = p.tradeCount > 0 && p.tradeCount < 10;

              return (
                <tr
                  key={p.threshold}
                  className={`border-b border-border/30 transition-colors ${
                    isOptimal
                      ? "bg-brand/8 text-brand"
                      : isCurrent
                      ? "bg-surface-s1"
                      : isInsufficient
                      ? "opacity-40"
                      : ""
                  }`}
                >
                  <td className="px-3 py-1.5 font-bold tabular-nums">
                    {p.threshold}
                    {isOptimal && <span className="ml-1.5 text-brand">★</span>}
                    {isCurrent && !isOptimal && <span className="ml-1.5 text-text-t4">←</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-text-t2">
                    {p.tradeCount}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.winRate !== null
                      ? `${(p.winRate * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-signal-green">
                    {p.avgWinR !== null && p.avgWinR > 0
                      ? `+${p.avgWinR.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-signal-red">
                    {p.avgLossR !== null && p.avgLossR > 0
                      ? `-${p.avgLossR.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-bold ${
                    p.evR === null ? "text-text-t4" :
                    p.evR > 0 ? "text-signal-green" :
                    p.evR < 0 ? "text-signal-red" : "text-text-t3"
                  }`}>
                    {p.evR !== null
                      ? `${p.evR > 0 ? "+" : ""}${p.evR.toFixed(2)}R`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 font-mono text-2xs text-text-t4">
        ⚠ Backtest EV ≠ canlı performans. Slippage ve düşük likidite modellenemez.
        Grayed rows: &lt;10 trade (istatistiksel olarak güvenilmez).
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  sub,
  highlight,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div
      className={`rounded border p-2.5 ${
        highlight ? "border-brand/40 bg-brand/5" : "border-border bg-surface-s1"
      }`}
    >
      <div className="font-mono text-2xs text-text-t4">{label}</div>
      <div
        className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
          color ?? (highlight ? "text-brand" : "text-text-t1")
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-2xs text-text-t4">{sub}</div>
      )}
    </div>
  );
}
