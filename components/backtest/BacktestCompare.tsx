"use client";

/**
 * BACKTEST COMPARE — İki backtest sonucunu yan yana karşılaştırır.
 *
 * Layout:
 *   - Header: A (referans) | B (aktif) başlıkları + "Temizle" butonu
 *   - Stats tablosu: her satır = metrik adı | A değeri | delta | B değeri
 *   - Yön breakdown
 *   - Çift R eğrisi overlay (aynı SVG)
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { BacktestResult, BacktestTrade } from "@/lib/backtest/types";
import type { BacktestConfig } from "@/lib/backtest/types";

interface Props {
  resultA: BacktestResult;
  configA: BacktestConfig;
  resultB: BacktestResult;
  configB: BacktestConfig;
  onClear: () => void;
}

// ── Delta helpers ─────────────────────────────────────────────────────────────

/** Shows "+x.xx" or "-x.xx" for a numeric delta. */
function fmtDelta(delta: number, decimals = 2): string {
  return (delta >= 0 ? "+" : "") + delta.toFixed(decimals);
}

/** Returns color class: green if delta is "good", red if "bad". */
function deltaColor(delta: number, higherIsBetter: boolean): string {
  if (delta === 0) return "text-text-t4";
  const isGood = higherIsBetter ? delta > 0 : delta < 0;
  return isGood ? "text-signal-green" : "text-signal-red";
}

function DeltaChip({
  delta,
  higherIsBetter,
  format,
}: {
  delta: number;
  higherIsBetter: boolean;
  format: (d: number) => string;
}) {
  if (delta === 0) return null;
  const color = deltaColor(delta, higherIsBetter);
  const arrow = (higherIsBetter ? delta > 0 : delta < 0) ? "△" : "▽";
  return (
    <span className={`font-mono text-2xs tabular-nums ${color}`}>
      {arrow} {format(delta)}
    </span>
  );
}

// ── Dual R-curve ─────────────────────────────────────────────────────────────

function DualRCurve({
  tradesA,
  tradesB,
}: {
  tradesA: BacktestTrade[];
  tradesB: BacktestTrade[];
}): React.ReactElement {
  const { ptsA, ptsB } = useMemo(() => {
    let cum = 0;
    const ptsA = tradesA.map((t) => { cum += t.rMultiple; return cum; });
    cum = 0;
    const ptsB = tradesB.map((t) => { cum += t.rMultiple; return cum; });
    return { ptsA, ptsB };
  }, [tradesA, tradesB]);

  if (ptsA.length < 2 && ptsB.length < 2) {
    return <div className="text-text-t4 font-mono text-xs">—</div>;
  }

  const W = 400;
  const H = 80;
  const PAD = { top: 6, right: 8, bottom: 6, left: 8 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const allVals = [...ptsA, ...ptsB];
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0, ...allVals);
  const range = maxV - minV || 1;
  const lo = minV - range * 0.05;
  const hi = maxV + range * 0.05;
  const span = hi - lo;

  const yOf = (v: number) => PAD.top + ((hi - v) / span) * ch;
  const zeroY = yOf(0);

  function toPath(pts: number[]): string {
    if (pts.length < 2) return "";
    return pts
      .map((v, i) => {
        const x = (PAD.left + (i / (pts.length - 1)) * cw).toFixed(1);
        const y = yOf(v).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  const lastA = ptsA[ptsA.length - 1] ?? 0;
  const lastB = ptsB[ptsB.length - 1] ?? 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 80 }}>
      {/* Zero baseline */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
        stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 3" />
      {/* Curve A — green */}
      {ptsA.length >= 2 && (
        <path d={toPath(ptsA)} fill="none" stroke="#22c55e" strokeWidth="1.5" />
      )}
      {/* Curve B — blue */}
      {ptsB.length >= 2 && (
        <path d={toPath(ptsB)} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      )}
      {/* Labels */}
      {ptsA.length >= 2 && (
        <text x={PAD.left + 2} y={yOf(lastA) - 3} fontSize="8" fontFamily="monospace" fill="#22c55e">
          A {lastA > 0 ? "+" : ""}{lastA.toFixed(2)}R
        </text>
      )}
      {ptsB.length >= 2 && (
        <text x={PAD.left + 2} y={yOf(lastB) + 9} fontSize="8" fontFamily="monospace" fill="#3b82f6">
          B {lastB > 0 ? "+" : ""}{lastB.toFixed(2)}R
        </text>
      )}
    </svg>
  );
}

// ── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  valA,
  valB,
  delta,
  higherIsBetter,
  fmtDeltaStr,
}: {
  label: string;
  valA: string;
  valB: string;
  delta: number;
  higherIsBetter: boolean;
  fmtDeltaStr: (d: number) => string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-b border-border/40 py-1.5">
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
      <span className="text-text-t2 font-mono text-xs tabular-nums w-16 text-right">{valA}</span>
      <div className="flex flex-col items-end gap-0.5 min-w-[80px]">
        <span className="text-text-t1 font-mono text-xs tabular-nums font-semibold">{valB}</span>
        <DeltaChip delta={delta} higherIsBetter={higherIsBetter} format={fmtDeltaStr} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BacktestCompare({
  resultA,
  configA,
  resultB,
  configB,
  onClear,
}: Props): React.ReactElement {
  const t = useT();
  const sA = resultA.stats;
  const sB = resultB.stats;

  const avgRA = sA.avgRMultiple ?? 0;
  const avgRB = sB.avgRMultiple ?? 0;

  const evA = useMemo(() => {
    const wins = resultA.trades.filter((t) => t.rMultiple > 0);
    const losses = resultA.trades.filter((t) => t.rMultiple <= 0);
    if (!wins.length || !losses.length) return null;
    const avgW = wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length;
    const avgL = Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length);
    const wr = wins.length / resultA.trades.length;
    return wr * avgW - (1 - wr) * avgL;
  }, [resultA.trades]);

  const evB = useMemo(() => {
    const wins = resultB.trades.filter((t) => t.rMultiple > 0);
    const losses = resultB.trades.filter((t) => t.rMultiple <= 0);
    if (!wins.length || !losses.length) return null;
    const avgW = wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length;
    const avgL = Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length);
    const wr = wins.length / resultB.trades.length;
    return wr * avgW - (1 - wr) * avgL;
  }, [resultB.trades]);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4 flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-text-t1 font-mono text-sm font-semibold tracking-widest uppercase">
            {t("backtest.compareTitle")}
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-text-t4 font-mono text-2xs border border-border rounded px-2 py-1 hover:text-text-t2 shrink-0"
        >
          {t("backtest.clearPin")}
        </button>
      </div>

      {/* ── Run labels ── */}
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2">
        <span className="text-text-t4 font-mono text-2xs">{t("backtest.compareConfig")}</span>
        <span className="text-signal-green font-mono text-2xs font-bold w-16 text-right">
          {t("backtest.runA")}
        </span>
        <span className="text-signal-blue font-mono text-2xs font-bold min-w-[80px] text-right">
          {t("backtest.runB")}
        </span>
      </div>

      {/* ── Config row ── */}
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-b border-border/40 pb-2">
        <span className="text-text-t4 font-mono text-2xs tracking-wider">Pair · Period · FG</span>
        <span className="text-text-t3 font-mono text-2xs tabular-nums w-16 text-right">
          {resultA.pair} {resultA.dataMonths}mo {configA.frozenFg}fg
        </span>
        <span className="text-text-t3 font-mono text-2xs tabular-nums min-w-[80px] text-right">
          {resultB.pair} {resultB.dataMonths}mo {configB.frozenFg}fg
        </span>
      </div>

      {/* ── Stats ── */}
      <div className="flex flex-col">
        <StatRow
          label={t("backtest.totalTrades")}
          valA={sA.totalTrades.toString()}
          valB={sB.totalTrades.toString()}
          delta={sB.totalTrades - sA.totalTrades}
          higherIsBetter={true}
          fmtDeltaStr={(d) => fmtDelta(d, 0)}
        />
        <StatRow
          label={t("backtest.winRate")}
          valA={`${sA.winRate.toFixed(1)}%`}
          valB={`${sB.winRate.toFixed(1)}%`}
          delta={sB.winRate - sA.winRate}
          higherIsBetter={true}
          fmtDeltaStr={(d) => `${fmtDelta(d, 1)}pp`}
        />
        <StatRow
          label={t("backtest.avgR")}
          valA={avgRA !== 0 ? `${avgRA > 0 ? "+" : ""}${avgRA.toFixed(2)}R` : "—"}
          valB={avgRB !== 0 ? `${avgRB > 0 ? "+" : ""}${avgRB.toFixed(2)}R` : "—"}
          delta={avgRB - avgRA}
          higherIsBetter={true}
          fmtDeltaStr={(d) => `${fmtDelta(d, 2)}R`}
        />
        <StatRow
          label={t("backtest.maxDd")}
          valA={`${sA.maxDrawdownR.toFixed(2)}R`}
          valB={`${sB.maxDrawdownR.toFixed(2)}R`}
          delta={sB.maxDrawdownR - sA.maxDrawdownR}
          higherIsBetter={false}
          fmtDeltaStr={(d) => `${fmtDelta(d, 2)}R`}
        />
        <StatRow
          label={t("backtest.winStreak")}
          valA={sA.maxWinStreak.toString()}
          valB={sB.maxWinStreak.toString()}
          delta={sB.maxWinStreak - sA.maxWinStreak}
          higherIsBetter={true}
          fmtDeltaStr={(d) => fmtDelta(d, 0)}
        />
        <StatRow
          label={t("backtest.lossStreak")}
          valA={sA.maxLossStreak.toString()}
          valB={sB.maxLossStreak.toString()}
          delta={sB.maxLossStreak - sA.maxLossStreak}
          higherIsBetter={false}
          fmtDeltaStr={(d) => fmtDelta(d, 0)}
        />

        {evA !== null && evB !== null && (
          <StatRow
            label={t("backtest.evTrade")}
            valA={`${evA >= 0 ? "+" : ""}${evA.toFixed(3)}R`}
            valB={`${evB >= 0 ? "+" : ""}${evB.toFixed(3)}R`}
            delta={evB - evA}
            higherIsBetter={true}
            fmtDeltaStr={(d) => `${fmtDelta(d, 3)}R`}
          />
        )}
        {sA.sharpe !== null && sB.sharpe !== null && (
          <StatRow
            label={t("backtest.sharpe")}
            valA={sA.sharpe.toFixed(2)}
            valB={sB.sharpe.toFixed(2)}
            delta={sB.sharpe - sA.sharpe}
            higherIsBetter={true}
            fmtDeltaStr={(d) => fmtDelta(d, 2)}
          />
        )}
        {sA.profitFactor !== null && sB.profitFactor !== null && (
          <StatRow
            label={t("backtest.profFactor")}
            valA={sA.profitFactor.toFixed(2)}
            valB={sB.profitFactor.toFixed(2)}
            delta={sB.profitFactor - sA.profitFactor}
            higherIsBetter={true}
            fmtDeltaStr={(d) => fmtDelta(d, 2)}
          />
        )}

        {/* Direction breakdown */}
        {(["LONG", "SHORT"] as const).map((dir) => {
          const dsA = sA.byDirection[dir];
          const dsB = sB.byDirection[dir];
          const wrA = dsA.winRate ?? 0;
          const wrB = dsB.winRate ?? 0;
          return (
            <StatRow
              key={dir}
              label={t("backtest.compareDirWr").replace("{dir}", dir)}
              valA={dsA.winRate !== null ? `${wrA.toFixed(0)}% (${dsA.count})` : "—"}
              valB={dsB.winRate !== null ? `${wrB.toFixed(0)}% (${dsB.count})` : "—"}
              delta={wrB - wrA}
              higherIsBetter={true}
              fmtDeltaStr={(d) => `${fmtDelta(d, 1)}pp`}
            />
          );
        })}
      </div>

      {/* ── Dual R-curve ── */}
      <div>
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase block mb-2">
          {t("backtest.rCurve")}
        </span>
        <DualRCurve tradesA={resultA.trades} tradesB={resultB.trades} />
        {/* Legend */}
        <div className="flex gap-3 mt-1">
          <div className="flex items-center gap-1">
            <div className="h-0 w-4 border-t-2 border-signal-green" />
            <span className="text-text-t4 font-mono text-2xs">A</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0 w-4 border-t-2 border-signal-blue" />
            <span className="text-text-t4 font-mono text-2xs">B</span>
          </div>
        </div>
      </div>
    </div>
  );
}
