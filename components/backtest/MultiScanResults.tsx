"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { ScanRow, ScanConfig } from "@/lib/store/backtestStore";

interface Props {
  rows: ScanRow[];
  scanDone: number;
  scanTotal: number;
  scanCurrentPair: string | null;
  config: ScanConfig | null;
  status: "scanning" | "done" | "error";
}

function ev(row: ScanRow): number {
  return row.ev ?? -999;
}

export function MultiScanResults({
  rows,
  scanDone,
  scanTotal,
  scanCurrentPair,
  config,
  status,
}: Props): React.ReactElement {
  const t = useT();

  const sorted = useMemo(
    () => [...rows].sort((a, b) => ev(b) - ev(a)),
    [rows],
  );

  const scanPct = scanTotal > 0 ? Math.round((scanDone / scanTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar while scanning */}
      {status === "scanning" && (
        <div className="border-border bg-surface rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
              {t("backtest.scanTitle")}
            </h2>
            <span className="text-text-t3 font-mono text-xs tabular-nums">
              {scanDone}/{scanTotal}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${scanPct}%` }}
            />
          </div>
          {scanCurrentPair && (
            <p className="text-text-t4 font-mono text-xs">
              {t("backtest.scanningPair")}: <span className="text-text-t2">{scanCurrentPair}/USDT</span>
            </p>
          )}
        </div>
      )}

      {/* Results table */}
      {sorted.length > 0 && (
        <div className="border-border bg-surface rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
              {t("backtest.scanLeaderboard")}
            </h2>
            {config && (
              <span className="text-text-t4 font-mono text-2xs">
                {config.dataMonths}{t("backtest.months")} · F&G {config.frozenFg}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-text-t4 border-b border-border">
                  <th className="text-left py-1.5 pr-3">#</th>
                  <th className="text-left py-1.5 pr-3">{t("backtest.pair")}</th>
                  <th className="text-right py-1.5 pr-3">{t("backtest.totalTrades")}</th>
                  <th className="text-right py-1.5 pr-3">{t("backtest.winRate")}</th>
                  <th className="text-right py-1.5 pr-3">{t("backtest.avgR")}</th>
                  <th className="text-right py-1.5 pr-3">EV</th>
                  <th className="text-right py-1.5 pr-3">L%</th>
                  <th className="text-right py-1.5">S%</th>
                </tr>
              </thead>
              <tbody>
                {(sorted as ScanRow[]).map((row: ScanRow, idx: number) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3 && row.status === "done" && (row.ev ?? 0) > 0;

                  if (row.status === "error") {
                    return (
                      <tr key={row.pair} className="border-b border-border/30">
                        <td className="text-text-t4 py-1.5 pr-3">{rank}</td>
                        <td className="text-text-t2 py-1.5 pr-3 font-semibold">{row.pair}</td>
                        <td colSpan={6} className="text-red-400 text-right py-1.5 text-2xs">
                          {row.errorMsg ?? "Error"}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={row.pair}
                      className={[
                        "border-b border-border/30",
                        isTop3 ? "bg-brand/5" : "",
                      ].join(" ")}
                    >
                      <td className={`py-1.5 pr-3 ${isTop3 ? "text-brand font-bold" : "text-text-t4"}`}>
                        {rank}
                      </td>
                      <td className={`py-1.5 pr-3 font-semibold ${isTop3 ? "text-brand" : "text-text-t2"}`}>
                        {row.pair}
                      </td>
                      <td className="text-text-t3 text-right py-1.5 pr-3 tabular-nums">
                        {row.totalTrades}
                      </td>
                      <td className={`text-right py-1.5 pr-3 tabular-nums font-semibold ${
                        row.winRate >= 55 ? "text-green-400" :
                        row.winRate >= 45 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {row.winRate.toFixed(0)}%
                      </td>
                      <td className={`text-right py-1.5 pr-3 tabular-nums ${
                        row.avgR !== null && row.avgR > 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        {row.avgR !== null
                          ? `${row.avgR > 0 ? "+" : ""}${row.avgR.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className={`text-right py-1.5 pr-3 tabular-nums font-bold ${
                        row.ev !== null && row.ev > 0 ? "text-green-400" :
                        row.ev !== null && row.ev < 0 ? "text-red-400" : "text-text-t4"
                      }`}>
                        {row.ev !== null
                          ? `${row.ev > 0 ? "+" : ""}${row.ev.toFixed(3)}`
                          : "—"}
                      </td>
                      <td className="text-text-t3 text-right py-1.5 pr-3 tabular-nums">
                        {row.longWinRate !== null ? `${row.longWinRate.toFixed(0)}%` : "—"}
                      </td>
                      <td className="text-text-t3 text-right py-1.5 tabular-nums">
                        {row.shortWinRate !== null ? `${row.shortWinRate.toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* EV explanation */}
          <p className="text-text-t4 font-mono text-2xs mt-3">
            EV = WR% × AvgR · L% = Long WR · S% = Short WR · {t("backtest.scanSortHint")}
          </p>
        </div>
      )}
    </div>
  );
}
