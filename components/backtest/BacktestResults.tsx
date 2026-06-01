"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { BacktestResult, BacktestTrade } from "@/lib/backtest/types";

interface Props {
  result: BacktestResult;
  onPin?: () => void;
  isPinned?: boolean;
}

// ── Inline R-curve (pure SVG, no deps) ───────────────────────────────────────

function RCurve({ trades }: { trades: BacktestTrade[] }): React.ReactElement {
  const points = useMemo(() => {
    let cumR = 0;
    return trades.map((t) => {
      cumR += t.rMultiple;
      return cumR;
    });
  }, [trades]);

  if (points.length < 2) return <div className="text-text-t4 font-mono text-xs">—</div>;

  const W = 400;
  const H = 80;
  const PAD = { top: 6, right: 8, bottom: 6, left: 8 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const minV = Math.min(0, ...points);
  const maxV = Math.max(0, ...points);
  const range = maxV - minV || 1;
  const padded = { min: minV - range * 0.05, max: maxV + range * 0.05 };
  const totalRange = padded.max - padded.min;

  const xOf = (i: number) => PAD.left + (i / (points.length - 1)) * cw;
  const yOf = (v: number) => PAD.top + ((padded.max - v) / totalRange) * ch;

  const pathD = (points as number[]).map((v: number, i: number) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const zeroY = yOf(0);
  const last = points[points.length - 1];
  const isProfit = last >= 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 80 }}>
      {/* Zero baseline */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
        stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 3" />
      {/* Curve */}
      <path d={pathD} fill="none"
        stroke={isProfit ? "#22c55e" : "#ef4444"} strokeWidth="1.5" />
      {/* Last value label */}
      <text x={W - PAD.right} y={yOf(last)} textAnchor="end"
        dominantBaseline="middle" fontSize="9" fontFamily="monospace"
        fill={isProfit ? "#22c55e" : "#ef4444"}>
        {last > 0 ? "+" : ""}{last.toFixed(2)}R
      </text>
    </svg>
  );
}

// ── Exit reason badge ─────────────────────────────────────────────────────────

function exitColor(reason: BacktestTrade["exitReason"]): string {
  if (reason === "tp2") return "text-green-400";
  if (reason === "tp1") return "text-green-300";
  if (reason === "sl") return "text-red-400";
  return "text-text-t4";
}

// ── Main component ────────────────────────────────────────────────────────────

export function BacktestResults({ result, onPin, isPinned }: Props): React.ReactElement {
  const t = useT();
  const { stats, trades, pair, dataMonths, totalBarsScanned, runAt } = result;

  const exitCounts = useMemo(() => {
    const c = { tp1: 0, tp2: 0, sl: 0, timeout: 0 };
    for (const tr of trades) c[tr.exitReason]++;
    return c;
  }, [trades]);

  const riskRatios = useMemo(() => {
    if (trades.length < 5) return null;
    const rs = trades.map((t) => t.rMultiple);
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
    const variance = rs.reduce((s, r) => s + (r - mean) ** 2, 0) / rs.length;
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? mean / std : null;
    const downVar = rs.filter((r) => r < 0).reduce((s, r) => s + r ** 2, 0) / rs.length;
    const sortino = downVar > 0 ? mean / Math.sqrt(downVar) : null;
    return { sharpe, sortino };
  }, [trades]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="border-border bg-surface rounded-lg border p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <h2 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
            {pair}/USDT · {dataMonths}{t("backtest.months")} · {totalBarsScanned.toLocaleString()} {t("backtest.bars")}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-text-t4 font-mono text-2xs">
              {new Date(runAt).toLocaleTimeString()}
            </span>
            {onPin && (
              <button
                onClick={onPin}
                className={`font-mono text-2xs border rounded px-2 py-1 transition-colors ${
                  isPinned
                    ? "border-signal-green/40 text-signal-green bg-soft-green"
                    : "border-border text-text-t4 hover:text-text-t2"
                }`}
              >
                {isPinned ? t("backtest.pinned") : t("backtest.pinButton")}
              </button>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("backtest.totalTrades")} value={stats.totalTrades.toString()} />
          <Stat label={t("backtest.winRate")} value={`${stats.winRate.toFixed(1)}%`}
            color={stats.winRate >= 55 ? "text-green-400" : stats.winRate >= 45 ? "text-yellow-400" : "text-red-400"} />
          <Stat label={t("backtest.avgR")}
            value={stats.avgRMultiple !== null ? `${stats.avgRMultiple > 0 ? "+" : ""}${stats.avgRMultiple.toFixed(2)}R` : "—"}
            color={stats.avgRMultiple !== null && stats.avgRMultiple > 0 ? "text-green-400" : "text-red-400"} />
          <Stat label="W / L" value={`${stats.winCount} / ${stats.loseCount}`} />
          <Stat label={t("backtest.maxDd")} value={`${stats.maxDrawdownR.toFixed(2)}R`}
            color="text-red-400" />
          <Stat label={t("backtest.exits")}
            value={`${exitCounts.tp2}/${exitCounts.tp1}/${exitCounts.sl}/${exitCounts.timeout}`}
            hint="tp2/tp1/sl/to" />
          {riskRatios?.sharpe !== null && riskRatios?.sharpe !== undefined && (
            <Stat label="Sharpe"
              value={riskRatios.sharpe.toFixed(2)}
              color={riskRatios.sharpe > 0.5 ? "text-green-400" : riskRatios.sharpe > 0 ? "text-yellow-400" : "text-red-400"} />
          )}
          {riskRatios?.sortino !== null && riskRatios?.sortino !== undefined && (
            <Stat label="Sortino"
              value={riskRatios.sortino.toFixed(2)}
              color={riskRatios.sortino > 1 ? "text-green-400" : riskRatios.sortino > 0 ? "text-yellow-400" : "text-red-400"} />
          )}
        </div>

        {/* Direction stats */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["LONG", "SHORT"] as const).map((dir) => {
            const ds = stats.byDirection[dir];
            return (
              <div key={dir} className="border-border rounded border px-2 py-1.5 flex items-center justify-between">
                <span className={`font-mono text-xs font-semibold ${dir === "LONG" ? "text-green-400" : "text-red-400"}`}>
                  {dir}
                </span>
                <span className="text-text-t3 font-mono text-xs tabular-nums">
                  {ds.count} {t("backtest.trades")} · {ds.winRate !== null ? `${ds.winRate.toFixed(0)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── R-Curve ── */}
      <div className="border-border bg-surface rounded-lg border p-4">
        <h3 className="text-text-t3 font-mono text-xs tracking-wider uppercase mb-2">
          {t("backtest.rCurve")}
        </h3>
        <RCurve trades={trades} />
      </div>

      {/* ── Score Buckets ── */}
      <div className="border-border bg-surface rounded-lg border p-4">
        <h3 className="text-text-t3 font-mono text-xs tracking-wider uppercase mb-3">
          {t("backtest.scoreBuckets")}
        </h3>
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-text-t4 border-b border-border">
              <th className="text-left py-1">{t("backtest.bucket")}</th>
              <th className="text-right py-1">{t("backtest.count")}</th>
              <th className="text-right py-1">WR%</th>
              <th className="text-right py-1">{t("backtest.avgR")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.byScoreBucket.map((b) => (
              <tr key={b.label} className="border-b border-border/50">
                <td className="text-text-t2 py-1">{b.label}</td>
                <td className="text-text-t3 text-right py-1">{b.count}</td>
                <td className={`text-right py-1 ${b.winRate !== null && b.winRate >= 55 ? "text-green-400" : b.winRate !== null && b.winRate < 45 ? "text-red-400" : "text-text-t3"}`}>
                  {b.winRate !== null ? `${b.winRate.toFixed(0)}%` : "—"}
                </td>
                <td className={`text-right py-1 tabular-nums ${b.avgR !== null && b.avgR > 0 ? "text-green-400" : b.avgR !== null ? "text-red-400" : "text-text-t4"}`}>
                  {b.avgR !== null ? `${b.avgR > 0 ? "+" : ""}${b.avgR.toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Trade List ── */}
      {trades.length > 0 && (
        <div className="border-border bg-surface rounded-lg border p-4">
          <h3 className="text-text-t3 font-mono text-xs tracking-wider uppercase mb-3">
            {t("backtest.tradeList")} ({trades.length})
          </h3>
          <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {trades.map((tr, idx) => (
              <div key={idx}
                className="grid font-mono text-2xs tabular-nums border-b border-border/30 py-1"
                style={{ gridTemplateColumns: "auto 1fr auto auto" }}>
                <span className={`pr-2 font-semibold ${tr.direction === "LONG" ? "text-green-400" : "text-red-400"}`}>
                  {tr.direction === "LONG" ? "▲" : "▼"}
                </span>
                <span className="text-text-t4 truncate">
                  {new Date(tr.entryTs).toLocaleDateString()}
                </span>
                <span className={`px-2 ${exitColor(tr.exitReason)}`}>
                  {tr.exitReason.toUpperCase()}
                </span>
                <span className={tr.rMultiple > 0 ? "text-green-400" : "text-red-400"}>
                  {tr.rMultiple > 0 ? "+" : ""}{tr.rMultiple.toFixed(2)}R
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${color ?? "text-text-t1"}`}>
        {value}
      </span>
      {hint && <span className="text-text-t4 font-mono text-2xs">{hint}</span>}
    </div>
  );
}
