"use client";

import { useMemo } from "react";
import { computeDiscipline } from "@/lib/trades/selectors";
import type { TradeRecord } from "@/lib/pnl/types";
import type { TradeSnapshot, ExitReason } from "@/lib/trades/types";

interface Props {
  trades: readonly TradeRecord[];
}

/**
 * TradeRecord → TradeSnapshot adapter.
 *
 * TradeRecord is a flat projection used by all pnl cards. computeDiscipline
 * expects nested TradeSnapshot fields. This adapter re-wraps flat fields
 * into the nested shape without touching filter logic.
 *
 * Stubs for unused fields (entryPrice, qty, leverage, stopPrice,
 * riskAmountUsd): computeDiscipline never reads these — safe to zero.
 *
 * openedAt: optional in TradeRecord. Falls back to closedAt so
 * holdingSec = 0 (neutral) rather than NaN.
 *
 * closeReason: TradeRecord type omits "equity_halt" from its union
 * (type definition gap — runtime value can be "equity_halt" from the
 * page.tsx mapping). Cast to ExitReason preserves runtime value.
 * Unknown/undefined reason defaults to "manual" (conservative).
 */
function toSnapshot(r: TradeRecord): TradeSnapshot {
  const openedAt = r.openedAt ?? r.closedAt;
  return {
    id: `${r.pair}_${r.direction}_${openedAt}`,
    pair: r.pair,
    direction: r.direction,
    status: "closed",
    openedAt,
    entryPrice: 0,
    qty: 0,
    leverage: 1,
    stopPrice: 0,
    riskAmountUsd: 0,
    isPaper: r.isPaper ?? false,
    entryContext: {
      score: r.score ?? 0,
      verdict: "go",
    },
    exit: {
      closedAt: r.closedAt,
      exitPrice: 0,
      reason: (r.closeReason ?? "manual") as ExitReason,
      pnlUsd: r.pnlUsd,
      pnlPct: r.pnlPct ?? 0,
      holdingSec: Math.max(0, Math.floor((r.closedAt - openedAt) / 1000)),
      rMultiple: r.rMultiple,
    },
  };
}

export function DisciplineCard({ trades }: Props): React.ReactElement | null {
  const discipline = useMemo(() => {
    if (trades.length < 3) return null;
    return computeDiscipline(trades.map(toSnapshot));
  }, [trades]);

  if (!discipline) return null;

  const planRate = 1 - discipline.manualExitRate;
  const planPct = Math.round(planRate * 100);
  const planColor =
    planRate >= 0.85
      ? "text-green-400"
      : planRate >= 0.6
        ? "text-signal-amber"
        : "text-red-400";
  const barColor =
    planRate >= 0.85
      ? "bg-green-400"
      : planRate >= 0.6
        ? "bg-signal-amber"
        : "bg-red-400";

  const { avgScoreWin, avgScoreLoss } = discipline.scoreOutcomeCorrelation;
  const scoreDiff =
    avgScoreWin !== null && avgScoreLoss !== null
      ? avgScoreWin - avgScoreLoss
      : null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t1 mb-3 text-sm font-medium">Disiplin</h3>
      <div className="grid grid-cols-3 gap-4">

        {/* Plan Uyumu — manual çıkış oranının tersi */}
        <div>
          <p className="text-text-t3 mb-1 text-xs">Plan Uyumu</p>
          <p className={`font-mono text-xl font-bold tabular-nums ${planColor}`}>
            {planPct}%
          </p>
          <div className="mt-1.5 h-1 rounded-full bg-border/50">
            <div
              className={`h-1 rounded-full transition-all ${barColor}`}
              style={{ width: `${planPct}%` }}
            />
          </div>
          <p className="text-text-t4 mt-1 font-mono text-[10px]">
            {Math.round(discipline.manualExitRate * 100)}% manuel çıkış
          </p>
        </div>

        {/* Skor Etkinliği — kazanan vs kaybeden ort. skor */}
        <div>
          <p className="text-text-t3 mb-1 text-xs">Skor Etkinliği</p>
          {avgScoreWin !== null && avgScoreLoss !== null ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-base font-bold tabular-nums text-green-400">
                  {Math.round(avgScoreWin)}
                </span>
                <span className="text-text-t4 font-mono text-[10px]">kazanan</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-base font-bold tabular-nums text-red-400">
                  {Math.round(avgScoreLoss)}
                </span>
                <span className="text-text-t4 font-mono text-[10px]">kaybeden</span>
              </div>
              {scoreDiff !== null && (
                <p
                  className={`mt-0.5 font-mono text-[10px] ${
                    scoreDiff > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {scoreDiff > 0 ? "+" : ""}
                  {Math.round(scoreDiff)} puan fark
                </p>
              )}
            </div>
          ) : (
            <p className="text-text-t4 mt-2 font-mono text-xs">—</p>
          )}
        </div>

        {/* Equity Halt sayısı */}
        <div>
          <p className="text-text-t3 mb-1 text-xs">Equity Halt</p>
          <p
            className={`font-mono text-xl font-bold tabular-nums ${
              discipline.equityHaltCount === 0 ? "text-green-400" : "text-signal-amber"
            }`}
          >
            {discipline.equityHaltCount}×
          </p>
          <p className="text-text-t4 mt-1 font-mono text-[10px]">
            {discipline.equityHaltCount === 0 ? "devre dışı kalmadı" : "zorla kapandı"}
          </p>
        </div>

      </div>
    </div>
  );
}
