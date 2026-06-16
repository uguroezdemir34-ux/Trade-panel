"use client";

import { useMemo } from "react";
import { useAccountStore } from "@/lib/store/accountStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useT } from "@/lib/i18n/context";
import type { Pair } from "@/lib/constants/pairs";

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function safe(n: number): number {
  return isFinite(n) ? n : 0;
}
function safeDiv(a: number, b: number): number {
  return b !== 0 && isFinite(b) ? safe(a / b) : 0;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────
const EMERALD = "#10b981";
const CRIMSON = "#ef4444";
const AMBER   = "#f59e0b";
const GREY    = "#6b7280";

// ─── QX Score color — direction-aware thresholds ─────────────────────────────
// LONG:  ≥55 → emerald (uyumlu), 40–54 → amber (uyarı), <40 → crimson (ters)
// SHORT: ≤45 → emerald (uyumlu), 46–60 → amber (uyarı), >60 → crimson (ters)
function qxScoreColor(
  score: number | null,
  posDir: "LONG" | "SHORT" | "NEUTRAL",
): string {
  if (score === null) return GREY;
  if (posDir === "LONG") {
    if (score >= 55) return EMERALD;
    if (score >= 40) return AMBER;
    return CRIMSON;
  }
  if (posDir === "SHORT") {
    if (score <= 45) return EMERALD;
    if (score <= 60) return AMBER;
    return CRIMSON;
  }
  // NEUTRAL
  if (score >= 55) return EMERALD;
  if (score >= 40) return AMBER;
  return CRIMSON;
}

// ─── QX Score mini-LED rozeti ─────────────────────────────────────────────────
function QxScoreBadge({
  pair,
  posDir,
}: {
  pair: Pair;
  posDir: "LONG" | "SHORT" | "NEUTRAL";
}) {
  const result = useScoreStore((s) => s.results[pair]);
  const score  = result?.score ?? null;
  const color  = qxScoreColor(score, posDir);

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono shrink-0"
      style={{
        border: `1px solid ${color}38`,
        background: `${color}0e`,
      }}
    >
      <span className="text-2xs font-bold tracking-widest" style={{ color }}>QX</span>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {score !== null ? Math.round(score) : "—"}
      </span>
      {/* LED nokta */}
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{
          background: color,
          boxShadow: `0 0 5px 1px ${color}80, 0 0 10px 2px ${color}40`,
        }}
      />
    </div>
  );
}

// ─── WalletSummaryBar ─────────────────────────────────────────────────────────
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
        .reduce((sum, tr) => sum + safe(tr.exit?.pnlUsd ?? 0), 0),
    [trades, lastDailyResetAt],
  );

  const unrealizedPnl = useMemo(
    () => openPositions.reduce((sum, p) => sum + safe(p.upl), 0),
    [openPositions],
  );

  const dailyTotalUsd  = todayRealizedPnl + unrealizedPnl;
  const marginUsed     = balanceTotal - balanceFree;
  const marginRatioPct = balanceTotal > 0
    ? Math.min(100, safeDiv(marginUsed, balanceTotal) * 100)
    : 0;

  const marginBarColor   = marginRatioPct >= 80 ? "bg-signal-red"   : marginRatioPct >= 50 ? "bg-signal-amber"   : "bg-signal-green";
  const marginLabelColor = marginRatioPct >= 80 ? "text-signal-red" : marginRatioPct >= 50 ? "text-signal-amber" : "text-signal-green";
  const marginStatus     = marginRatioPct >= 80
    ? t("portfolio.wallet.danger")
    : marginRatioPct >= 50
    ? t("portfolio.wallet.caution")
    : t("portfolio.wallet.safe");

  const dailyColor = dailyTotalUsd >= 0 ? EMERALD : CRIMSON;
  const noData     = balanceTotal === 0;

  return (
    <div className="rounded-xl border border-border bg-surface-s1 overflow-hidden">

      {/* ── Üst: Equity / Margin Barı / Günlük P&L ──────────────────── */}
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
            className={`font-mono text-sm font-bold tabular-nums ${
              noData ? "text-text-t3" : dailyTotalUsd >= 0 ? "pnl-breathe-green" : "pnl-breathe-red"
            }`}
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

      {/* ── Pozisyon Kartları — masaüstünde 2 kolon ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
      {openPositions.map((pos) => {
        const isLong  = pos.direction === "LONG";
        const dirColor = isLong ? EMERALD : CRIMSON;
        const uplSafe  = safe(pos.upl);
        const roePct   = safe(pos.uplRatio) * 100;
        const pnlColor = uplSafe >= 0 ? EMERALD : CRIMSON;
        const margin   = safeDiv(pos.notional, pos.leverage > 0 ? pos.leverage : 1);

        return (
          <div
            key={pos.instId}
            className="border-t border-border lg:even:border-l px-3 py-3"
            style={{
              // Hafif aurora: yön rengi sol üstten soluklaşır → sayfa bg'si görünür
              background: `linear-gradient(150deg, ${dirColor}09 0%, transparent 62%)`,
              boxShadow: `inset 0 0 0 1px ${dirColor}20, inset 0 0 28px 0 ${dirColor}05`,
            }}
          >
            {/* ── Başlık satırı ───────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-2 mb-3">

              {/* Sol: yön+kaldıraç rozeti · pair · mod · QX skor */}
              <div className="flex flex-col gap-1.5 min-w-0">

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Yön + kaldıraç tek rozette */}
                  <div
                    className="inline-flex items-center gap-1 font-mono text-2xs font-bold px-2 py-0.5 rounded-md shrink-0"
                    style={{
                      color: dirColor,
                      background: `${dirColor}16`,
                      border: `1px solid ${dirColor}40`,
                      letterSpacing: "0.05em",
                    }}
                  >
                    <span>{isLong ? "▲ LONG" : "▼ SHORT"}</span>
                    <span style={{ opacity: 0.45 }}>·</span>
                    <span>{pos.leverage}x</span>
                  </div>

                  {/* Parite */}
                  <span className="font-mono text-sm font-bold text-text-t1 shrink-0">
                    {pos.pair}
                  </span>

                  {/* Margin modu */}
                  <span className="font-mono text-2xs text-text-t3 shrink-0">
                    {pos.mgnMode === "isolated" ? "Isolated" : "Cross"}
                  </span>
                </div>

                {/* QX Skor satırı */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-2xs text-text-t4 tracking-widest uppercase">
                    {t("portfolio.wallet.qxScore")}
                  </span>
                  <QxScoreBadge pair={pos.pair as Pair} posDir={pos.direction} />
                </div>
              </div>

              {/* Sağ: Büyük P&L — USD üst (büyük), ROE% alt (küçük) */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span
                  className={`font-mono text-xl font-bold tabular-nums leading-none ${
                    uplSafe >= 0 ? "pnl-breathe-green" : "pnl-breathe-red"
                  }`}
                  style={{ color: pnlColor }}
                >
                  {uplSafe >= 0 ? "+" : ""}${fmt(Math.abs(uplSafe), 2)}
                </span>
                <span
                  className="font-mono text-sm font-semibold tabular-nums"
                  style={{ color: pnlColor }}
                >
                  {signed(roePct)}%
                </span>
              </div>
            </div>

            {/* ── Detay grid: 3 × 2 ───────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-x-2 gap-y-2.5">

              {/* Satır 1: Pozisyon Büyüklüğü / Kullanılan Teminat / Likidasyon */}
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

              {/* Satır 2: Giriş / Mark / ROE */}
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

              {/* Satır 3: TP / SL */}
              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("position.takeProfit")}
                </div>
                {pos.tpTriggerPx !== null && pos.entryPx > 0 ? (
                  <>
                    <div className="font-mono text-xs font-semibold tabular-nums" style={{ color: EMERALD }}>
                      ${fmtPx(pos.tpTriggerPx)}
                    </div>
                    <div className="font-mono text-2xs tabular-nums text-text-t4">
                      {signed(safeDiv(pos.tpTriggerPx - pos.entryPx, pos.entryPx) * 100)}%
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-xs text-text-t3">—</div>
                )}
              </div>

              <div>
                <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                  {t("position.stopLoss")}
                </div>
                {pos.slTriggerPx !== null && pos.entryPx > 0 ? (
                  <>
                    <div className="font-mono text-xs font-semibold tabular-nums" style={{ color: CRIMSON }}>
                      ${fmtPx(pos.slTriggerPx)}
                    </div>
                    <div className="font-mono text-2xs tabular-nums text-text-t4">
                      {signed(safeDiv(pos.slTriggerPx - pos.entryPx, pos.entryPx) * 100)}%
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-xs text-text-t3">—</div>
                )}
              </div>

              <div /> {/* 3. kolon boş — simetri */}

            </div>
          </div>
        );
      })}
      </div>

    </div>
  );
}
