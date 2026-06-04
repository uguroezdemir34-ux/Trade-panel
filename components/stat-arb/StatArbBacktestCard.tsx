"use client";

import { useState } from "react";
import type { StatArbBacktestResult } from "@/lib/backtest/statArbBacktest";
import { SpreadChart } from "./SpreadChart";

interface StatArbBacktestCardProps {
  result: StatArbBacktestResult;
  entryThreshold: number;
  exitThreshold: number;
  emergencyThreshold: number;
}

export function StatArbBacktestCard({
  result,
  entryThreshold,
  exitThreshold,
  emergencyThreshold,
}: StatArbBacktestCardProps) {
  const [showTrades, setShowTrades] = useState(false);

  const winRate = (result.winRate * 100).toFixed(1);
  const correlation = result.correlation !== null ? result.correlation.toFixed(3) : "—";
  const corrColor =
    result.correlation === null
      ? "text-muted-foreground"
      : Math.abs(result.correlation) >= 0.8
      ? "text-signal-green"
      : Math.abs(result.correlation) >= 0.6
      ? "text-yellow-400"
      : "text-red-400";

  const dateRange = `${new Date(result.dataFrom).toLocaleDateString("tr", { month: "short", day: "numeric" })} — ${new Date(result.dataTo).toLocaleDateString("tr", { month: "short", day: "numeric" })}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Spread Analizi
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {result.pairA} / {result.pairB}
          </span>
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">{dateRange}</span>
      </div>

      {/* Disclaimer */}
      <div className="text-[10px] text-yellow-500/80 bg-yellow-500/5 border border-yellow-500/20 rounded px-2 py-1.5">
        ⚠️ {result.disclaimer}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="Trade Sayısı" value={result.totalTrades.toString()} />
        <StatCell
          label="Kazanma Oranı"
          value={`${winRate}%`}
          color={result.winRate >= 0.6 ? "text-signal-green" : result.winRate >= 0.5 ? "text-yellow-400" : "text-red-400"}
        />
        <StatCell
          label="Ort. Tutma"
          value={`${result.avgBarsHeld}h`}
        />
        <StatCell
          label="Korelasyon"
          value={correlation}
          color={corrColor}
        />
        <StatCell
          label="Hedge β"
          value={result.hedgeRatio.toFixed(4)}
        />
        <StatCell
          label="Max Ardışık Kayıp"
          value={result.maxConsecutiveLoss.toString()}
          color={result.maxConsecutiveLoss >= 4 ? "text-red-400" : "text-muted-foreground"}
        />
      </div>

      {/* Z-score chart */}
      {result.zScoreSeries.length > 2 && (
        <div>
          <p className="text-[10px] text-muted-foreground font-mono mb-1">Z-Score Geçmişi</p>
          <SpreadChart
            data={result.zScoreSeries}
            entryThreshold={entryThreshold}
            exitThreshold={exitThreshold}
            emergencyThreshold={emergencyThreshold}
            height={140}
          />
        </div>
      )}

      {/* Trades toggle */}
      {result.trades.length > 0 && (
        <div>
          <button
            onClick={() => setShowTrades((v) => !v)}
            className="text-xs text-primary hover:underline font-mono"
          >
            {showTrades ? "▲ Tradeler gizle" : `▼ ${result.trades.length} trade göster`}
          </button>

          {showTrades && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1">Tarih</th>
                    <th className="text-left pb-1">Yön</th>
                    <th className="text-right pb-1">Giriş Z</th>
                    <th className="text-right pb-1">Çıkış Z</th>
                    <th className="text-right pb-1">Süre</th>
                    <th className="text-right pb-1">Neden</th>
                    <th className="text-right pb-1">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.slice(-30).map((t, i) => {
                    const win = t.spreadPnl > 0;
                    const sideShort = t.side === "long_A_short_B" ? "LA/SB" : "SA/LB";
                    return (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-0.5 text-muted-foreground">
                          {new Date(t.entryTs).toLocaleDateString("tr", { month: "short", day: "numeric" })}
                        </td>
                        <td className="py-0.5">{sideShort}</td>
                        <td className="text-right">{t.entryZScore.toFixed(2)}</td>
                        <td className="text-right">{t.exitZScore.toFixed(2)}</td>
                        <td className="text-right">{t.barsHeld}h</td>
                        <td className="text-right text-muted-foreground">
                          {t.exitReason === "mean_reversion" ? "MR" : t.exitReason === "emergency" ? "EM" : "TO"}
                        </td>
                        <td className={`text-right font-semibold ${win ? "text-signal-green" : "text-red-400"}`}>
                          {win ? "+" : ""}{t.spreadPnl.toFixed(5)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {result.trades.length > 30 && (
                <p className="text-[10px] text-muted-foreground mt-1">Son 30 trade gösteriliyor ({result.trades.length} toplam)</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-muted/30 rounded p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
    </div>
  );
}
