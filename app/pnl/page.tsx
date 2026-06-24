"use client";

import { useMemo, useEffect, useState } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useT } from "@/lib/i18n/context";
import { PAIRS } from "@/lib/constants/pairs";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
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
import { SessionBreakdownCard } from "@/components/pnl/SessionBreakdownCard";
import { StreakCard } from "@/components/pnl/StreakCard";
import { MonteCarloCard } from "@/components/pnl/MonteCarloCard";
import { TradeJournalCard } from "@/components/pnl/TradeJournalCard";
import { ReconcileCard } from "@/components/pnl/ReconcileCard";
import { DisciplineCard } from "@/components/pnl/DisciplineCard";
import { computePnlStats } from "@/lib/pnl/stats";
import { computeDailyAggregates, fillMissingDays } from "@/lib/pnl/compute";
import { computeEquityCurve } from "@/lib/pnl/equity";
import { computeWeeklyAggregates } from "@/lib/pnl/weekly";
import { computeMonthlyAggregates } from "@/lib/pnl/monthly";
import { computeCalibrationStats } from "@/lib/pnl/calibration";
import type { TradeRecord } from "@/lib/pnl/types";

type TradeFilter = "all" | "live" | "paper";
type DateRange = "7d" | "30d" | "90d" | "all";

const DATE_RANGES: DateRange[] = ["7d", "30d", "90d", "all"];
const DATE_RANGE_MS: Record<DateRange, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  all: 0,
};

function PnlPageInner() {
  const t = useT();
  const snapshots = useTradesStore((s) => s.trades);
  const archivedSnapshots = useTradesStore((s) => s.archivedTrades);
  const getArchivedTrades = useTradesStore((s) => s.getArchivedTrades);
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [pairFilter, setPairFilter] = useState<string>("ALL");

  const DATE_RANGE_LABELS = useMemo<Record<DateRange, string>>(
    () => ({
      "7d": t("pnl.filter.days7"),
      "30d": t("pnl.filter.days30"),
      "90d": t("pnl.filter.days90"),
      all: t("pnl.filter.allTime"),
    }),
    [t],
  );

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
    const cutoff = dateRange !== "all" ? Date.now() - DATE_RANGE_MS[dateRange] : 0;
    return allTrades.filter((tr) => {
      if (filter === "live" && tr.isPaper) return false;
      if (filter === "paper" && !tr.isPaper) return false;
      if (dateRange !== "all" && tr.closedAt < cutoff) return false;
      if (pairFilter !== "ALL" && tr.pair !== pairFilter) return false;
      return true;
    });
  }, [allTrades, filter, dateRange, pairFilter]);

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
    const cutoff = dateRange !== "all" ? Date.now() - DATE_RANGE_MS[dateRange] : 0;
    const csvSnaps = [...snapshots, ...archivedSnapshots].filter((t) => {
      if (t.status !== "closed" || !t.exit) return false;
      if (filter === "live" && t.isPaper) return false;
      if (filter === "paper" && !t.isPaper) return false;
      if (dateRange !== "all" && t.exit.closedAt < cutoff) return false;
      if (pairFilter !== "ALL" && t.pair !== pairFilter) return false;
      return true;
    });
    if (csvSnaps.length === 0) return;
    const header = "closedAt,openedAt,pair,direction,pnlUsd,pnlPct,rMultiple,score,closeReason,isPaper,notes";
    const rows = csvSnaps.map((t) => {
      const notesCsv = t.notes ? `"${t.notes.replace(/"/g, '""')}"` : "";
      return [
        new Date(t.exit!.closedAt).toISOString(),
        new Date(t.openedAt).toISOString(),
        t.pair,
        t.direction,
        t.exit!.pnlUsd.toFixed(4),
        t.exit!.pnlPct.toString(),
        t.exit!.rMultiple !== undefined ? t.exit!.rMultiple.toFixed(4) : "",
        t.entryContext.score.toString(),
        t.exit!.reason,
        t.isPaper ? "true" : "false",
        notesCsv,
      ].join(",");
    });
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
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <div className="flex gap-1">
          {DATE_RANGES.map((dr) => (
            <button
              key={dr}
              onClick={() => setDateRange(dr)}
              className={`rounded px-2.5 py-1 font-mono text-xs tracking-wider transition-colors ${
                dateRange === dr
                  ? "bg-surface-s2 text-text-t1"
                  : "text-text-t3 hover:text-text-t2"
              }`}
            >
              {DATE_RANGE_LABELS[dr]}
            </button>
          ))}
        </div>

        {/* Pair filter */}
        <select
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value)}
          className="bg-surface-s1 border border-border rounded px-2 py-1 font-mono text-xs text-text-t2 focus:outline-none focus:border-brand cursor-pointer"
        >
          <option value="ALL">{t("pnl.filter.allPairs")}</option>
          {PAIRS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Paper/Live filter */}
        {hasPaperTrades && (
          <div className="flex gap-1">
            {(["all", "live", "paper"] as TradeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-2.5 py-1 font-mono text-xs tracking-wider transition-colors ${
                  filter === f
                    ? "bg-surface-s2 text-text-t1"
                    : "text-text-t3 hover:text-text-t2"
                }`}
              >
                {f === "paper" ? "FWD" : f.toUpperCase()}
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

      <ReconcileCard />

      <PnlSummaryRow trades={trades} />

      {/* Stats + Streak */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
        <PnlStatsCard stats={stats} />
        <StreakCard trades={trades} />
      </div>

      {/* Insights + FT Comparison */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TradeInsightsCard trades={trades} />
        <FtComparison trades={allTrades} />
      </div>

      {/* Equity + Weekly */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EquityCurve points={equityPoints} />
        <WeeklySummary weeks={weeklyAggs} />
      </div>

      {/* Calendar + Monthly */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <PnlCalendar aggregates={calendarAggregates} maxAbsPnl={maxAbsPnl} />
        <MonthlyBreakdown months={monthlyAggs} />
      </div>

      {/* Distribution + R-Multiple */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <PnlDistribution trades={trades} />
        <RMultipleChart trades={trades} />
      </div>

      {/* Top Trades + Pair Breakdown */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TopTradesCard trades={trades} />
        <PairBreakdownCard trades={trades} />
      </div>

      {/* Exit + Score Heatmap */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ExitBreakdownCard trades={trades} />
        <ScoreHeatmap trades={trades} />
      </div>

      {/* Holding + Day of Week */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <HoldingTimeCard trades={trades} />
        <DayOfWeekCard trades={trades} />
      </div>

      {/* Time of Day + Session */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TimeOfDayCard trades={trades} />
        <SessionBreakdownCard trades={trades} />
      </div>

      {/* Monte Carlo + Entry Quality */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MonteCarloCard trades={trades} />
        <EntryQualityChart trades={trades} />
      </div>

      {/* EV Leaderboard + Journal */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <PairEvLeaderboard trades={trades} />
        <TradeJournalCard />
      </div>

      <DisciplineCard trades={trades} />
      <ParameterAudit stats={calibrationStats} />
    </div>
  );
}

export default function PnlPage() {
  return (
    <SubscriptionGate feature="pnlAnalytics">
      <PnlPageInner />
    </SubscriptionGate>
  );
}
