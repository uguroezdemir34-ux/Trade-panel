"use client";

/**
 * HOLDING TIME CARD — Avg hold duration for winners vs losers.
 *
 * Requires trades with both openedAt and closedAt set.
 * Shows avg hold time (winners / losers) and a distribution
 * histogram bucketed by duration.
 *
 * Hidden if fewer than 3 trades have holding time data.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const BUCKETS = [
  { label: "< 1h",   maxH: 1   },
  { label: "1-4h",   maxH: 4   },
  { label: "4-8h",   maxH: 8   },
  { label: "8-24h",  maxH: 24  },
  { label: "> 24h",  maxH: Infinity },
];

function fmtDuration(ms: number): string {
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export function HoldingTimeCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const data = useMemo(() => {
    const timed = trades.filter(
      (t) => typeof t.openedAt === "number" && typeof t.closedAt === "number" && t.closedAt > t.openedAt,
    );
    if (timed.length < 3) return null;

    const winners = timed.filter((t) => t.pnlUsd > 0);
    const losers  = timed.filter((t) => t.pnlUsd < 0);

    const avgMs = (arr: typeof timed) =>
      arr.length === 0 ? null : arr.reduce((s, t) => s + (t.closedAt - t.openedAt!), 0) / arr.length;

    const avgWin  = avgMs(winners);
    const avgLoss = avgMs(losers);
    const avgAll  = avgMs(timed);

    // Histogram
    type BucketRow = { label: string; wins: number; losses: number; total: number };
    const hist: BucketRow[] = BUCKETS.map((b) => ({ label: b.label, wins: 0, losses: 0, total: 0 }));

    for (const t of timed) {
      const holdH = (t.closedAt - t.openedAt!) / 3600000;
      for (let i = 0; i < BUCKETS.length; i++) {
        if (holdH < BUCKETS[i].maxH) {
          hist[i].total++;
          if (t.pnlUsd > 0) hist[i].wins++;
          else hist[i].losses++;
          break;
        }
      }
    }

    const maxTotal = Math.max(...hist.map((b) => b.total), 1);

    return { avgWin, avgLoss, avgAll, hist, maxTotal, timed: timed.length };
  }, [trades]);

  if (!data) return null;

  const { avgWin, avgLoss, avgAll, hist, maxTotal, timed } = data;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          ⏱ {t("pnl.holdingTime.title")}
        </h3>
        <span className="text-text-t4 font-mono text-2xs">{timed} trades</span>
      </div>

      {/* Avg stats row */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <Stat label={t("pnl.holdingTime.all")} value={avgAll ? fmtDuration(avgAll) : "—"} color="text-text-t2" />
        <Stat label={t("pnl.holdingTime.winners")} value={avgWin ? fmtDuration(avgWin) : "—"} color="text-green-400" />
        <Stat label={t("pnl.holdingTime.losers")}  value={avgLoss ? fmtDuration(avgLoss) : "—"} color="text-red-400" />
        {avgWin !== null && avgLoss !== null && (
          <Stat
            label={t("pnl.holdingTime.wlRatio")}
            value={`${(avgWin / avgLoss).toFixed(2)}×`}
            color={avgWin > avgLoss ? "text-green-400" : "text-red-400"}
          />
        )}
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1.5" style={{ height: 72 }}>
        {hist.map((b) => {
          const totalH = b.total === 0 ? 0 : (b.total / maxTotal) * 100;
          const winFrac = b.total === 0 ? 0 : b.wins / b.total;

          return (
            <div key={b.label} className="flex flex-col items-center flex-1 h-full justify-end gap-0.5">
              {b.total > 0 && (
                <span className="font-mono tabular-nums text-text-t4" style={{ fontSize: 8 }}>
                  {b.total}
                </span>
              )}
              <div
                className="w-full rounded-sm overflow-hidden"
                style={{ height: `${Math.max(totalH, b.total > 0 ? 6 : 0)}%`, minHeight: b.total > 0 ? 4 : 0 }}
              >
                {/* stacked: wins on top (green), losses on bottom (red) */}
                <div className="w-full h-full flex flex-col-reverse">
                  <div
                    className="w-full bg-red-500/70"
                    style={{ flex: 1 - winFrac }}
                  />
                  <div
                    className="w-full bg-green-500/70"
                    style={{ flex: winFrac }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="mt-1 flex gap-1.5">
        {hist.map((b) => (
          <div
            key={b.label}
            className="flex-1 text-center text-text-t4 font-mono"
            style={{ fontSize: 7 }}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-t4 font-mono text-2xs">{label}</span>
      <span className={`font-mono text-xs font-semibold ${color}`}>{value}</span>
    </div>
  );
}
