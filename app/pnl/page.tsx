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
import { MonthlyBreakdown } from "@/components/pnl/MonthlyBreakdown";
import { PnlDistribution } from "@/components/pnl/PnlDistribution";
import { TopTradesCard } from "@/components/pnl/TopTradesCard";
import { PairBreakdownCard } from "@/components/pnl/PairBreakdownCard";
import { ExitBreakdownCard } from "@/components/pnl/ExitBreakdownCard";
import { ScoreHeatmap } from "@/components/pnl/ScoreHeatmap";
import { HoldingTimeCard } from "@/components/pnl/HoldingTimeCard";
import { DayOfWeekCard } from "@/components/pnl/DayOfWeekCard";
import { TimeOfDayCard } from "@/components/pnl/TimeOfDayCard";
import { RMultipleChart } from "@/components/pnl/RMultipleChart";
import { PairEvLeaderboard } from "@/components/pnl/PairEvLeaderboard";
import { EntryQualityChart } from "@/components/pnl/EntryQualityChart";
import { TradeInsightsCard } from "@/components/pnl/TradeInsightsCard";
import { computePnlStats } from "@/lib/pnl/stats";
import { computeDailyAggregates, fillMissingDays } from "@/lib/pnl/compute";
import { computeEquityCurve } from "@/lib/pnl/equity";
import { computeWeeklyAggregates } from "@/lib/pnl/weekly";
import { computeMonthlyAggregates } from "@/lib/pnl/monthly";
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
          rMultiple: t.exit!.rMultiple,
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
  const monthlyAggs = useMemo(() => computeMonthlyAggregates(trades), [trades]);

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

  function downloadCsv() {
    if (trades.length === 0) return;
    const header = "closedAt,openedAt,pair,direction,pnlUsd,pnlPct,rMultiple,score,closeReason,isPaper";
    const rows = trades.map((t) =>
      [
        new Date(t.closedAt).toISOString(),
        t.openedAt ? new Date(t.openedAt).toISOString() : "",
        t.pair,
        t.direction,
        t.pnlUsd.toFixed(4),
        (t.pnlPct ?? "").toString(),
        t.rMultiple !== undefined ? t.rMultiple.toFixed(4) : "",
        (t.score ?? "").toString(),
        t.closeReason ?? "",
        t.isPaper ? "true" : "false",
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl_${filter}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Filter tabs + export — header row */}
      <div className="flex items-center gap-2">
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
        {trades.length > 0 && (
          <button
            onClick={downloadCsv}
            className="ml-auto text-text-t4 font-mono text-2xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors"
          >
            ↓ CSV ({trades.length})
          </button>
        )}
      </div>

      <PnlSummaryRow trades={trades} />
      <PnlStatsCard stats={stats} />
      <TradeInsightsCard trades={trades} />

      {/* FT comparison — shown when paper trades exist (always uses allTrades for full picture) */}
      <FtComparison trades={allTrades} />

      {/* Equity curve + weekly side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EquityCurve points={equityPoints} />
        <WeeklySummary weeks={weeklyAggs} />
      </div>

      <PnlCalendar aggregates={calendarAggregates} maxAbsPnl={maxAbsPnl} />

      {/* Monthly + distribution side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyBreakdown months={monthlyAggs} />
        <PnlDistribution trades={trades} />
      </div>

      <RMultipleChart trades={trades} />

      <TopTradesCard trades={trades} />
      <PairBreakdownCard trades={trades} />

      {/* Exit + Score side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExitBreakdownCard trades={trades} />
        <ScoreHeatmap trades={trades} />
      </div>

      {/* Holding time + Day of week side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HoldingTimeCard trades={trades} />
        <DayOfWeekCard trades={trades} />
      </div>

      {/* Time of day */}
      <TimeOfDayCard trades={trades} />

      {/* Entry quality + pair EV side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EntryQualityChart trades={trades} />
        <PairEvLeaderboard trades={trades} />
      </div>

      <ParameterAudit stats={calibrationStats} />
    </div>
  );
}
