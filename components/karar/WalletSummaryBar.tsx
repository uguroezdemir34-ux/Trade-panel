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

function fmtPx(n: number): string {
  if (n >= 10_000) return fmt(n, 1);
  if (n >= 100)    return fmt(n, 2);
  if (n >= 1)      return n.toFixed(4);
  return n.toFixed(6);
}

export function WalletSummaryBar(): React.ReactElement {
  const t = useT();

  const balanceTotal     = useAccountStore((s) => s.balanceTotal);
  const balanceFree      = useAccountStore((s) => s.balanceFree);
  const dailyPnlPct      = useAccountStore((s) => s.dailyPnlPct);
  const lastDailyResetAt = useAccountStore((s) => s.lastDailyResetAt);

  const trades        = useTradesStore((s) => s.trades);
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

  const marginUsed     = balanceTotal - balanceFree;
  const marginRatioPct = balanceTotal > 0
    ? Math.min(100, (marginUsed / balanceTotal) * 100)
    : 0;

  const marginBarColor   = marginRatioPct >= 80 ? "bg-signal-red"   : marginRatioPct >= 50 ? "bg-signal-amber"   : "bg-signal-green";
  const marginLabelColor = marginRatioPct >= 80 ? "text-signal-red" : marginRatioPct >= 50 ? "text-signal-amber" : "text-signal-green";
  const marginStatus     = marginRatioPct >= 80
    ? t("portfolio.wallet.danger")
    : marginRatioPct >= 50
    ? t("portfolio.wallet.caution")
    : t("portfolio.wallet.safe");

  const dailyPnlColor = dailyTotalUsd >= 0 ? "text-signal-green" : "text-signal-red";
  const dailyPnlGlow  = dailyTotalUsd >= 0
    ? "0 0 8px rgba(34,197,94,0.4)"
    : "0 0 8px rgba(239,68,68,0.4)";

  const noData = balanceTotal === 0;

  return (
    <div className="rounded-lg border border-border bg-surface-s1 overflow-hidden">

      {/* ── Satır 1: Equity / Margin Bar / Daily PnL ─────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-3 py-2.5">

        {/* Toplam Özsermaye */}
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

        {/* Teminat Kullanım Barı */}
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
            {!noData && (
              <div
                className={`h-full rounded-full transition-all duration-700 ${marginBarColor}`}
                style={{ width: `${marginRatioPct}%` }}
              />
            )}
          </div>
          <span className={`font-mono text-2xs font-medium ${noData ? "text-text-t4" : marginLabelColor}`}>
            {noData ? "—" : marginStatus}
          </span>
        </div>

        {/* Günlük Toplam P&L */}
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

      {/* ── Satır 2+: Açık Pozisyonlar (OKX formatı, QUANTIX stili) ──── */}
      {openPositions.map((pos) => {
        const isLong      = pos.direction === "LONG";
        const pnlColor    = pos.upl >= 0 ? "text-signal-green" : "text-signal-red";
        const dirColor    = isLong ? "text-signal-green" : "text-signal-red";
        const dirLabel    = isLong ? "▲ LONG" : "▼ SHORT";
        const roePct      = pos.uplRatio * 100;
        const impliedMgn  = pos.leverage > 0 ? pos.notional / pos.leverage : 0;

        return (
          <div key={pos.instId} className="border-t border-border bg-surface-s2 px-3 py-2">

            {/* Üst satır: Parite + yön + kaldıraç | UPL */}
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-xs font-bold text-text-t1 shrink-0">
                  {pos.pair}
                </span>
                <span className={`font-mono text-2xs font-semibold shrink-0 ${dirColor}`}>
                  {dirLabel}
                </span>
                <span className="font-mono text-2xs text-text-t3 shrink-0">
                  {pos.mgnMode === "isolated" ? "Isolated" : "Cross"} · {pos.leverage}×
                </span>
              </div>
              <span
                className={`font-mono text-xs font-bold tabular-nums shrink-0 ${pnlColor}`}
                style={{ textShadow: pos.upl !== 0 ? (pos.upl >= 0 ? "0 0 6px rgba(34,197,94,0.45)" : "0 0 6px rgba(239,68,68,0.45)") : undefined }}
              >
                {pos.upl >= 0 ? "+" : ""}${fmt(Math.abs(pos.upl), 2)}{" "}
                <span className="text-2xs font-normal opacity-80">
                  ({signed(roePct)}%)
                </span>
              </span>
            </div>

            {/* Grid 3 sütun: Size / Margin / Liq */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
                  {t("position.notional")}
                </div>
                <div className="font-mono text-xs text-text-t1 tabular-nums">
                  ${fmt(pos.notional, 0)}
                </div>
              </div>
              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
                  {t("position.margin")}
                </div>
                <div className="font-mono text-xs text-text-t1 tabular-nums">
                  ${fmt(impliedMgn, 0)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
                  {t("position.liqPrice")}
                </div>
                <div className={`font-mono text-xs tabular-nums ${pos.liqPx ? "text-signal-red" : "text-text-t3"}`}>
                  {pos.liqPx ? `$${fmtPx(pos.liqPx)}` : "—"}
                </div>
              </div>

              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
                  {t("position.entry")}
                </div>
                <div className="font-mono text-xs text-text-t1 tabular-nums">
                  ${fmtPx(pos.entryPx)}
                </div>
              </div>
              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
                  {t("position.mark")}
                </div>
                <div className="font-mono text-xs text-text-t1 tabular-nums">
                  ${fmtPx(pos.markPx)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
                  {t("position.roe")}
                </div>
                <div className={`font-mono text-xs tabular-nums ${pnlColor}`}>
                  {signed(roePct)}%
                </div>
              </div>
            </div>

          </div>
        );
      })}

    </div>
  );
}
