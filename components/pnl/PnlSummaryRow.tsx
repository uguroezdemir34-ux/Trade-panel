"use client";

/**
 * PNL SUMMARY ROW — Bu hafta + bu ay + tüm zaman özeti.
 *
 * Üst sıraya konur — 3 stat kart yan yana.
 */

import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";
import { filterLastNDays, computePnlStats } from "@/lib/pnl/stats";

interface Props {
  trades: TradeRecord[];
}

export function PnlSummaryRow({ trades }: Props): React.ReactElement {
  const t = useT();
  const now = Date.now();

  const thisWeek = filterLastNDays(trades, 7, now);
  const thisMonth = filterLastNDays(trades, 30, now);

  const weekStats = computePnlStats(thisWeek);
  const monthStats = computePnlStats(thisMonth);
  const allStats = computePnlStats(trades);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <SummaryCell
        label={t("pnl.summary.thisWeek")}
        pnl={weekStats.totalPnlUsd}
        count={weekStats.totalTrades}
        winRate={weekStats.totalTrades > 0 ? weekStats.winRate : null}
      />
      <SummaryCell
        label={t("pnl.summary.thisMonth")}
        pnl={monthStats.totalPnlUsd}
        count={monthStats.totalTrades}
        winRate={monthStats.totalTrades > 0 ? monthStats.winRate : null}
      />
      <SummaryCell
        label={t("pnl.summary.allTime")}
        pnl={allStats.totalPnlUsd}
        count={allStats.totalTrades}
        winRate={allStats.totalTrades > 0 ? allStats.winRate : null}
      />
    </div>
  );
}

function SummaryCell({
  label,
  pnl,
  count,
  winRate,
}: {
  label: string;
  pnl: number;
  count: number;
  winRate: number | null;
}) {
  const color =
    pnl > 0 ? "text-signal-green" : pnl < 0 ? "text-signal-red" : "text-text-t2";
  const sign = pnl >= 0 ? "+" : "";
  const wrColor = winRate === null ? "text-text-t4"
    : winRate >= 0.6 ? "text-green-400"
    : winRate >= 0.5 ? "text-yellow-400"
    : "text-red-400";
  return (
    <div className="border-border bg-bg-card rounded-md border p-2">
      <div className="text-text-t3 font-mono text-2xs tracking-wider">
        {label}
      </div>
      <div className={`font-mono text-sm font-bold tabular-nums ${color}`}>
        {sign}${pnl.toFixed(2)}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-text-t4 font-mono text-2xs">{count}t</span>
        {winRate !== null && count > 0 && (
          <span className={`font-mono text-2xs font-semibold tabular-nums ${wrColor}`}>
            {(winRate * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
