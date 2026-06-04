"use client";

/**
 * BACKTEST TEMPORAL CARD — Temporal consistency check for backtest results.
 *
 * Splits the trade sequence into 3 equal time periods (Early / Middle / Late)
 * and computes win rate + avg R per period. Helps identify if performance
 * degrades over time (sign of overfitting to a specific market regime).
 *
 * A healthy strategy shows consistent metrics across all three periods.
 * Significant divergence suggests regime sensitivity.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { BacktestTrade } from "@/lib/backtest/types";

interface Props {
  trades: readonly BacktestTrade[];
}

interface PeriodStats {
  label: string;
  start: number;
  end: number;
  total: number;
  wins: number;
  winRate: number | null;
  avgR: number | null;
}

function computePeriods(trades: readonly BacktestTrade[], labels: [string, string, string]): PeriodStats[] | null {
  if (trades.length < 9) return null; // need at least 3 per period

  const sorted = [...trades].sort((a, b) => a.entryTs - b.entryTs);
  const n = sorted.length;
  const sliceSize = Math.floor(n / 3);

  const slices = [
    sorted.slice(0, sliceSize),
    sorted.slice(sliceSize, sliceSize * 2),
    sorted.slice(sliceSize * 2),
  ];

  return slices.map((slice, i) => {
    const wins = slice.filter((t) => t.rMultiple > 0).length;
    const rVals = slice.map((t) => t.rMultiple);
    const avgR = rVals.length > 0 ? rVals.reduce((s, r) => s + r, 0) / rVals.length : null;
    return {
      label: labels[i],
      start: slice[0]?.entryTs ?? 0,
      end: slice[slice.length - 1]?.entryTs ?? 0,
      total: slice.length,
      wins,
      winRate: slice.length > 0 ? (wins / slice.length) * 100 : null,
      avgR,
    };
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
}

export function BacktestTemporalCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const periodLabels: [string, string, string] = [
    t("backtest.temporalEarly"),
    t("backtest.temporalMiddle"),
    t("backtest.temporalLate"),
  ];
  const periods = useMemo(() => computePeriods(trades, periodLabels), [trades, t]);

  if (!periods) return null;

  const wrValues = periods.map((p) => p.winRate ?? 0);
  const maxWr = Math.max(...wrValues, 1);
  const minWr = Math.min(...wrValues);
  const wrSpread = maxWr - minWr;

  const isConsistent = wrSpread < 15;
  const isDiverging =
    (periods[2].winRate ?? 0) < (periods[0].winRate ?? 0) - 15;

  const statusColor = isConsistent
    ? "text-signal-green"
    : isDiverging
    ? "text-signal-red"
    : "text-amber-400";
  const statusText = isConsistent
    ? t("backtest.temporalConsistent")
    : isDiverging
    ? t("backtest.temporalDiverging")
    : t("backtest.temporalMedium");

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("backtest.temporalTitle")}
        </h3>
        <span className={`font-mono text-2xs ${statusColor}`}>{statusText}</span>
      </div>

      <div className="flex flex-col gap-2">
        {periods.map((p, i) => {
          const wr = p.winRate ?? 0;
          const wrColor =
            wr >= 55 ? "text-signal-green" : wr >= 45 ? "text-amber-400" : "text-signal-red";
          const barFill = (wr / 100) * 100;
          const rColor =
            (p.avgR ?? 0) > 0 ? "text-signal-green" : "text-signal-red";

          return (
            <div key={i}>
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3">
                <span className="text-text-t3 font-mono text-xs w-12">{p.label}</span>
                <div className="h-1.5 overflow-hidden rounded bg-border/30">
                  <div
                    className={`h-full rounded ${wr >= 50 ? "bg-signal-green/60" : "bg-signal-red/60"}`}
                    style={{ width: `${barFill}%` }}
                  />
                </div>
                <span className={`font-mono text-xs tabular-nums w-12 text-right ${wrColor}`}>
                  {wr.toFixed(0)}% WR
                </span>
                <span className={`font-mono text-xs tabular-nums w-14 text-right ${rColor}`}>
                  {p.avgR !== null ? `${p.avgR > 0 ? "+" : ""}${p.avgR.toFixed(2)}R` : "—"}
                </span>
              </div>
              <div className="text-text-t4 font-mono text-2xs ml-12 mt-0.5">
                {formatDate(p.start)} – {formatDate(p.end)} · {p.total}T
              </div>
            </div>
          );
        })}
      </div>

      {wrSpread >= 15 && (
        <div className="mt-3 border-t border-border pt-2 text-text-t4 font-mono text-2xs leading-relaxed">
          {t("backtest.temporalWrSpread").replace("{n}", wrSpread.toFixed(0))}
        </div>
      )}
    </div>
  );
}
