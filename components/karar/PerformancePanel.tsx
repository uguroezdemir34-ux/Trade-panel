"use client";

/**
 * PERFORMANCE PANEL — /karar SOL sütununda kısa performans özeti.
 *
 * tradesStore'daki gerçek kapanmış işlemlerden (reconciler/Supabase kaynaklı,
 * /pnl sayfasındaki aynı veri) Win Rate / Profit Factor / Sharpe / Avg R
 * hesaplar — lib/pnl/stats.ts'teki computePnlStats() zaten var, YENİ
 * HESAPLAMA YOK. "Son 30 işlem" filtresi filterLastNTrades() ile (count-
 * bazlı, filterLastNDays'in gün-bazlı karşılığı).
 *
 * UYDURMA VERİ YOK: yeterli veri olmayan her metrik "—" gösterir, tahmini
 * sayı üretilmez (computePnlStats zaten null döner, burada sadece render
 * ediliyor).
 */

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useT } from "@/lib/i18n/context";
import { computePnlStats, filterLastNTrades } from "@/lib/pnl/stats";
import type { TradeRecord } from "@/lib/pnl/types";

const LAST_N_TRADES = 30;

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
function fmtRatio(n: number | null): string {
  if (n === null || !isFinite(n)) return "—";
  return n.toFixed(2);
}

export function PerformancePanel(): React.ReactElement {
  const t = useT();
  const snapshots = useTradesStore((s) => s.trades);

  const allTrades: TradeRecord[] = useMemo(
    () =>
      snapshots
        .filter((s) => s.status === "closed" && s.exit != null)
        .map((s) => ({
          closedAt: s.exit!.closedAt,
          openedAt: s.openedAt,
          pair: s.pair,
          direction: s.direction,
          pnlUsd: s.exit!.pnlUsd,
          pnlPct: s.exit!.pnlPct,
          score: s.entryContext.score,
          closeReason: s.exit!.reason,
          rMultiple: s.exit!.rMultiple,
        })),
    [snapshots],
  );

  const windowTrades = useMemo(() => filterLastNTrades(allTrades, LAST_N_TRADES), [allTrades]);
  const stats = useMemo(() => computePnlStats(windowTrades), [windowTrades]);

  if (allTrades.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-s1 px-3 py-2.5">
        <span className="font-mono text-2xs text-text-t3 uppercase tracking-wider">
          {t("performance.title")}
        </span>
        <div className="mt-1 font-mono text-xs text-text-t4">{t("performance.insufficientData")}</div>
      </div>
    );
  }

  const countNote =
    windowTrades.length < LAST_N_TRADES
      ? t("performance.tradeCountNote").replace("{n}", String(windowTrades.length))
      : t("performance.last30Note");

  return (
    <div className="rounded-lg border border-border bg-surface-s1 px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-t3 uppercase tracking-wider">
          {t("performance.title")}
        </span>
        <span className="font-mono text-2xs text-text-t4">{countNote}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
            {t("performance.winRate")}
          </div>
          <div
            className="font-mono text-sm font-bold tabular-nums"
            style={{ color: stats.winRate >= 0.5 ? "#10b981" : "#ef4444" }}
          >
            {fmtPct(stats.winRate)}
          </div>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
            {t("performance.profitFactor")}
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-text-t1">
            {stats.profitFactor === Infinity ? "∞" : fmtRatio(stats.profitFactor)}
          </div>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
            {t("performance.sharpe")}
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-text-t1">
            {fmtRatio(stats.sharpe)}
          </div>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
            {t("performance.avgR")}
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-text-t1">
            {fmtRatio(stats.avgWinLossRatio)}
          </div>
        </div>
      </div>
    </div>
  );
}
