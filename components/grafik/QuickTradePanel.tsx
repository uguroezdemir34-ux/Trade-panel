"use client";

/**
 * QUICK TRADE PANEL — Grafik sayfasında tek tıkla emir girişi.
 *
 * Tasarım: Full modal ve checklist'i atlar. Notional + kaldıraç gir,
 * LONG/SHORT seç, 3 saniyelik onay geri sayımıyla emir gönder.
 * Checklist yoktur — bilinçli bir karar olduğu varsayılır.
 */

import { useState, useEffect, useRef } from "react";
import { useT, useLocale } from "@/lib/i18n/context";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { getAdapter } from "@/lib/exchange";
import { formatPrice } from "@/lib/i18n/format";
import { EXECUTION_ENABLED } from "@/lib/config/execution";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
}

export function QuickTradePanel({ pair }: Props) {
  const t = useT();
  const locale = useLocale();
  const result = useScoreStore((s) => s.results[pair]);
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? null);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const openPending = useTradesStore((s) => s.openPending);

  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [notionalUsd, setNotionalUsd] = useState("100");
  const [leverage, setLeverage] = useState("5");
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");

  // Pending confirmation state
  const [pending, setPending] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync direction to score when pair changes
  useEffect(() => {
    if (result?.direction === "LONG" || result?.direction === "SHORT") {
      setDirection(result.direction);
    }
  }, [pair, result?.direction]);

  // Countdown logic — auto-execute at 0
  useEffect(() => {
    if (!pending) return;
    if (countdown <= 0) {
      void executeOrder();
      return;
    }
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, countdown]);

  function startPending() {
    setExecError(null);
    setLastOk(false);
    setPending(true);
    setCountdown(3);
  }

  function cancelPending() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPending(false);
    setCountdown(3);
  }

  async function executeOrder() {
    if (!EXECUTION_ENABLED) {
      setExecError(t("settings.signalModeActive"));
      setPending(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setPending(false);
    setExecuting(true);
    setExecError(null);

    try {
      const notional = parseFloat(notionalUsd);
      const lev = parseInt(leverage, 10);
      if (!livePrice || isNaN(notional) || isNaN(lev) || notional <= 0 || lev <= 0) {
        setExecError("Invalid parameters");
        return;
      }

      // qty in base coin (round to 6 decimal places)
      const qty = Math.round((notional / livePrice) * 1_000_000) / 1_000_000;

      const adapter = getAdapter(demoMode);
      const res = await adapter.openPosition({
        pair,
        direction,
        qty,
        leverage: lev,
        marginMode,
      });

      if (res.ok) {
        openPending({
          pair,
          direction,
          entryPrice: livePrice,
          qty,
          leverage: lev,
          stopPrice: 0,
          riskAmountUsd: notional / lev,
          isPaper: demoMode,
          entryContext: {
            score: result?.score ?? 0,
            verdict: result?.verdict ?? "wait",
            drawdownTier: "normal",
          },
          orderId: res.data?.orderId,
        });
        setLastOk(true);
      } else {
        setExecError(res.errorMessage ?? "Order failed");
      }
    } catch (e) {
      setExecError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setExecuting(false);
      setCountdown(3);
    }
  }

  const isLong = direction === "LONG";
  const approxQty = livePrice && parseFloat(notionalUsd) > 0
    ? (parseFloat(notionalUsd) / livePrice).toFixed(4)
    : "—";

  return (
    <div className="rounded-lg border border-border bg-bg-card p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-2xs text-text-t3 tracking-widest uppercase">
          {t("grafik.quickTrade")}
        </span>
        {result && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-2xs font-bold ${
              result.verdict === "go"
                ? "bg-green-500/15 text-green-400"
                : result.verdict === "wait"
                ? "bg-yellow-500/15 text-yellow-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {result.score} {result.verdict.toUpperCase()}
          </span>
        )}
      </div>

      {/* Direction buttons */}
      <div className="mb-3 flex gap-1">
        <button
          onClick={() => setDirection("LONG")}
          className={`flex-1 rounded border py-1.5 font-mono text-2xs font-bold tracking-widest transition-colors ${
            isLong
              ? "border-signal-green/50 bg-signal-green/15 text-signal-green"
              : "border-border text-text-t4 hover:text-text-t2"
          }`}
        >
          ▲ LONG
        </button>
        <button
          onClick={() => setDirection("SHORT")}
          className={`flex-1 rounded border py-1.5 font-mono text-2xs font-bold tracking-widest transition-colors ${
            !isLong
              ? "border-signal-red/50 bg-signal-red/15 text-signal-red"
              : "border-border text-text-t4 hover:text-text-t2"
          }`}
        >
          ▼ SHORT
        </button>
      </div>

      {/* Notional + Leverage inputs */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 font-mono text-2xs text-text-t4">USDT</div>
          <input
            type="number"
            value={notionalUsd}
            onChange={(e) => setNotionalUsd(e.target.value)}
            className="w-full rounded border border-border bg-surface-s1 px-2 py-1 font-mono text-xs text-text-t1 focus:border-brand/50 outline-none"
          />
        </div>
        <div>
          <div className="mb-1 font-mono text-2xs text-text-t4">LEV</div>
          <input
            type="number"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full rounded border border-border bg-surface-s1 px-2 py-1 font-mono text-xs text-text-t1 focus:border-brand/50 outline-none"
          />
        </div>
      </div>

      {/* Margin mode */}
      <div className="mb-3 flex gap-1">
        {(["cross", "isolated"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMarginMode(m)}
            className={`flex-1 rounded border py-0.5 font-mono text-2xs tracking-widest uppercase transition-colors ${
              marginMode === m
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-border text-text-t4 hover:text-text-t2"
            }`}
          >
            {m === "cross" ? t("confirm.cross") : t("confirm.isolated")}
          </button>
        ))}
      </div>

      {/* Price info */}
      {livePrice && (
        <div className="mb-3 font-mono text-2xs text-text-t4 tabular-nums">
          @ {formatPrice(livePrice, locale)} · ~{approxQty} {pair}
        </div>
      )}

      {/* Execute / Countdown */}
      {!EXECUTION_ENABLED ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 py-2 text-center font-mono text-2xs text-amber-400">
          {t("settings.signalModeNote")}
        </div>
      ) : !pending ? (
        <button
          onClick={startPending}
          disabled={executing}
          className={`w-full rounded border py-2 font-mono text-xs font-bold tracking-widest transition-all disabled:cursor-wait disabled:opacity-50 ${
            isLong
              ? "border-signal-green/50 bg-signal-green/10 text-signal-green hover:bg-signal-green hover:text-bg-page"
              : "border-signal-red/50 bg-signal-red/10 text-signal-red hover:bg-signal-red hover:text-bg-page"
          }`}
        >
          {executing ? "⏳" : `${isLong ? "▲" : "▼"} ${direction}`}
        </button>
      ) : (
        <div className="space-y-1.5">
          <button
            onClick={executeOrder}
            className={`w-full animate-pulse rounded py-2 font-mono text-xs font-bold tracking-widest ${
              isLong ? "bg-signal-green text-bg-page" : "bg-signal-red text-bg-page"
            }`}
          >
            {t("grafik.holdConfirm")} ({countdown}s)
          </button>
          <button
            onClick={cancelPending}
            className="w-full rounded border border-border py-1.5 font-mono text-2xs text-text-t3 hover:text-text-t1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Feedback */}
      {execError && (
        <div className="mt-2 font-mono text-2xs text-signal-red">{execError}</div>
      )}
      {lastOk && (
        <div className="mt-2 font-mono text-2xs text-signal-green">
          ✓ {t("grafik.quickSuccess")}
        </div>
      )}
    </div>
  );
}
