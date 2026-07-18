"use client";

/**
 * POSITION CARD — Tek bir açık pozisyonun görünümü.
 *
 * Yapı:
 *   Header: pair + LONG/SHORT badge + holding süresi
 *   Stats: Entry / Mark / UPL / ROE (live updated)
 *   SL/TP: Stop Loss + Take Profit — inline editable
 *   TP1 progress bar (varsa)
 *   Liq Price: Prominence based on distance from current price
 *   Scale-In / Scale-Out controls
 *   Close button
 */

import { useState, useEffect } from "react";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatPrice, formatPercent, formatCoinAmount } from "@/lib/i18n/format";
import { useMarketStore } from "@/lib/store/marketStore";
import {
  computeLiveUpl,
  computeRoe,
  computeTpProgress,
  categorizeHoldingDuration,
} from "@/lib/sizer/position-pnl";
import { useScoreStore } from "@/lib/store/scoreStore";
import { isNativePlatform } from "@/lib/mobile/platform";
import type { Position } from "@/lib/okx/positions";

export function PositionCard({
  position,
  onClose: onCloseProp,
  isClosing,
  onScaleIn: onScaleInProp,
  onScaleOut: onScaleOutProp,
  onUpdateSlTp: onUpdateSlTpProp,
  tradeSl,
  tradeTp1,
  tradeTp2,
}: {
  position: Position;
  onClose?: () => void;
  isClosing: boolean;
  onScaleIn?: (qty: number) => Promise<void>;
  onScaleOut?: (qty: number) => Promise<void>;
  onUpdateSlTp?: (slPrice: number | null, tp1Price: number | null, tp2Price?: number | null) => Promise<void>;
  /** App-layer SL from tradesStore — used for desync detection */
  tradeSl?: number | null;
  /** App-layer TP1 from tradesStore */
  tradeTp1?: number | null;
  /** App-layer TP2 from tradesStore (app-only, not all exchanges support it) */
  tradeTp2?: number | null;
}): React.ReactElement {
  const t = useT();
  const locale = useLocale();
  const tick = useMarketStore((s) => s.prices[position.pair]);
  const scoreResult = useScoreStore((s) => s.results[position.pair]);

  // Native Android app'te (Play Store dağıtımı) pozisyon kapatma/scale-in-out/
  // SL-TP güncelleme HİÇBİR ZAMAN sunulmuyor — parent bu handler'ları web için
  // ileride bağlasa bile burada otomatik devre dışı kalır (bkz. QuickTradeSheet.tsx
  // aynı desen, "Google Play Financial Features" riskini azaltma kararı).
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);
  const onClose = isNative ? undefined : onCloseProp;
  const onScaleIn = isNative ? undefined : onScaleInProp;
  const onScaleOut = isNative ? undefined : onScaleOutProp;
  const onUpdateSlTp = isNative ? undefined : onUpdateSlTpProp;

  // Scale-in state
  const [showScaleIn, setShowScaleIn] = useState(false);
  const [scaleInQty, setScaleInQty] = useState("");
  const [scaleInLoading, setScaleInLoading] = useState(false);
  const [scaleInError, setScaleInError] = useState<string | null>(null);

  // Scale-out state
  const [showScaleOut, setShowScaleOut] = useState(false);
  const [scaleOutLoading, setScaleOutLoading] = useState(false);
  const [scaleOutError, setScaleOutError] = useState<string | null>(null);

  // SL/TP edit state
  const [editingSlTp, setEditingSlTp] = useState(false);
  const [editSl, setEditSl] = useState(String(position.slTriggerPx ?? ""));
  const [editTp, setEditTp] = useState(String(position.tpTriggerPx ?? tradeTp1 ?? ""));
  const [editTp2, setEditTp2] = useState(String(tradeTp2 ?? ""));
  const [slTpLoading, setSlTpLoading] = useState(false);

  // Keep edit inputs in sync with incoming prop updates (e.g. after reconcile),
  // but only when the panel is closed — never override in-progress edits.
  useEffect(() => {
    if (editingSlTp) return;
    setEditSl(String(position.slTriggerPx ?? ""));
    setEditTp(String(position.tpTriggerPx ?? tradeTp1 ?? ""));
    setEditTp2(String(tradeTp2 ?? ""));
  }, [position.slTriggerPx, position.tpTriggerPx, tradeTp1, tradeTp2, editingSlTp]);
  const [slTpError, setSlTpError] = useState<string | null>(null);

  const currentPx = tick?.last ?? position.markPx;
  const effectiveSl = tradeSl ?? position.slTriggerPx;
  const effectiveTp1px = (position.tpTriggerPx && position.tpTriggerPx > 0)
    ? position.tpTriggerPx
    : (tradeTp1 ?? null);
  const rrRatio = (effectiveSl && effectiveSl > 0 && effectiveTp1px && currentPx > 0)
    ? Math.abs(effectiveTp1px - currentPx) / Math.abs(currentPx - effectiveSl)
    : null;
  const liveUpl = computeLiveUpl(position, currentPx);
  const roe = computeRoe(position, currentPx);
  const tpProgress = computeTpProgress(position, currentPx);

  const isLong = position.direction === "LONG";
  const dirColor = isLong ? "text-signal-green" : "text-signal-red";
  const dirBg = isLong
    ? "bg-soft-green border-signal-green/40"
    : "bg-soft-red border-signal-red/40";
  const uplColor = liveUpl >= 0 ? "text-signal-green" : "text-signal-red";

  const holding = categorizeHoldingDuration(position.cTime);
  const holdingText = (() => {
    switch (holding.category) {
      case "lessThanHour":
        return t("position.holdingLessHour");
      case "hours":
        return t("position.holdingHours", { n: Math.floor(holding.hours) });
      case "day":
        return t("position.holdingDay");
      case "days":
        return t("position.holdingDays", { n: Math.floor(holding.hours / 24) });
      case "week":
        return t("position.holdingWeek");
    }
  })();

  async function handleScaleIn() {
    const qty = parseFloat(scaleInQty);
    if (!onScaleIn || isNaN(qty) || qty <= 0) return;
    setScaleInLoading(true);
    setScaleInError(null);
    try {
      await onScaleIn(qty);
      setShowScaleIn(false);
      setScaleInQty("");
    } catch (e) {
      setScaleInError(e instanceof Error ? e.message : "Failed");
    } finally {
      setScaleInLoading(false);
    }
  }

  async function handleScaleOut(pct: number) {
    if (!onScaleOut) return;
    const qty = position.size * pct;
    setScaleOutLoading(true);
    setScaleOutError(null);
    try {
      await onScaleOut(qty);
      setShowScaleOut(false);
    } catch (e) {
      setScaleOutError(e instanceof Error ? e.message : "Failed");
    } finally {
      setScaleOutLoading(false);
    }
  }

  async function handleUpdateSlTp() {
    if (!onUpdateSlTp) return;
    setSlTpLoading(true);
    setSlTpError(null);
    try {
      const sl = editSl ? parseFloat(editSl) : null;
      const tp = editTp ? parseFloat(editTp) : null;
      const tp2 = editTp2 ? parseFloat(editTp2) : null;
      await onUpdateSlTp(sl, tp, tp2);
      setEditingSlTp(false);
    } catch (e) {
      setSlTpError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSlTpLoading(false);
    }
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      {/* Header */}
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className="text-text-t1 font-mono text-base font-semibold tracking-wider">
            {position.pair}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-2xs font-bold tracking-wider ${dirBg} ${dirColor}`}
          >
            <span>{isLong ? "▲" : "▼"}</span>
            <span>{t(isLong ? "direction.long" : "direction.short")}</span>
          </span>
          <span className="text-text-t4 font-mono text-2xs tracking-wider">
            {position.leverage}x
          </span>
          {/* Margin mode badge */}
          <span className="text-text-t4 font-mono text-2xs border border-border/50 rounded px-1 py-0.5 uppercase tracking-wider">
            {position.mgnMode}
          </span>
          {scoreResult && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-2xs tabular-nums ${
                scoreResult.verdict === "go"
                  ? "bg-green-500/10 text-green-400"
                  : scoreResult.verdict === "wait"
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "bg-red-500/10 text-red-400/70"
              }`}
              title={`Score: ${scoreResult.score}`}
            >
              {scoreResult.score}
            </span>
          )}
        </div>
        <span className="text-text-t4 font-mono text-2xs tracking-wider">
          {holdingText}
        </span>
      </div>

      {/* UPL — big, primary signal */}
      <div className="mb-4 flex min-w-0 items-baseline justify-between gap-2">
        <div className="min-w-0 shrink">
          <div className={`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-2xl font-bold tabular-nums ${uplColor}`}>
            {formatPercent(roe, locale, true)}
          </div>
          <div className="text-text-t3 font-mono text-2xs tracking-wider">
            ROE
          </div>
        </div>
        <div className="min-w-0 shrink-0 text-right">
          <div className={`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-base tabular-nums ${uplColor}`}>
            {liveUpl >= 0 ? "+" : ""}
            {formatPrice(liveUpl, locale)}
          </div>
          <div className="text-text-t3 font-mono text-2xs tracking-wider">
            {t("position.upl")}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
        <Stat
          label={t("position.entry")}
          value={formatPrice(position.entryPx, locale)}
        />
        <Stat
          label={t("position.mark")}
          value={formatPrice(currentPx, locale)}
        />
        <Stat
          label={t("position.size")}
          value={`${formatCoinAmount(position.size, position.pair, locale)} ${position.pair}`}
          sub={formatPrice(position.notional, locale)}
        />
        <Stat
          label={t("position.margin")}
          value={formatPrice(position.notional / position.leverage, locale)}
        />
      </div>

      {/* SL/TP row — editable, dual-layer */}
      <div className="border-border mt-3 border-t pt-3">
        {!editingSlTp ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
              <SlTpStat
                label={t("position.stopLoss")}
                value={position.slTriggerPx}
                fallback={t("position.noSlSet")}
                locale={locale}
                color="text-signal-red"
                currentPx={currentPx}
                riskUsd={
                  position.slTriggerPx && currentPx > 0
                    ? Math.abs(currentPx - position.slTriggerPx) * position.size
                    : null
                }
              />
              <SlTpStat
                label={`${t("position.takeProfit")} 1`}
                value={position.tpTriggerPx ?? tradeTp1 ?? null}
                fallback={t("position.noTpSet")}
                locale={locale}
                color="text-signal-green"
                currentPx={currentPx}
              />
              <SlTpStat
                label={`${t("position.takeProfit")} 2`}
                value={tradeTp2 ?? null}
                fallback="TP2 —"
                locale={locale}
                color="text-signal-green"
                currentPx={currentPx}
                dimmed
              />
            </div>
            {/* R:R ratio */}
            {rrRatio !== null && (
              <div className="font-mono text-2xs text-text-t3 tracking-wider mt-1">
                R:R{" "}
                <span className={`font-semibold tabular-nums ${rrRatio >= 2 ? "text-signal-green" : rrRatio >= 1 ? "text-signal-amber" : "text-signal-red"}`}>
                  1:{rrRatio.toFixed(1)}
                </span>
              </div>
            )}

            {/* Layer desync warning */}
            {tradeSl != null &&
              position.slTriggerPx != null &&
              position.slTriggerPx !== 0 &&
              Math.abs(tradeSl - position.slTriggerPx) / position.slTriggerPx > 0.001 && (
                <div className="flex items-center gap-1.5 rounded border border-yellow-500/30 bg-yellow-500/8 px-2 py-1 font-mono text-2xs text-yellow-400">
                  <span>⚠</span>
                  <span>
                    {t("position.slLayerDesync")}
                    {" "}App {formatPrice(tradeSl, locale)} / Ex {formatPrice(position.slTriggerPx, locale)}
                  </span>
                </div>
              )}
            {onUpdateSlTp && (
              <button
                onClick={() => {
                  setEditSl(String(position.slTriggerPx ?? ""));
                  setEditTp(String(position.tpTriggerPx ?? ""));
                  setEditTp2(String(tradeTp2 ?? ""));
                  setEditingSlTp(true);
                }}
                className="text-text-t4 hover:text-brand font-mono text-2xs tracking-wider transition-colors"
              >
                ✎ {t("position.editSlTp")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="font-mono text-2xs text-signal-red mb-1">{t("position.stopLoss")}</div>
                <input
                  type="number"
                  value={editSl}
                  onChange={(e) => setEditSl(e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface-s1 border border-signal-red/30 rounded px-2 py-1 font-mono text-xs text-text-t1"
                />
                {editSl && currentPx > 0 && (
                  <div className="font-mono text-2xs text-text-t4 mt-0.5 tabular-nums">
                    {pctFromCurrent(parseFloat(editSl), currentPx)}
                    {" · "}
                    <span className="text-signal-red">
                      ~${(Math.abs(currentPx - parseFloat(editSl)) * position.size).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <div className="font-mono text-2xs text-signal-green mb-1">{t("position.takeProfit")} 1</div>
                <input
                  type="number"
                  value={editTp}
                  onChange={(e) => setEditTp(e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface-s1 border border-signal-green/30 rounded px-2 py-1 font-mono text-xs text-text-t1"
                />
                {editTp && currentPx > 0 && (
                  <div className="font-mono text-2xs text-text-t4 mt-0.5 tabular-nums">
                    {pctFromCurrent(parseFloat(editTp), currentPx)}
                  </div>
                )}
              </div>
              <div>
                <div className="font-mono text-2xs text-signal-green/70 mb-1">{t("position.takeProfit")} 2</div>
                <input
                  type="number"
                  value={editTp2}
                  onChange={(e) => setEditTp2(e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface-s1 border border-signal-green/20 rounded px-2 py-1 font-mono text-xs text-text-t1"
                />
                {editTp2 && currentPx > 0 && (
                  <div className="font-mono text-2xs text-text-t4 mt-0.5 tabular-nums">
                    {pctFromCurrent(parseFloat(editTp2), currentPx)}
                  </div>
                )}
              </div>
            </div>
            {slTpError && (
              <div className="text-signal-red font-mono text-2xs">{slTpError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleUpdateSlTp}
                disabled={slTpLoading}
                className="flex-1 rounded border border-brand/50 bg-brand/10 py-1.5 font-mono text-2xs font-bold text-brand transition-colors hover:bg-brand/20 disabled:opacity-50"
              >
                {slTpLoading ? "..." : t("position.updateSlTp")}
              </button>
              <button
                onClick={() => { setEditingSlTp(false); setSlTpError(null); }}
                className="rounded border border-border px-3 py-1.5 font-mono text-2xs text-text-t3"
              >
                {t("position.cancelEdit")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TP1 progress bar */}
      {tpProgress !== null && (
        <div className="mt-3">
          <div className="text-text-t3 mb-1 flex justify-between font-mono text-2xs tracking-wider">
            <span>{t("position.tp1Progress")}</span>
            <span className="tabular-nums">{tpProgress.toFixed(0)}%</span>
          </div>
          <div className="bg-border h-1.5 overflow-hidden rounded">
            <div
              className="bg-signal-green h-full transition-all"
              style={{ width: `${tpProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* SL proximity warning */}
      {effectiveSl && effectiveSl > 0 && currentPx > 0 && (
        <SlProximityWarning
          slPx={effectiveSl}
          currentPx={currentPx}
          isLong={isLong}
          locale={locale}
          t={t}
        />
      )}

      {/* Liquidation price — prominent warning */}
      {position.liqPx && currentPx > 0 && (
        <LiqWarning
          liqPx={position.liqPx}
          currentPx={currentPx}
          isLong={isLong}
          locale={locale}
          t={t}
        />
      )}

      {/* Scale-in panel */}
      {onScaleIn && (
        <div className="mt-3 border-t border-border pt-3">
          {!showScaleIn ? (
            <button
              onClick={() => setShowScaleIn(true)}
              className="font-mono text-2xs text-text-t4 hover:text-brand tracking-wider transition-colors"
            >
              + {t("position.scaleIn")}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="font-mono text-2xs text-text-t3 tracking-wider">{t("position.scaleInLabel")}</div>
              <div className="flex gap-1">
                {[0.1, 0.25, 0.5].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setScaleInQty(String(parseFloat((position.size * pct).toFixed(8))))}
                    className="flex-1 rounded border border-border px-2 py-1 font-mono text-2xs text-text-t3 transition-colors hover:border-brand/50 hover:text-brand"
                  >
                    {(pct * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={scaleInQty}
                  onChange={(e) => setScaleInQty(e.target.value)}
                  placeholder="0.001"
                  className="flex-1 bg-surface-s1 border border-border rounded px-2 py-1 font-mono text-xs text-text-t1"
                />
                <button
                  onClick={handleScaleIn}
                  disabled={scaleInLoading}
                  className={`rounded border px-3 py-1 font-mono text-2xs font-bold tracking-wider transition-colors disabled:opacity-50 ${
                    isLong
                      ? "border-signal-green/50 text-signal-green hover:bg-signal-green/10"
                      : "border-signal-red/50 text-signal-red hover:bg-signal-red/10"
                  }`}
                >
                  {scaleInLoading ? "..." : t("position.scaleInSubmit")}
                </button>
                <button
                  onClick={() => { setShowScaleIn(false); setScaleInError(null); }}
                  className="rounded border border-border px-2 py-1 font-mono text-2xs text-text-t4"
                >
                  ✕
                </button>
              </div>
              {scaleInError && (
                <div className="text-signal-red font-mono text-2xs">{scaleInError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scale-out / Partial close */}
      {onScaleOut && (
        <div className="mt-2">
          {!showScaleOut ? (
            <button
              onClick={() => setShowScaleOut(true)}
              className="font-mono text-2xs text-text-t4 hover:text-warning tracking-wider transition-colors"
            >
              ~ {t("position.scaleOut")}
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="font-mono text-2xs text-text-t3 tracking-wider">{t("position.scaleOut")}</div>
              <div className="flex gap-1.5">
                {[0.25, 0.5, 0.75].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleScaleOut(pct)}
                    disabled={scaleOutLoading}
                    className="flex-1 rounded border border-warning/40 bg-warning/5 py-1.5 font-mono text-2xs font-bold text-warning/80 hover:bg-warning/15 transition-colors disabled:opacity-50"
                  >
                    {(pct * 100).toFixed(0)}%
                  </button>
                ))}
                <button
                  onClick={() => { setShowScaleOut(false); setScaleOutError(null); }}
                  className="rounded border border-border px-2 py-1 font-mono text-2xs text-text-t4"
                >
                  ✕
                </button>
              </div>
              {scaleOutError && (
                <div className="text-signal-red font-mono text-2xs">{scaleOutError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Close button — hidden when execution disabled (onClose=undefined) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={isClosing}
          className={`mt-4 w-full rounded-md py-2.5 font-mono text-sm font-bold tracking-widest transition-colors ${
            isClosing
              ? "bg-border text-text-t4 cursor-wait"
              : "border-signal-red text-signal-red hover:bg-signal-red hover:text-white border bg-transparent"
          }`}
        >
          {isClosing ? t("position.closing") : `✕ ${t("position.closeButton")}`}
        </button>
      )}
    </div>
  );
}

// ─── SL Proximity Warning ────────────────────────────────────────────────────

function SlProximityWarning({
  slPx,
  currentPx,
  isLong,
  locale,
  t,
}: {
  slPx: number;
  currentPx: number;
  isLong: boolean;
  locale: import("@/lib/i18n/types").Locale;
  t: (key: string) => string;
}) {
  const distPct = Math.abs((currentPx - slPx) / currentPx) * 100;
  if (distPct >= 10) return null;

  const isDanger = distPct < 2;
  const isWarning = distPct < 5;

  const colorClass = isDanger
    ? "text-signal-red border-signal-red/60 bg-signal-red/10"
    : isWarning
    ? "text-orange-400 border-orange-400/40 bg-orange-400/8"
    : "text-yellow-400/80 border-yellow-400/30 bg-yellow-400/5";

  return (
    <div className={`mt-3 rounded border px-3 py-2 flex items-center justify-between ${colorClass} ${isDanger ? "animate-pulse" : ""}`}>
      <div className="flex items-center gap-1.5">
        {isDanger && <span className="text-sm">⚠</span>}
        <span className="font-mono text-2xs font-bold tracking-widest uppercase">
          SL {isDanger ? "TEHLIKE" : "YAKIN"}
        </span>
        <span className="font-mono text-xs tabular-nums font-semibold">
          {formatPrice(slPx, locale)}
        </span>
      </div>
      <span className="font-mono text-2xs tabular-nums">
        {distPct.toFixed(1)}% {isLong ? "↓" : "↑"} {t("position.liqFrom")}
      </span>
    </div>
  );
}

// ─── Liq Warning ─────────────────────────────────────────────────────────────

function LiqWarning({
  liqPx,
  currentPx,
  isLong,
  locale,
  t,
}: {
  liqPx: number;
  currentPx: number;
  isLong: boolean;
  locale: import("@/lib/i18n/types").Locale;
  t: (key: string) => string;
}) {
  const distPct = Math.abs((currentPx - liqPx) / currentPx) * 100;
  const isDanger = distPct < 3;
  const isWarning = distPct < 10;
  const isNotice = distPct < 25;

  const colorClass = isDanger
    ? "text-signal-red border-signal-red/60 bg-signal-red/10"
    : isWarning
    ? "text-orange-400 border-orange-400/40 bg-orange-400/8"
    : isNotice
    ? "text-yellow-400/80 border-yellow-400/30 bg-yellow-400/5"
    : "text-text-t4 border-border bg-transparent";

  return (
    <div className={`mt-3 rounded border px-3 py-2 flex items-center justify-between ${colorClass} ${isDanger ? "animate-pulse" : ""}`}>
      <div className="flex items-center gap-1.5">
        {isDanger && <span className="text-sm">⚠</span>}
        <span className="font-mono text-2xs font-bold tracking-widest uppercase">
          {t("position.liqDanger")}
        </span>
        <span className="font-mono text-xs tabular-nums font-semibold">
          {formatPrice(liqPx, locale)}
        </span>
      </div>
      <span className="font-mono text-2xs tabular-nums">
        {distPct.toFixed(1)}% {isLong ? "↓" : "↑"} {t("position.liqFrom")}
      </span>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-text-t3 font-mono text-2xs tracking-wider">
        {label}
      </div>
      <div className="text-text-t1 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap font-mono tabular-nums">{value}</div>
      {sub && <div className="text-text-t4 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-2xs">{sub}</div>}
    </div>
  );
}

function pctFromCurrent(price: number, currentPx: number): string {
  if (price <= 0 || currentPx <= 0 || isNaN(price)) return "";
  const pct = ((price - currentPx) / currentPx) * 100;
  return (pct > 0 ? "+" : "") + pct.toFixed(2) + "%";
}

function SlTpStat({
  label,
  value,
  fallback,
  locale,
  color,
  currentPx,
  riskUsd,
  dimmed,
}: {
  label: string;
  value: number | null;
  fallback: string;
  locale: import("@/lib/i18n/types").Locale;
  color: string;
  currentPx?: number;
  riskUsd?: number | null;
  dimmed?: boolean;
}) {
  const pct = value && currentPx ? pctFromCurrent(value, currentPx) : null;
  return (
    <div>
      <div className={`font-mono text-2xs tracking-wider ${dimmed ? "text-text-t4" : "text-text-t3"}`}>
        {label}
      </div>
      <div className={`mt-0.5 font-mono tabular-nums text-xs ${value ? color : "text-text-t4"}`}>
        {value ? formatPrice(value, locale) : fallback}
      </div>
      {pct && (
        <div className="font-mono text-2xs text-text-t4 tabular-nums">{pct}</div>
      )}
      {riskUsd != null && riskUsd > 0 && (
        <div className="font-mono text-2xs text-signal-red/70 tabular-nums">~${riskUsd.toFixed(1)}</div>
      )}
    </div>
  );
}
