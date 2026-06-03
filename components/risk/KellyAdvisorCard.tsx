"use client";

/**
 * KELLY ADVISOR CARD — Optimal risk percentage from Kelly Criterion.
 *
 * Kelly formula:  f* = (p·b − (1−p)) / b
 *   p = win rate (fraction)
 *   b = avg winning trade $ / avg losing trade $ (payoff ratio)
 *   f* = optimal risk fraction of capital per trade
 *
 * Recommendations:
 *   Full Kelly  — mathematically optimal but volatile
 *   Half-Kelly  — recommended for live trading (full/2)
 *   Quarter-Kelly — very conservative (full/4)
 *
 * Compares user's current defaultRiskPct to Half-Kelly and color-codes.
 * Requires ≥10 closed trades with both wins and losses.
 */

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useT } from "@/lib/i18n/context";

function fmt(pct: number) {
  return `${pct.toFixed(2)}%`;
}

export function KellyAdvisorCard(): React.ReactElement | null {
  const t = useT();
  const trades = useTradesStore((s) => s.trades);
  const currentRiskPct = useSettingsStore((s) => s.defaultRiskPct);

  const kelly = useMemo(() => {
    const closed = trades.filter((t) => t.status === "closed" && t.exit != null);
    if (closed.length < 10) return null;

    const wins   = closed.filter((t) => (t.exit?.pnlUsd ?? 0) > 0);
    const losses = closed.filter((t) => (t.exit?.pnlUsd ?? 0) < 0);
    if (wins.length === 0 || losses.length === 0) return null;

    const p = wins.length / closed.length;

    // Prefer rMultiple if available (more accurate)
    const hasR = closed.every((t) => t.exit?.rMultiple != null);
    let b: number;
    if (hasR) {
      const avgWinR  = wins.reduce((s, t) => s + (t.exit!.rMultiple ?? 0), 0) / wins.length;
      const avgLossR = Math.abs(losses.reduce((s, t) => s + (t.exit!.rMultiple ?? 0), 0) / losses.length);
      b = avgLossR > 0 ? avgWinR / avgLossR : avgWinR;
    } else {
      const avgWin  = wins.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0) / wins.length;
      const avgLoss = Math.abs(losses.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0) / losses.length);
      b = avgLoss > 0 ? avgWin / avgLoss : avgWin;
    }

    const full = ((p * b - (1 - p)) / b) * 100;
    const half = full / 2;
    const quarter = full / 4;

    return {
      winRate: p,
      payoff: b,
      full: Math.max(0, full),
      half: Math.max(0, half),
      quarter: Math.max(0, quarter),
      sampleSize: closed.length,
    };
  }, [trades]);

  if (!kelly) return null;
  if (kelly.full <= 0) return null;

  // Compare user risk to half-Kelly
  const ratio = currentRiskPct / kelly.half;
  const statusColor =
    ratio <= 0.8  ? "text-signal-green"
    : ratio <= 1.2 ? "text-amber-400"
    : "text-signal-red";
  const statusText =
    ratio <= 0.8  ? t("risk.kellyAdvisor.statusConservative")
    : ratio <= 1.2 ? t("risk.kellyAdvisor.statusOptimal")
    : ratio <= 2   ? t("risk.kellyAdvisor.statusAboveHalf")
    : t("risk.kellyAdvisor.statusOverRisked");

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          📐 {t("risk.kellyAdvisor.title")}
        </h3>
        <span className="text-text-t4 font-mono text-2xs">
          n={kelly.sampleSize}
        </span>
      </div>

      {/* Inputs */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="bg-surface-s1 rounded p-2">
          <div className="text-text-t4 font-mono text-2xs tracking-wider">{t("risk.kellyAdvisor.winRate")}</div>
          <div className="text-text-t1 font-mono text-sm font-bold tabular-nums">
            {Math.round(kelly.winRate * 100)}%
          </div>
        </div>
        <div className="bg-surface-s1 rounded p-2">
          <div className="text-text-t4 font-mono text-2xs tracking-wider">{t("risk.kellyAdvisor.payoffRatio")}</div>
          <div className="text-text-t1 font-mono text-sm font-bold tabular-nums">
            {kelly.payoff.toFixed(2)}:1
          </div>
        </div>
      </div>

      {/* Kelly levels */}
      <div className="mb-3 flex flex-col gap-1.5">
        {[
          { label: t("risk.kellyAdvisor.fullKelly"), value: kelly.full, desc: t("risk.kellyAdvisor.fullKellyDesc") },
          { label: t("risk.kellyAdvisor.halfKelly"), value: kelly.half, desc: t("risk.kellyAdvisor.halfKellyDesc") },
          { label: t("risk.kellyAdvisor.quarterKelly"), value: kelly.quarter, desc: t("risk.kellyAdvisor.quarterKellyDesc") },
        ].map(({ label, value, desc }) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <div>
              <span className="text-text-t2 font-mono text-xs">{label}</span>
              <span className="text-text-t4 font-mono text-2xs ml-2 hidden sm:inline">{desc}</span>
            </div>
            <span className="text-text-t1 font-mono text-xs font-semibold tabular-nums">
              {fmt(value)}
            </span>
          </div>
        ))}
      </div>

      {/* Bar: current vs half-Kelly */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-text-t4 font-mono text-2xs">{t("risk.kellyAdvisor.currentRisk")}</span>
          <span className="text-text-t2 font-mono text-xs font-bold tabular-nums">
            {fmt(currentRiskPct)}
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded bg-border/30">
          {/* Half-Kelly marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-400/60"
            style={{ left: `${Math.min((kelly.half / (kelly.full * 1.5)) * 100, 100)}%` }}
          />
          {/* Current risk bar */}
          <div
            className={`h-full rounded transition-all ${
              ratio <= 1 ? "bg-signal-green/70" : "bg-signal-red/70"
            }`}
            style={{
              width: `${Math.min((currentRiskPct / (kelly.full * 1.5)) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-0.5 flex justify-end">
          <span className="text-text-t4 font-mono text-2xs">
            {t("risk.kellyAdvisor.markerLabel")}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className={`font-mono text-xs ${statusColor}`}>
        {statusText}
      </div>
    </div>
  );
}
