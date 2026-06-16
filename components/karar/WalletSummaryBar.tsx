"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/lib/store/accountStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useT } from "@/lib/i18n/context";
import type { Pair } from "@/lib/constants/pairs";

// ─── Formatting helpers ───────────────────────────────────────────────────────
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

// ─── Color constants (Neon Emerald / Neon Crimson — user spec) ───────────────
const EMERALD = "#10b981";
const CRIMSON = "#ef4444";
const AMBER   = "#f59e0b";

// ─── Score badge ──────────────────────────────────────────────────────────────
function scoreBadgeColor(
  score: number | null,
  posDir: "LONG" | "SHORT" | "NEUTRAL",
  scoreDir: "LONG" | "SHORT" | "NEUTRAL" | undefined,
): string {
  if (score === null) return "#6b7280"; // grey — no data
  const conflict =
    (posDir === "LONG"  && scoreDir === "SHORT") ||
    (posDir === "SHORT" && scoreDir === "LONG");
  if (conflict || score < 50) return CRIMSON;
  if (score >= 70) return EMERALD;
  return AMBER;
}

// ─── QX Score Rozeti ─────────────────────────────────────────────────────────
function QxScoreBadge({
  pair,
  posDir,
}: {
  pair: Pair;
  posDir: "LONG" | "SHORT" | "NEUTRAL";
}) {
  const result = useScoreStore((s) => s.results[pair]);
  const score    = result?.score    ?? null;
  const scoreDir = result?.direction;
  const color    = scoreBadgeColor(score, posDir, scoreDir);

  return (
    <div
      className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono shrink-0"
      style={{
        border: `1px solid ${color}40`,
        background: `${color}12`,
      }}
    >
      <span className="text-2xs font-bold tracking-wider" style={{ color }}>QX</span>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {score !== null ? Math.round(score) : "—"}
      </span>
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: color,
          boxShadow: `0 0 5px ${color}90`,
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WalletSummaryBar() {
  const t = useT();

  const balanceTotal     = useAccountStore((s) => s.balanceTotal);
  const balanceFree      = useAccountStore((s) => s.balanceFree);
  const dailyPnlPct      = useAccountStore((s) => s.dailyPnlPct);
  const lastDailyResetAt = useAccountStore((s) => s.lastDailyResetAt);
  const trades           = useTradesStore((s) => s.trades);
  const openPositions    = usePositionStore((s) => s.positions);

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

  const dailyTotalUsd  = todayRealizedPnl + unrealizedPnl;
  const marginUsed     = balanceTotal - balanceFree;
  const marginRatioPct = balanceTotal > 0
    ? Math.min(100, (marginUsed / balanceTotal) * 100)
    : 0;

  // Margin bar colours (existing token system)
  const marginBarColor   = marginRatioPct >= 80 ? "bg-signal-red"   : marginRatioPct >= 50 ? "bg-signal-amber"   : "bg-signal-green";
  const marginLabelColor = marginRatioPct >= 80 ? "text-signal-red" : marginRatioPct >= 50 ? "text-signal-amber" : "text-signal-green";
  const marginStatus     = marginRatioPct >= 80
    ? t("portfolio.wallet.danger")
    : marginRatioPct >= 50
    ? t("portfolio.wallet.caution")
    : t("portfolio.wallet.safe");

  // Daily PnL colours (Neon spec)
  const dailyColor = dailyTotalUsd >= 0 ? EMERALD : CRIMSON;
  const noData     = balanceTotal === 0;

  return (
    <div className="rounded-lg border border-border bg-surface-s1 overflow-hidden">

      {/* ── Satır 1: Equity / Margin Bar / Daily PnL ─────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-3 py-2.5">

        {/* Toplam Özsermaye */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase truncate">
            {t("portfolio.overview.totalEquity")}
          </span>
          <span className="font-mono text-sm font-bold text-text-t1 tabular-nums">
            {noData ? "—" : `$${fmt(balanceTotal)}`}
          </span>
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
          <span
            className={`font-mono text-sm font-bold tabular-nums ${noData ? "text-text-t3" : dailyTotalUsd >= 0 ? "pnl-breathe-green" : "pnl-breathe-red"}`}
            style={noData ? undefined : { color: dailyColor }}
          >
            {noData ? "—" : `${dailyTotalUsd >= 0 ? "+" : ""}$${fmt(Math.abs(dailyTotalUsd), 2)}`}
          </span>
          {!noData && (
            <span className="font-mono text-2xs tabular-nums" style={{ color: dailyColor }}>
              {signed(dailyPnlPct)}%
            </span>
          )}
        </div>
      </div>

      {/* ── Satır 2+: Açık Pozisyon Kartları (QUANTIX × OKX stili) ──── */}
      {openPositions.map((pos) => {
        const isLong   = pos.direction === "LONG";
        const dirColor = isLong ? EMERALD : CRIMSON;
        const pnlColor = pos.upl >= 0 ? EMERALD : CRIMSON;
        const roePct   = pos.uplRatio * 100;
        const margin   = pos.leverage > 0 ? pos.notional / pos.leverage : 0;

        // Aurora glow — yön bazlı, hafif
        const cardStyle = {
          background: `linear-gradient(135deg, ${dirColor}05 0%, transparent 55%)`,
          boxShadow: `inset 0 0 0 1px ${dirColor}18`,
        };

        return (
          <div key={pos.instId} className="border-t border-border px-3 py-2.5" style={cardStyle}>

            {/* ── Üst satır: Yön rozeti + Parite + Borsa bilgisi | QX Skor | P&L ── */}
            <div className="flex items-start justify-between gap-2 mb-2.5">

              {/* Sol: rozet + pair + borsa */}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Yön rozeti */}
                  <div
                    className="font-mono text-2xs font-bold px-2 py-0.5 rounded shrink-0"
                    style={{
                      color: dirColor,
                      background: `${dirColor}18`,
                      border: `1px solid ${dirColor}35`,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {isLong ? "▲ LONG" : "▼ SHORT"}
                  </div>

                  {/* Pair */}
                  <span className="font-mono text-sm font-bold text-text-t1 shrink-0">
                    {pos.pair}
                  </span>

                  {/* Borsa modu + kaldıraç */}
                  <span className="font-mono text-2xs text-text-t3 shrink-0">
                    {pos.mgnMode === "isolated" ? "Isolated" : "Cross"} · {pos.leverage}×
                  </span>
                </div>

                {/* QX Skor rozeti */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase">
                    {t("portfolio.wallet.qxScore")}
                  </span>
                  <QxScoreBadge pair={pos.pair as Pair} posDir={pos.direction} />
                </div>
              </div>

              {/* Sağ: Büyük P&L */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span
                  className={`font-mono text-lg font-bold tabular-nums leading-tight ${pos.upl >= 0 ? "pnl-breathe-green" : "pnl-breathe-red"}`}
                  style={{ color: pnlColor }}
                >
                  {pos.upl >= 0 ? "+" : ""}{roePct.toFixed(2)}%
                </span>
                <span
                  className="font-mono text-sm font-semibold tabular-nums"
                  style={{ color: pnlColor }}
                >
                  {pos.upl >= 0 ? "+" : ""}${fmt(Math.abs(pos.upl), 2)}
                </span>
              </div>
            </div>

            {/* ── Grid: 3 sütun × 2 satır ─────────────────────────────── */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-2">

              {/* Satır 1 */}
              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("portfolio.wallet.posSize")}
                </div>
                <div className="font-mono text-xs font-semibold text-text-t1 tabular-nums">
                  ${fmt(pos.notional, 0)}
                </div>
              </div>

              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("portfolio.wallet.usedMargin")}
                </div>
                <div className="font-mono text-xs font-semibold text-text-t1 tabular-nums">
                  ${fmt(margin, 0)}
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("portfolio.wallet.liqPriceLabel")}
                </div>
                <div
                  className="font-mono text-xs font-semibold tabular-nums"
                  style={{ color: pos.liqPx ? CRIMSON : undefined }}
                >
                  {pos.liqPx ? `$${fmtPx(pos.liqPx)}` : "—"}
                </div>
              </div>

              {/* Satır 2 */}
              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("position.entry")}
                </div>
                <div className="font-mono text-xs text-text-t1 tabular-nums">
                  ${fmtPx(pos.entryPx)}
                </div>
              </div>

              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("position.mark")}
                </div>
                <div className="font-mono text-xs text-text-t1 tabular-nums">
                  ${fmtPx(pos.markPx)}
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("position.roe")}
                </div>
                <div
                  className="font-mono text-xs font-semibold tabular-nums"
                  style={{ color: pnlColor }}
                >
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
