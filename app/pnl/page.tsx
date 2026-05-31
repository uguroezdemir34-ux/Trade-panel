"use client";

import { useMemo, useEffect } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { PnlStatsCard } from "@/components/pnl/PnlStatsCard";
import { PnlSummaryRow } from "@/components/pnl/PnlSummaryRow";
import { PnlCalendar } from "@/components/pnl/PnlCalendar";
import { EquityCurve } from "@/components/pnl/EquityCurve";
import { WeeklySummary } from "@/components/pnl/WeeklySummary";
import { ParameterAudit } from "@/components/pnl/ParameterAudit";
import { computePnlStats } from "@/lib/pnl/stats";
import { computeDailyAggregates, fillMissingDays } from "@/lib/pnl/compute";
import { computeEquityCurve } from "@/lib/pnl/equity";
import { computeWeeklyAggregates } from "@/lib/pnl/weekly";
import { computeCalibrationStats } from "@/lib/pnl/calibration";
import type { TradeRecord } from "@/lib/pnl/types";

export default function PnlPage() {
  const snapshots = useTradesStore((s) => s.trades);
  const archivedSnapshots = useTradesStore((s) => s.archivedTrades);
  const getArchivedTrades = useTradesStore((s) => s.getArchivedTrades);

  // Lazy-load archived trades from localStorage on first visit to this page
  useEffect(() => {
    if (archivedSnapshots.length === 0) getArchivedTrades();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trades: TradeRecord[] = useMemo(
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
      <PnlSummaryRow trades={trades} />
      <PnlStatsCard stats={stats} />

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
