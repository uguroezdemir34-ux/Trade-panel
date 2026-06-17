"use client";

/**
 * PATTERN DISCOVERY CARD — Backtest verisiyle istatistiksel örüntüler.
 *
 * Skor aralığı × yön kombinasyonlarında: win rate, avg R, EV, çıkış dağılımı.
 * Skor motoru değişmez — salt veri görselleştirme.
 */

import { useMemo, useState } from "react";
import { discoverPatterns, summarizePatterns } from "@/lib/ml/patternStats";
import type { PatternRow } from "@/lib/ml/patternStats";
import type { BacktestResult } from "@/lib/backtest/types";
import { useT } from "@/lib/i18n/context";

interface Props {
  result: BacktestResult;
}

type FilterDir = "ALL" | "LONG" | "SHORT";

export function PatternDiscoveryCard({ result }: Props) {
  const t = useT();
  const [filterDir, setFilterDir] = useState<FilterDir>("ALL");
  const [showExits, setShowExits] = useState(false);

  const patterns = useMemo(() => discoverPatterns(result.trades), [result.trades]);
  const summary  = useMemo(() => summarizePatterns(patterns), [patterns]);

  const filtered = patterns.filter(
    (r) => filterDir === "ALL" || r.direction === filterDir,
  );

  if (patterns.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <div className="font-mono text-sm font-semibold text-text-t1 tracking-wider mb-2">
          🔍 Pattern Discovery
        </div>
        <p className="font-mono text-2xs text-text-t4">
          Yeterli backtest trade&apos;i yok (min 3 trade/bucket).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-sm font-semibold text-text-t1 tracking-wider">
            🔍 Pattern Discovery
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-t4">
            Win rate &amp; EV by score bucket · {result.trades.length} trades analyzed
          </div>
        </div>

        {/* Summary highlights */}
        {summary.bestBucket && (
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="font-mono text-2xs text-text-t4">Best Edge</div>
              <div className="font-mono text-sm font-bold text-signal-green">
                {summary.bestBucket.scoreBucket}
                {summary.bestBucket.direction !== "ALL" && ` ${summary.bestBucket.direction}`}
              </div>
              <div className="font-mono text-2xs text-signal-green">
                {summary.bestBucket.evR !== null
                  ? `EV: +${summary.bestBucket.evR.toFixed(2)}R`
                  : ""}
              </div>
            </div>
            {summary.worstBucket && summary.worstBucket !== summary.bestBucket && (
              <div>
                <div className="font-mono text-2xs text-text-t4">Worst Edge</div>
                <div className="font-mono text-sm font-bold text-signal-red">
                  {summary.worstBucket.scoreBucket}
                  {summary.worstBucket.direction !== "ALL" && ` ${summary.worstBucket.direction}`}
                </div>
                <div className="font-mono text-2xs text-signal-red">
                  {summary.worstBucket.evR !== null
                    ? `EV: ${summary.worstBucket.evR.toFixed(2)}R`
                    : ""}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(["ALL", "LONG", "SHORT"] as FilterDir[]).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDir(d)}
              className={`rounded border px-2.5 py-1 font-mono text-2xs font-bold tracking-wider transition-colors ${
                filterDir === d
                  ? d === "LONG"
                    ? "border-signal-green/50 bg-signal-green/10 text-signal-green"
                    : d === "SHORT"
                    ? "border-signal-red/50 bg-signal-red/10 text-signal-red"
                    : "border-brand/50 bg-brand/10 text-brand"
                  : "border-border text-text-t4 hover:text-text-t2"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowExits((v) => !v)}
          className="font-mono text-2xs text-text-t4 hover:text-text-t2 transition-colors ml-auto"
        >
          {showExits ? "Hide exit breakdown" : "Show exit breakdown"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full font-mono text-2xs">
          <thead>
            <tr className="border-b border-border bg-surface-s1 text-text-t4">
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Dir</th>
              <th className="px-3 py-2 text-right">N</th>
              <th className="px-3 py-2 text-right">Win%</th>
              <th className="px-3 py-2 text-right">Avg R</th>
              <th className="px-3 py-2 text-right font-bold">EV (R)</th>
              {showExits && (
                <>
                  <th className="px-3 py-2 text-right">TP1%</th>
                  <th className="px-3 py-2 text-right">TP2%</th>
                  <th className="px-3 py-2 text-right">SL%</th>
                  <th className="px-3 py-2 text-right">TO%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <PatternTableRow
                key={`${row.scoreBucket}-${row.direction}-${idx}`}
                row={row}
                showExits={showExits}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showExits ? 10 : 6} className="px-3 py-3 text-center text-text-t4">
                  {t("backtest.noDataFilter")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 font-mono text-2xs text-text-t4">
        {t("backtest.disclaimer")}
        {" "}EV = P(W)×AvgWinR − P(L)×AvgLossR
      </div>
    </div>
  );
}

function PatternTableRow({
  row,
  showExits,
}: {
  row: PatternRow;
  showExits: boolean;
}) {
  const dirColor =
    row.direction === "LONG"
      ? "text-signal-green"
      : row.direction === "SHORT"
      ? "text-signal-red"
      : "text-text-t2";

  const evColor =
    row.evR === null ? "text-text-t4" :
    row.evR > 0.5 ? "text-signal-green font-bold" :
    row.evR > 0   ? "text-signal-green" :
    row.evR < -0.5 ? "text-signal-red font-bold" :
    "text-signal-red";

  const wrColor =
    row.winRate === null ? "text-text-t4" :
    row.winRate >= 0.6 ? "text-signal-green" :
    row.winRate >= 0.45 ? "text-text-t2" :
    "text-signal-red";

  return (
    <tr className="border-b border-border/30 hover:bg-surface-s1 transition-colors">
      <td className="px-3 py-1.5 text-text-t2 font-bold">{row.scoreBucket}</td>
      <td className={`px-3 py-1.5 font-bold ${dirColor}`}>{row.direction}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-text-t2">{row.n}</td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${wrColor}`}>
        {row.winRate !== null ? `${(row.winRate * 100).toFixed(0)}%` : "—"}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${(row.avgR ?? 0) >= 0 ? "text-signal-green" : "text-signal-red"}`}>
        {row.avgR !== null
          ? `${row.avgR >= 0 ? "+" : ""}${row.avgR.toFixed(2)}R`
          : "—"}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${evColor}`}>
        {row.evR !== null
          ? `${row.evR >= 0 ? "+" : ""}${row.evR.toFixed(2)}R`
          : "—"}
      </td>
      {showExits && (
        <>
          <td className="px-3 py-1.5 text-right tabular-nums text-signal-green">
            {row.tp1Rate !== null ? `${(row.tp1Rate * 100).toFixed(0)}%` : "—"}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums text-signal-green">
            {row.tp2Rate !== null ? `${(row.tp2Rate * 100).toFixed(0)}%` : "—"}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums text-signal-red">
            {row.slRate !== null ? `${(row.slRate * 100).toFixed(0)}%` : "—"}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums text-text-t4">
            {row.timeoutRate !== null ? `${(row.timeoutRate * 100).toFixed(0)}%` : "—"}
          </td>
        </>
      )}
    </tr>
  );
}
