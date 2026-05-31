"use client";

import { useMemo, useEffect, useState } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { PnlStatsCard } from "@/components/pnl/PnlStatsCard";
import { PnlSummaryRow } from "@/components/pnl/PnlSummaryRow";
import { PnlCalendar } from "@/components/pnl/PnlCalendar";
import { EquityCurve } from "@/components/pnl/EquityCurve";
import { WeeklySummary } from "@/components/pnl/WeeklySummary";
import { ParameterAudit } from "@/components/pnl/ParameterAudit";
import { FtComparison } from "@/components/pnl/FtComparison";
import { computePnlStats } from "@/lib/pnl/stats";
import { computeDailyAggregates, fillMissingDays } from "@/lib/pnl/compute";
import { computeEquityCurve } from "@/lib/pnl/equity";
import { computeWeeklyAggregates } from "@/lib/pnl/weekly";
import { computeCalibrationStats } from "@/lib/pnl/calibration";
import type { TradeRecord } from "@/lib/pnl/types";

type TradeFilter = "all" | "live" | "paper";

export default function PnlPage() {
  const snapshots = useTradesStore((s) => s.trades);
  const archivedSnapshots = useTradesStore((s) => s.archivedTrades);
  const getArchivedTrades = useTradesStore((s) => s.getArchivedTrades);
  const [filter, setFilter] = useState<TradeFilter>("all");

  // Lazy-load archived trades from localStorage on first visit to this page
  useEffect(() => {
    if (archivedSnapshots.length === 0) getArchivedTrades();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTrades: TradeRecord[] = useMemo(
    () =>
      snapshots
        .filter((t) => t.status === "closed" && t.exit != null)
        .map((t) => ({
          closedAt: t.exit!.closedAt,
          openedAt: t.openedAt,
          pair: t.pair,
          direction: t.direction,
          pnlUsd: t.exit!.pnlUsd,
          pnlPct: t.exit!.pnlPct,
          score: t.entryContext.score,
          closeReason: t.exit!.reason,
          isPaper: t.isPaper,
        })),
    [snapshots],
  );

  const hasPaperTrades = useMemo(
    () => allTrades.some((t) => t.isPaper === true),
    [allTrades],
  );

  const trades: TradeRecord[] = useMemo(() => {
    if (filter === "live") return allTrades.filter((t) => !t.isPaper);
    if (filter === "paper") return allTrades.filter((t) => t.isPaper === true);
    return allTrades;
  }, [allTrades, filter]);

  const stats = useMemo(() => computePnlStats(trades), [trades]);
  const equityPoints = useMemo(() => computeEquityCurve(trades), [trades]);
  const weeklyAggs = useMemo(() => computeWeeklyAggregates(trades, 8), [trades]);

  const aggregates = useMemo(() => computeDailyAggregates(trades), [trades]);
  const calendarAggregates = useMemo(
    () => fillMissingDays(aggregates, Date.now(), 30),
    [aggregates],
  );
  const maxAbsPnl = useMemo(
    () => calendarAggregates.reduce((m, d) => Math.max(m, Math.abs(d.totalPnlUsd)), 1),
    [calendarAggregates],
  );

  // All closed snapshots (live + archived) for calibration — richer than TradeRecord
  const allSnapshots = useMemo(
    () => [...snapshots, ...archivedSnapshots],
    [snapshots, archivedSnapshots],
  );
  const calibrationStats = useMemo(
    () => computeCalibrationStats(allSnapshots),
    [allSnapshots],
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Filter tabs — only shown when paper trades exist */}
      {hasPaperTrades && (
        <div className="flex gap-1">
          {(["all", "live", "paper"] as TradeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 font-mono text-xs font-medium tracking-widest uppercase transition-colors ${
                filter === f
                  ? "bg-surface-s2 text-text-t1"
                  : "text-text-t3 hover:text-text-t2"
              }`}
            >
              {f === "paper" ? "FWD Test" : f}
            </button>
          ))}
        </div>
      )}

      <PnlSummaryRow trades={trades} />
      <PnlStatsCard stats={stats} />

      {/* FT comparison — shown when paper trades exist (always uses allTrades for full picture) */}
      <FtComparison trades={allTrades} />

      {/* Equity curve + weekly side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EquityCurve points={equityPoints} />
        <WeeklySummary weeks={weeklyAggs} />
      </div>

      <PnlCalendar aggregates={calendarAggregates} maxAbsPnl={maxAbsPnl} />

      <ParameterAudit stats={calibrationStats} />
    </div>
  );
}
