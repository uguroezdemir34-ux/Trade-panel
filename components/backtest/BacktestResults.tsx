"use client";

import { useMemo, useState } from "react";
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

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCsv(trades: BacktestTrade[], pair: string): void {
  const header = "pair,direction,entry_ts,entry_price,exit_ts,exit_price,exit_reason,score,r_multiple,pnl_pct,bars_held,tp1,tp2,stop";
  const rows = trades.map((t) =>
    [
      t.pair,
      t.direction,
      new Date(t.entryTs).toISOString(),
      t.entryPrice,
      new Date(t.exitTs).toISOString(),
      t.exitPrice,
      t.exitReason,
      t.score,
      t.rMultiple.toFixed(4),
      t.pnlPct.toFixed(4),
      t.barsHeld,
      t.tp1Price,
      t.tp2Price,
      t.stopPrice,
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backtest_${pair}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Exit reason badge ─────────────────────────────────────────────────────────

function exitColor(reason: BacktestTrade["exitReason"]): string {
  if (reason === "tp2") return "text-green-400";
  if (reason === "tp1") return "text-green-300";
  if (reason === "sl") return "text-red-400";
  return "text-text-t4";
}

// ── Main component ────────────────────────────────────────────────────────────

type DirFilter = "ALL" | "LONG" | "SHORT";

export function BacktestResults({ result, onPin, isPinned }: Props): React.ReactElement {
  const t = useT();
  const { stats, trades, pair, dataMonths, totalBarsScanned, runAt } = result;
  const [dirFilter, setDirFilter] = useState<DirFilter>("ALL");

  const filteredTrades = useMemo(
    () => dirFilter === "ALL" ? trades : trades.filter((t) => t.direction === dirFilter),
    [trades, dirFilter],
  );

  const exitCounts = useMemo(() => {
    const c = { tp1: 0, tp2: 0, sl: 0, timeout: 0 };
    for (const tr of filteredTrades) c[tr.exitReason]++;
    return c;
  }, [filteredTrades]);

  const riskRatios = { sharpe: stats.sharpe, sortino: stats.sortino };

  const kellyEv = useMemo(() => {
    const wins = filteredTrades.filter((t) => t.rMultiple > 0);
    const losses = filteredTrades.filter((t) => t.rMultiple <= 0);
    if (wins.length === 0 || losses.length === 0) return null;
    const avgWin = wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length);
    const wr = wins.length / filteredTrades.length;
    const lr = 1 - wr;
    const payoff = avgWin / avgLoss;
    const kelly = wr - lr / payoff;
    const ev = wr * avgWin - lr * avgLoss;
    return { kelly: Math.max(0, kelly), ev, avgWin, avgLoss, payoff };
  }, [filteredTrades]);

  // Direction-filtered quick stats
  const dirStats = useMemo(() => {
    if (dirFilter === "ALL") return null;
    const wins = filteredTrades.filter((t) => t.rMultiple > 0);
    const total = filteredTrades.length;
    const wr = total > 0 ? (wins.length / total) * 100 : 0;
    const avgR = total > 0 ? filteredTrades.reduce((s, t) => s + t.rMultiple, 0) / total : 0;
    const totalR = filteredTrades.reduce((s, t) => s + t.rMultiple, 0);
    return { total, wins: wins.length, wr, avgR, totalR };
  }, [filteredTrades, dirFilter]);

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

        {/* Direction filter */}
        <div className="flex gap-1 mb-3">
          {(["ALL", "LONG", "SHORT"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirFilter(d)}
              className={[
                "rounded border font-mono text-2xs px-2 py-0.5 transition-colors",
                dirFilter === d
                  ? d === "LONG" ? "border-green-400/50 text-green-400 bg-green-400/10"
                    : d === "SHORT" ? "border-red-400/50 text-red-400 bg-red-400/10"
                    : "border-brand text-brand bg-brand/10"
                  : "border-border text-text-t4 hover:text-text-t2",
              ].join(" ")}
            >
              {d === "LONG" ? "▲ LONG" : d === "SHORT" ? "▼ SHORT" : "ALL"}
            </button>
          ))}
        </div>

        {/* Filtered quick stats */}
        {dirStats && (
          <div className="mb-3 rounded border border-border/50 bg-surface-s1 px-3 py-2 grid grid-cols-4 gap-2">
            <Stat label={t("backtest.totalTrades")} value={dirStats.total.toString()} />
            <Stat label={t("backtest.winRate")} value={`${dirStats.wr.toFixed(1)}%`}
              color={dirStats.wr >= 55 ? "text-green-400" : dirStats.wr >= 45 ? "text-yellow-400" : "text-red-400"} />
            <Stat label={t("backtest.avgR")}
              value={`${dirStats.avgR > 0 ? "+" : ""}${dirStats.avgR.toFixed(2)}R`}
              color={dirStats.avgR > 0 ? "text-green-400" : "text-red-400"} />
            <Stat label="Total R"
              value={`${dirStats.totalR > 0 ? "+" : ""}${dirStats.totalR.toFixed(2)}R`}
              color={dirStats.totalR > 0 ? "text-green-400" : "text-red-400"} />
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("backtest.totalTrades")} value={dirFilter === "ALL" ? stats.totalTrades.toString() : filteredTrades.length.toString()} />
          <Stat label={t("backtest.winRate")} value={`${dirFilter === "ALL" ? stats.winRate.toFixed(1) : (dirStats?.wr.toFixed(1) ?? "0.0")}%`}
            color={(dirFilter === "ALL" ? stats.winRate : dirStats?.wr ?? 0) >= 55 ? "text-green-400" : (dirFilter === "ALL" ? stats.winRate : dirStats?.wr ?? 0) >= 45 ? "text-yellow-400" : "text-red-400"} />
          <Stat label={t("backtest.avgR")}
            value={dirFilter === "ALL"
              ? (stats.avgRMultiple !== null ? `${stats.avgRMultiple > 0 ? "+" : ""}${stats.avgRMultiple.toFixed(2)}R` : "—")
              : `${(dirStats?.avgR ?? 0) > 0 ? "+" : ""}${(dirStats?.avgR ?? 0).toFixed(2)}R`}
            color={(dirFilter === "ALL" ? stats.avgRMultiple ?? 0 : dirStats?.avgR ?? 0) > 0 ? "text-green-400" : "text-red-400"} />
          <Stat label="W / L"
            value={dirFilter === "ALL"
              ? `${stats.winCount} / ${stats.loseCount}`
              : `${dirStats?.wins ?? 0} / ${(dirStats?.total ?? 0) - (dirStats?.wins ?? 0)}`} />
          <Stat label={t("backtest.maxDd")} value={`${stats.maxDrawdownR.toFixed(2)}R`}
            color="text-red-400" />
          <Stat label={t("backtest.exits")}
            value={`${exitCounts.tp2}/${exitCounts.tp1}/${exitCounts.sl}/${exitCounts.timeout}`}
            hint="tp2/tp1/sl/to" />
          {dirFilter === "ALL" && stats.maxWinStreak > 0 && (
            <Stat label={t("backtest.winStreak")} value={`${stats.maxWinStreak}`}
              color="text-green-400" hint={t("backtest.streakHint")} />
          )}
          {dirFilter === "ALL" && stats.maxLossStreak > 0 && (
            <Stat label={t("backtest.lossStreak")} value={`${stats.maxLossStreak}`}
              color="text-red-400" hint={t("backtest.streakHint")} />
          )}
          {dirFilter === "ALL" && riskRatios?.sharpe !== null && riskRatios?.sharpe !== undefined && (
            <Stat label="Sharpe"
              value={riskRatios.sharpe.toFixed(2)}
              color={riskRatios.sharpe > 0.5 ? "text-green-400" : riskRatios.sharpe > 0 ? "text-yellow-400" : "text-red-400"} />
          )}
          {dirFilter === "ALL" && riskRatios?.sortino !== null && riskRatios?.sortino !== undefined && (
            <Stat label="Sortino"
              value={riskRatios.sortino.toFixed(2)}
              color={riskRatios.sortino > 1 ? "text-green-400" : riskRatios.sortino > 0 ? "text-yellow-400" : "text-red-400"} />
          )}
          {dirFilter === "ALL" && stats.profitFactor !== null && stats.profitFactor !== undefined && (
            <Stat label="Prof. Factor"
              value={stats.profitFactor.toFixed(2)}
              color={stats.profitFactor >= 1.5 ? "text-green-400" : stats.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"}
              hint="grossWins/grossLoss" />
          )}
          {kellyEv && (
            <Stat label="EV/Trade"
              value={`${kellyEv.ev > 0 ? "+" : ""}${kellyEv.ev.toFixed(3)}R`}
              color={kellyEv.ev > 0 ? "text-green-400" : "text-red-400"}
              hint="wr×avgW − lr×avgL" />
          )}
          {kellyEv && (
            <Stat label="Kelly %"
              value={`${(kellyEv.kelly * 100).toFixed(1)}%`}
              color={kellyEv.kelly > 0.15 ? "text-green-400" : kellyEv.kelly > 0 ? "text-yellow-400" : "text-red-400"}
              hint="optimal risk fraction" />
          )}
          {kellyEv && (
            <Stat label="Payoff"
              value={`${kellyEv.payoff.toFixed(2)}×`}
              color={kellyEv.payoff >= 1.5 ? "text-green-400" : kellyEv.payoff >= 1 ? "text-yellow-400" : "text-red-400"}
              hint={`${kellyEv.avgWin.toFixed(2)}R / ${kellyEv.avgLoss.toFixed(2)}R`} />
          )}
        </div>

        {/* Direction stats — shown only in ALL mode */}
        {dirFilter === "ALL" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["LONG", "SHORT"] as const).map((dir) => {
              const ds = stats.byDirection[dir];
              return (
                <button
                  key={dir}
                  onClick={() => setDirFilter(dir)}
                  className="border-border rounded border px-2 py-1.5 flex items-center justify-between hover:bg-surface-s1 transition-colors"
                >
                  <span className={`font-mono text-xs font-semibold ${dir === "LONG" ? "text-green-400" : "text-red-400"}`}>
                    {dir}
                  </span>
                  <span className="text-text-t3 font-mono text-xs tabular-nums">
                    {ds.count} {t("backtest.trades")} · {ds.winRate !== null ? `${ds.winRate.toFixed(0)}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── R-Curve ── */}
      <div className="border-border bg-surface rounded-lg border p-4">
        <h3 className="text-text-t3 font-mono text-xs tracking-wider uppercase mb-2">
          {t("backtest.rCurve")}{dirFilter !== "ALL" ? ` · ${dirFilter}` : ""}
        </h3>
        <RCurve trades={filteredTrades} />
      </div>

      {/* ── Score Buckets ── */}
      <div className="border-border bg-surface rounded-lg border p-4">
        <h3 className="text-text-t3 font-mono text-xs tracking-wider uppercase mb-3">
          {t("backtest.scoreBuckets")}</h3>
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
      {filteredTrades.length > 0 && (
        <div className="border-border bg-surface rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-text-t3 font-mono text-xs tracking-wider uppercase">
              {t("backtest.tradeList")} ({filteredTrades.length}{dirFilter !== "ALL" ? ` ${dirFilter}` : ""})
            </h3>
            <button
              onClick={() => downloadCsv(filteredTrades, pair)}
              className="font-mono text-2xs border border-border text-text-t4 hover:text-text-t2 rounded px-2 py-0.5 transition-colors"
            >
              ↓ CSV
            </button>
          </div>
          <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {filteredTrades.map((tr, idx) => (
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
