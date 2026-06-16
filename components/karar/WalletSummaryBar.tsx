"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/lib/store/accountStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useT } from "@/lib/i18n/context";

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function signed(n: number, dec = 2): string {
  return (n >= 0 ? "+" : "") + n.toFixed(dec);
}

export function WalletSummaryBar(): React.ReactElement {
  const t = useT();
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const balanceFree = useAccountStore((s) => s.balanceFree);
  const dailyPnlPct = useAccountStore((s) => s.dailyPnlPct);
  const lastDailyResetAt = useAccountStore((s) => s.lastDailyResetAt);

  const trades = useTradesStore((s) => s.trades);
  const openPositions = usePositionStore((s) => s.positions);

  const todayRealizedPnl = useMemo(
    () =>
      trades
        .filter((tr) => tr.status === "closed" && (tr.exit?.closedAt ?? 0) >= lastDailyResetAt)
        .reduce((sum, tr) => sum + (tr.exit?.pnlUsd ?? 0), 0),
    [trades, lastDailyResetAt],
  );

  const unrealizedPnl = useMemo(
    () => openPositions.reduce((sum, p) => sum + p.upl, 0),
    [openPositions],
  );

  const dailyTotalUsd = todayRealizedPnl + unrealizedPnl;

  const marginUsed = balanceTotal - balanceFree;
  const marginRatioPct =
    balanceTotal > 0 ? Math.min(100, (marginUsed / balanceTotal) * 100) : 0;

  const marginBarColor =
    marginRatioPct >= 80
      ? "bg-signal-red"
      : marginRatioPct >= 50
      ? "bg-signal-amber"
      : "bg-signal-green";

  const marginLabelColor =
    marginRatioPct >= 80
      ? "text-signal-red"
      : marginRatioPct >= 50
      ? "text-signal-amber"
      : "text-signal-green";

  const marginStatus =
    marginRatioPct >= 80
      ? t("portfolio.wallet.danger")
      : marginRatioPct >= 50
      ? t("portfolio.wallet.caution")
      : t("portfolio.wallet.safe");

  const dailyPnlColor = dailyTotalUsd >= 0 ? "text-signal-green" : "text-signal-red";
  const dailyPnlGlow =
    dailyTotalUsd >= 0
      ? "0 0 8px rgba(34,197,94,0.4)"
      : "0 0 8px rgba(239,68,68,0.4)";

  const noData = balanceTotal === 0;

  return (
    <div className="rounded-lg border border-border bg-surface-s1 px-3 py-2.5">
      <div className="grid grid-cols-3 gap-3">

        {/* 1 — Total Equity */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase truncate">
            {t("portfolio.overview.totalEquity")}
          </span>
          {noData ? (
            <span className="font-mono text-sm font-bold text-text-t3">—</span>
          ) : (
            <span className="font-mono text-sm font-bold text-text-t1 tabular-nums">
              ${fmt(balanceTotal)}
            </span>
          )}
          {!noData && (
            <span className="font-mono text-2xs text-text-t4 tabular-nums">
              {t("portfolio.overview.free")} ${fmt(balanceFree)}
            </span>
          )}
        </div>

        {/* 2 — Margin Ratio Bar */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase truncate">
              {t("portfolio.wallet.marginUsed")}
            </span>
            {!noData && (
              <span className={`font-mono text-2xs font-semibold shrink-0 ${marginLabelColor}`}>
                {marginRatioPct.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-bg-card overflow-hidden my-0.5">
            {noData ? (
              <div className="h-full w-0 rounded-full" />
            ) : (
              <div
                className={`h-full rounded-full transition-all duration-700 ${marginBarColor}`}
                style={{ width: `${marginRatioPct}%` }}
              />
            )}
          </div>
          <span
            className={`font-mono text-2xs font-medium ${
              noData ? "text-text-t4" : marginLabelColor
            }`}
          >
            {noData ? "—" : marginStatus}
          </span>
        </div>

        {/* 3 — Daily P&L */}
        <div className="flex flex-col gap-0.5 min-w-0 items-end text-right">
          <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase truncate">
            {t("portfolio.wallet.dailyTotal")}
          </span>
          {noData ? (
            <span className="font-mono text-sm font-bold text-text-t3">—</span>
          ) : (
            <span
              className={`font-mono text-sm font-bold tabular-nums ${dailyPnlColor}`}
              style={{ textShadow: dailyTotalUsd !== 0 ? dailyPnlGlow : undefined }}
            >
              {dailyTotalUsd >= 0 ? "+" : ""}${fmt(Math.abs(dailyTotalUsd), 2)}
            </span>
          )}
          {!noData && (
            <span className={`font-mono text-2xs tabular-nums ${dailyPnlColor}`}>
              {signed(dailyPnlPct)}%
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
