"use client";

/**
 * MONTE CARLO CARD — Forward simulation of next N trades.
 *
 * Bootstrap method: resamples historical trade P&Ls with replacement
 * to estimate probability distribution of future outcomes.
 *
 * Shows: median outcome, 10th/90th percentiles, probability of positive,
 * and a fan-chart SVG of 100 sample paths.
 *
 * Requires ≥15 trades. Runs 1,000 simulations of 20 future trades.
 */

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const SIM_COUNT  = 1000;
const FWD_TRADES = 20;

interface SimStats {
  paths: number[][];  // 100 paths for fan chart
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  positivePct: number;
  startUsd: number;
}

function runMonteCarlo(trades: readonly TradeRecord[], fwdTrades: number): SimStats | null {
  if (trades.length < 15) return null;

  // Use absolute P&L in USD (or pnlPct if pnlUsd missing)
  const pnls = trades.map((t) => t.pnlUsd);

  const startUsd = 0; // cumulative from zero
  const finals: number[] = [];
  const fanPaths: number[][] = [];

  for (let s = 0; s < SIM_COUNT; s++) {
    let equity = startUsd;
    const path: number[] = [0];
    for (let t = 0; t < fwdTrades; t++) {
      const pnl = pnls[Math.floor(Math.random() * pnls.length)];
      equity += pnl;
      path.push(equity);
    }
    finals.push(equity);
    if (s < 100) fanPaths.push(path); // keep 100 paths for chart
  }

  finals.sort((a, b) => a - b);

  return {
    paths: fanPaths,
    p10:  finals[Math.floor(SIM_COUNT * 0.10)],
    p25:  finals[Math.floor(SIM_COUNT * 0.25)],
    p50:  finals[Math.floor(SIM_COUNT * 0.50)],
    p75:  finals[Math.floor(SIM_COUNT * 0.75)],
    p90:  finals[Math.floor(SIM_COUNT * 0.90)],
    positivePct: (finals.filter((f) => f > 0).length / SIM_COUNT) * 100,
    startUsd,
  };
}

function FanChart({ paths, p50, fwdTrades }: {
  paths: number[][];
  p50: number;
  fwdTrades: number;
}) {
  const W = 320;
  const H = 80;
  const PAD = { l: 4, r: 4, t: 8, b: 4 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const allVals = paths.flatMap((p) => p);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0, ...allVals);
  const span = (maxV - minV) || 1;
  const lo = minV - span * 0.05;
  const hi = maxV + span * 0.05;
  const fullSpan = hi - lo;

  const xOf = (i: number) => PAD.l + (i / fwdTrades) * cw;
  const yOf = (v: number) => PAD.t + ((hi - v) / fullSpan) * ch;
  const zeroY = yOf(0);

  function toPathD(pts: number[]) {
    return pts.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ maxHeight: 80 }}>
      {/* Zero baseline */}
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY}
        stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3,2" />
      {/* Fan paths — faint grey */}
      {paths.map((path, i) => {
        const final = path[path.length - 1];
        const color = final >= 0 ? "#22c55e" : "#ef4444";
        return (
          <path key={i} d={toPathD(path)} fill="none"
            stroke={color} strokeWidth="0.6" strokeOpacity="0.18" />
        );
      })}
      {/* Median path — bold */}
      {(() => {
        const medPath = paths.reduce((best, p) => {
          const finalBest = best[best.length - 1];
          const finalP = p[p.length - 1];
          return Math.abs(finalP - p50) < Math.abs(finalBest - p50) ? p : best;
        }, paths[0] ?? []);
        return medPath.length > 1
          ? <path d={toPathD(medPath)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          : null;
      })()}
    </svg>
  );
}

function usd(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}$`;
}

export function MonteCarloCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const [fwdTrades, setFwdTrades] = useState(FWD_TRADES);

  const sim = useMemo(() => runMonteCarlo(trades, fwdTrades), [trades, fwdTrades]);

  if (!sim) return null;

  const probColor =
    sim.positivePct >= 70 ? "text-signal-green"
    : sim.positivePct >= 50 ? "text-amber-400"
    : "text-signal-red";

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("pnl.monteCarlo.title")}
        </h3>
        {/* Forward trade count selector */}
        <div className="flex items-center gap-1">
          {[10, 20, 50].map((n) => (
            <button
              key={n}
              onClick={() => setFwdTrades(n)}
              className={`rounded px-1.5 py-0.5 font-mono text-2xs transition-colors ${
                fwdTrades === n
                  ? "bg-surface-s2 text-text-t1"
                  : "text-text-t4 hover:text-text-t2"
              }`}
            >
              {n}T
            </button>
          ))}
        </div>
      </div>

      {/* Fan chart */}
      <div className="mb-3">
        <FanChart
          paths={sim.paths}
          p50={sim.p50}
          fwdTrades={fwdTrades}
        />
      </div>

      {/* Percentile bands */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { label: t("pnl.monteCarlo.p10"), value: sim.p10, color: "text-signal-red" },
          { label: t("pnl.monteCarlo.p50"), value: sim.p50, color: "text-amber-400" },
          { label: t("pnl.monteCarlo.p90"), value: sim.p90, color: "text-signal-green" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-s1 rounded p-2 text-center">
            <div className={`font-mono text-sm font-bold tabular-nums ${color}`}>
              {usd(value)}
            </div>
            <div className="text-text-t4 font-mono text-2xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* P(positive) */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-text-t4 font-mono text-2xs">{t("pnl.monteCarlo.probLabel")}</span>
        <span className={`font-mono text-sm font-bold tabular-nums ${probColor}`}>
          {sim.positivePct.toFixed(0)}%
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-text-t4 font-mono text-2xs">{t("pnl.monteCarlo.iqrLabel")}</span>
        <span className="text-text-t3 font-mono text-xs tabular-nums">
          {usd(sim.p25)} ~ {usd(sim.p75)}
        </span>
      </div>

      <div className="mt-2 text-text-t4 font-mono text-2xs leading-relaxed">
        {t("pnl.monteCarlo.desc").replace("{n}", SIM_COUNT.toLocaleString()).replace("{trades}", String(trades.length))}
      </div>
    </div>
  );
}
