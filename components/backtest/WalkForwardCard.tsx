"use client";

/**
 * WALK-FORWARD CARD — Rolling IS/OOS window analysis on existing trades.
 *
 * Optimizes minScore threshold on in-sample, evaluates on out-of-sample.
 * Measures parameter stability and overfit risk across time.
 */

import { useMemo, useState } from "react";
import { runWalkForward } from "@/lib/backtest/walkForward";
import type { BacktestResult } from "@/lib/backtest/types";

interface Props {
  result: BacktestResult;
}

const CONCLUSION_META = {
  robust: {
    label: "ROBUST",
    color: "text-signal-green",
    bg: "border-signal-green/30 bg-signal-green/5",
    desc: "Parameters degrade ≤50% from IS to OOS — acceptable stability.",
  },
  overfit: {
    label: "OVERFIT RISK",
    color: "text-signal-red",
    bg: "border-signal-red/30 bg-signal-red/5",
    desc: "IS EV degrades >50% on OOS — parameters over-fitted to historical noise.",
  },
  insufficient: {
    label: "INSUFFICIENT DATA",
    color: "text-text-t4",
    bg: "border-border bg-transparent",
    desc: "Too few trades per window for reliable WFO (need ≥20 trades total).",
  },
} as const;

export function WalkForwardCard({ result }: Props) {
  const [nWindows, setNWindows] = useState<3 | 4>(4);

  const minScoreCandidates = useMemo(() => {
    if (result.trades.length === 0) return [70, 75, 80, 85, 90];
    const minInData = Math.min(...result.trades.map((t) => t.score));
    const base = Math.max(60, Math.floor(minInData / 5) * 5);
    return [base, base + 5, base + 10, base + 15, base + 20].filter((s) => s <= 95);
  }, [result.trades]);

  const wfo = useMemo(
    () => runWalkForward(result.trades, minScoreCandidates, nWindows, 0.7),
    [result.trades, minScoreCandidates, nWindows],
  );

  const meta = CONCLUSION_META[wfo.conclusion];

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-text-t1 tracking-wider">
            🔄 Walk-Forward Optimization
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-t4">
            IS/OOS split 70/30 · {result.trades.length} trades · candidates: {minScoreCandidates.join(", ")}
          </div>
        </div>

        {/* Windows selector */}
        <div className="flex gap-1 shrink-0">
          {([3, 4] as const).map((n) => (
            <button
              key={n}
              onClick={() => setNWindows(n)}
              className={`rounded border px-2.5 py-1 font-mono text-2xs font-bold transition-colors ${
                nWindows === n
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-border text-text-t4 hover:text-text-t2"
              }`}
            >
              {n} windows
            </button>
          ))}
        </div>
      </div>

      {/* Conclusion banner */}
      <div className={`mb-4 rounded border px-3 py-2 ${meta.bg}`}>
        <div className={`font-mono text-xs font-bold ${meta.color}`}>{meta.label}</div>
        <div className="mt-0.5 font-mono text-2xs text-text-t4">{meta.desc}</div>
        {wfo.avgDegradation !== null && (
          <div className={`mt-1 font-mono text-xs tabular-nums ${meta.color}`}>
            Avg degradation: {(wfo.avgDegradation * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {wfo.windows.length === 0 ? (
        <p className="font-mono text-2xs text-text-t4">
          {result.trades.length < 20
            ? "Run backtest with minScore = All or lower threshold to get enough trades."
            : "Unable to compute windows."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full font-mono text-2xs">
            <thead>
              <tr className="border-b border-border bg-surface-s1 text-text-t4">
                <th className="px-3 py-2 text-left">Window</th>
                <th className="px-3 py-2 text-right">Opt Score</th>
                <th className="px-3 py-2 text-right">IS EV</th>
                <th className="px-3 py-2 text-right">IS N</th>
                <th className="px-3 py-2 text-right font-bold">OOS EV</th>
                <th className="px-3 py-2 text-right">OOS WR</th>
                <th className="px-3 py-2 text-right">OOS N</th>
                <th className="px-3 py-2 text-right">Degr.</th>
              </tr>
            </thead>
            <tbody>
              {wfo.windows.map((w) => {
                const deg = w.degradation;
                const degColor =
                  deg === null ? "text-text-t4" :
                  deg > 0.5 ? "text-signal-red font-bold" :
                  deg > 0.2 ? "text-amber-400" : "text-signal-green";

                const oosEvColor =
                  w.oosEv === null ? "text-text-t4" :
                  w.oosEv > 0.3 ? "text-signal-green font-bold" :
                  w.oosEv > 0 ? "text-signal-green" :
                  "text-signal-red";

                const startDate = new Date(w.windowStart);
                const endDate = new Date(w.windowEnd);
                const dateStr = `${startDate.toLocaleDateString("en", { month: "short", year: "2-digit" })}–${endDate.toLocaleDateString("en", { month: "short", year: "2-digit" })}`;

                return (
                  <tr
                    key={w.windowIdx}
                    className="border-b border-border/30 hover:bg-surface-s1 transition-colors"
                  >
                    <td className="px-3 py-1.5 text-text-t2">
                      <div className="font-bold">W{w.windowIdx}</div>
                      <div className="text-text-t4 text-2xs">{dateStr}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-brand font-bold">
                      ≥{w.bestMinScore}
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${w.isEv !== null && w.isEv > 0 ? "text-signal-green" : "text-text-t4"}`}>
                      {w.isEv !== null ? `${w.isEv >= 0 ? "+" : ""}${w.isEv.toFixed(2)}R` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-t3">
                      {w.isTradeCount}
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${oosEvColor}`}>
                      {w.oosEv !== null ? `${w.oosEv >= 0 ? "+" : ""}${w.oosEv.toFixed(2)}R` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-t3">
                      {w.oosWinRate !== null ? `${w.oosWinRate.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-t3">
                      {w.oosTradeCount}
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${degColor}`}>
                      {deg !== null ? `${deg >= 0 ? "+" : ""}${(deg * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 font-mono text-2xs text-text-t4">
        ⚠ IS (in-sample) = first 70% of each window used to pick best score threshold.
        OOS (out-of-sample) = remaining 30% used for blind evaluation.
        Degradation = (IS−OOS)/|IS| — positive means OOS underperforms IS.
      </div>
    </div>
  );
}
