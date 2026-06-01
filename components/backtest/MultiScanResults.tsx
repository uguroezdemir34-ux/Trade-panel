"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import type { ScanRow, ScanConfig } from "@/lib/store/backtestStore";

function downloadScanCsv(rows: ScanRow[], config: ScanConfig | null): void {
  const header = "Pair,Trades,WinRate%,AvgR,EV,Sharpe,ProfitFactor,MaxDrawdownR,LongWR%,ShortWR%";
  const dataRows = rows.map((r) =>
    [
      r.pair,
      r.totalTrades,
      r.winRate.toFixed(1),
      r.avgR !== null ? r.avgR.toFixed(3) : "",
      r.ev !== null ? r.ev.toFixed(4) : "",
      r.sharpe !== null ? r.sharpe.toFixed(3) : "",
      r.profitFactor !== null ? r.profitFactor.toFixed(3) : "",
      r.maxDrawdownR.toFixed(2),
      r.longWinRate !== null ? r.longWinRate.toFixed(1) : "",
      r.shortWinRate !== null ? r.shortWinRate.toFixed(1) : "",
    ].join(","),
  );
  const meta = config
    ? `# Scan: ${config.dataMonths}mo, F&G ${config.frozenFg}${config.minScore ? `, minScore≥${config.minScore}` : ""}\n`
    : "";
  const csv = meta + [header, ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scan_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  rows: ScanRow[];
  scanDone: number;
  scanTotal: number;
  scanCurrentPair: string | null;
  config: ScanConfig | null;
  status: "scanning" | "done" | "error";
}

type SortKey = "ev" | "winRate" | "avgR" | "sharpe" | "profitFactor" | "totalTrades" | "longWinRate" | "shortWinRate";
type SortDir = "desc" | "asc";

function getValue(row: ScanRow, key: SortKey): number {
  switch (key) {
    case "ev":            return row.ev ?? -999;
    case "winRate":       return row.winRate;
    case "avgR":          return row.avgR ?? -999;
    case "sharpe":        return row.sharpe ?? -999;
    case "profitFactor":  return row.profitFactor ?? -999;
    case "totalTrades":   return row.totalTrades;
    case "longWinRate":   return row.longWinRate ?? -999;
    case "shortWinRate":  return row.shortWinRate ?? -999;
  }
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
  const [sortKey, setSortKey] = useState<SortKey>("ev");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...rows].sort((a, b) => {
      const diff = getValue(b, sortKey) - getValue(a, sortKey);
      return sortDir === "desc" ? diff : -diff;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const scanPct = scanTotal > 0 ? Math.round((scanDone / scanTotal) * 100) : 0;

  function Th({ label, sk, right = true }: { label: string; sk: SortKey; right?: boolean }) {
    const active = sortKey === sk;
    const arrow = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
    return (
      <th
        onClick={() => handleSort(sk)}
        className={`cursor-pointer select-none py-1.5 pr-3 hover:text-text-t2 transition-colors ${right ? "text-right" : "text-left"} ${active ? "text-text-t2" : "text-text-t4"}`}
      >
        {label}{arrow}
      </th>
    );
  }

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
            <div className="flex items-center gap-3">
              {config && (
                <span className="text-text-t4 font-mono text-2xs">
                  {config.dataMonths}{t("backtest.months")} · F&G {config.frozenFg}
                </span>
              )}
              {sorted.length > 0 && status === "done" && (
                <button
                  onClick={() => downloadScanCsv(sorted, config)}
                  className="text-text-t4 font-mono text-2xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors"
                >
                  ↓ CSV
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3 text-text-t4">#</th>
                  <th className="text-left py-1.5 pr-3 text-text-t4">{t("backtest.pair")}</th>
                  <Th label={t("backtest.totalTrades")} sk="totalTrades" />
                  <Th label={t("backtest.winRate")} sk="winRate" />
                  <Th label={t("backtest.avgR")} sk="avgR" />
                  <Th label="EV" sk="ev" />
                  <Th label="Sharpe" sk="sharpe" />
                  <Th label="PF" sk="profitFactor" />
                  <Th label="L%" sk="longWinRate" />
                  <Th label="S%" sk="shortWinRate" right={false} />
                </tr>
              </thead>
              <tbody>
                {(sorted as ScanRow[]).map((row: ScanRow, idx: number) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3 && row.status === "done" && (row.ev ?? 0) > 0 && sortKey === "ev";

                  if (row.status === "error") {
                    return (
                      <tr key={row.pair} className="border-b border-border/30">
                        <td className="text-text-t4 py-1.5 pr-3">{rank}</td>
                        <td className="text-text-t2 py-1.5 pr-3 font-semibold">{row.pair}</td>
                        <td colSpan={8} className="text-red-400 text-right py-1.5 text-2xs">
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
                      <td className={`text-right py-1.5 pr-3 tabular-nums ${
                        row.sharpe !== null && row.sharpe > 0.5 ? "text-green-400" :
                        row.sharpe !== null && row.sharpe > 0 ? "text-yellow-400" :
                        row.sharpe !== null ? "text-red-400" : "text-text-t4"
                      }`}>
                        {row.sharpe !== null ? row.sharpe.toFixed(2) : "—"}
                      </td>
                      <td className={`text-right py-1.5 pr-3 tabular-nums ${
                        row.profitFactor !== null && row.profitFactor >= 1.5 ? "text-green-400" :
                        row.profitFactor !== null && row.profitFactor >= 1 ? "text-yellow-400" :
                        row.profitFactor !== null ? "text-red-400" : "text-text-t4"
                      }`}>
                        {row.profitFactor !== null ? row.profitFactor.toFixed(2) : "—"}
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
            EV = WR% × AvgR · Sharpe = mean(R)/std(R) · L% = Long WR · S% = Short WR · click column to sort
          </p>
        </div>
      )}
    </div>
  );
}
