"use client";

/**
 * QUICK TRADE SHEET — Premium mobil işlem ekranı.
 *
 * 3Commas / Bybit tarzı bottom sheet:
 *   - FAB (floating action button) sağ altta
 *   - Yukarı kaydırma animasyonu ile açılır
 *   - Pair seçici, LONG/SHORT toggle, qty % preset'leri
 *   - SL otomatik hesaplama (default %2)
 *   - Haptic feedback + loading state
 *   - Demo mod desteği
 */

import { useState, useCallback, useEffect } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";
import { useMarketStore } from "@/lib/store/marketStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { getAdapter } from "@/lib/exchange";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { EXECUTION_ENABLED } from "@/lib/config/execution";
import { useT } from "@/lib/i18n/context";

const DEFAULT_LEVERAGE = 10;
const DEFAULT_SL_PCT = 0.02; // %2 varsayılan SL

export function QuickTradeSheet(): React.ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState<Pair>("BTC");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [pct, setPct] = useState(25); // % of free margin
  const [slPct, setSlPct] = useState(DEFAULT_SL_PCT * 100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const haptics = useHaptics();
  const demoMode = useSettingsStore((s) => s.demoMode);
  const freeBalance = useAccountStore((s) => s.free);
  const openPending = useTradesStore((s) => s.openPending);
  const confirmTradeOpen = useTradesStore((s) => s.confirmTradeOpen);
  const prices = useMarketStore((s) => s.prices);

  const currentPrice = prices[pair]?.last ?? 0;
  const usableMargin = (freeBalance ?? 0) * (pct / 100);
  const notional = usableMargin * DEFAULT_LEVERAGE;
  const qty = currentPrice > 0 ? notional / currentPrice : 0;

  const slPrice =
    direction === "LONG"
      ? currentPrice * (1 - slPct / 100)
      : currentPrice * (1 + slPct / 100);

  const riskUsd = Math.abs(currentPrice - slPrice) * qty;

  const handleOpen = useCallback(() => {
    haptics.light();
    setOpen(true);
    setError(null);
    setSuccess(false);
  }, [haptics]);

  const handleClose = useCallback(() => {
    haptics.light();
    setOpen(false);
  }, [haptics]);

  const handleDirectionToggle = useCallback(
    (dir: "LONG" | "SHORT") => {
      haptics.medium();
      setDirection(dir);
    },
    [haptics],
  );

  const handlePctSelect = useCallback(
    (p: number) => {
      haptics.light();
      setPct(p);
    },
    [haptics],
  );

  const handleSubmit = useCallback(async () => {
    if (!EXECUTION_ENABLED) {
      setError(t("settings.signalModeActive"));
      return;
    }
    if (loading || qty <= 0 || currentPrice <= 0) return;
    haptics.heavy();
    setLoading(true);
    setError(null);

    try {
      const adapter = getAdapter(demoMode);

      // Exchange çağrısı ÖNCE — başarısız olursa store'a hiç yazılmaz
      const result = await adapter.openPosition({
        pair,
        direction,
        qty,
        leverage: DEFAULT_LEVERAGE,
        marginMode: "cross",
        slPrice,
      });

      if (result.ok) {
        // Exchange kabul etti → şimdi store'a yaz
        const tradeSnap = openPending({
          pair,
          direction,
          entryPrice: currentPrice,
          qty,
          leverage: DEFAULT_LEVERAGE,
          stopPrice: slPrice,
          riskAmountUsd: riskUsd,
          isPaper: demoMode,
          entryContext: {
            score: 0,
            verdict: "go",
            reasonText: "Quick trade (mobile)",
          },
        });
        confirmTradeOpen(tradeSnap.id, result.data?.orderId);
        haptics.success();
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
        }, 1200);
      } else {
        haptics.error();
        setError(result.errorMessage ?? "İşlem başarısız");
      }
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    qty,
    currentPrice,
    haptics,
    demoMode,
    openPending,
    pair,
    direction,
    slPrice,
    riskUsd,
    confirmTradeOpen,
  ]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  return (
    <>
      {/* FAB — sağ alt köşe, bottom nav üstünde — sinyal modda gizle */}
      {EXECUTION_ENABLED && <button
        onClick={handleOpen}
        className={[
          "fixed z-50 flex items-center justify-center",
          "w-14 h-14 rounded-full shadow-2xl",
          "bg-brand text-white text-2xl font-bold",
          "transition-transform active:scale-95",
          "lg:hidden", // masaüstünde gizle
        ].join(" ")}
        style={{
          bottom: "calc(64px + env(safe-area-inset-bottom) + 16px)",
          right: "16px",
        }}
        aria-label="Hızlı İşlem"
      >
        +
      </button>}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={handleClose}
          aria-hidden
        />
      )}

      {/* Bottom Sheet */}
      <div
        className={[
          "fixed left-0 right-0 z-50 lg:hidden",
          "bg-surface border-t border-border rounded-t-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{
          bottom: 0,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Hızlı İşlem"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-4 pb-4 space-y-4">
          {/* Başlık */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-text-t1">
              ⚡ QUICK TRADE
            </span>
            {demoMode && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-400">
                DEMO
              </span>
            )}
            <button
              onClick={handleClose}
              className="text-text-t3 hover:text-text-t1 p-1"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          {/* Pair seçici */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-2 pb-1">
              {PAIRS.slice(0, 8).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    haptics.light();
                    setPair(p as Pair);
                  }}
                  className={[
                    "flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs font-bold",
                    "border transition-colors",
                    pair === p
                      ? "bg-brand border-brand text-white"
                      : "border-border text-text-t2 active:bg-brand/20",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Direction toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDirectionToggle("LONG")}
              className={[
                "py-3 rounded-xl font-mono text-sm font-bold border transition-all",
                direction === "LONG"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "border-border text-text-t3",
              ].join(" ")}
            >
              ▲ LONG
            </button>
            <button
              onClick={() => handleDirectionToggle("SHORT")}
              className={[
                "py-3 rounded-xl font-mono text-sm font-bold border transition-all",
                direction === "SHORT"
                  ? "bg-rose-500/20 border-rose-500 text-rose-400"
                  : "border-border text-text-t3",
              ].join(" ")}
            >
              ▼ SHORT
            </button>
          </div>

          {/* Miktar % seçici */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-t3 font-mono">
                Marjin Yüzdesi
              </span>
              <span className="text-xs text-text-t2 font-mono">
                ${usableMargin.toFixed(0)} × {DEFAULT_LEVERAGE}x ={" "}
                <span className="text-text-t1 font-bold">
                  {qty.toFixed(4)} {pair}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePctSelect(p)}
                  className={[
                    "py-2 rounded-lg font-mono text-sm border transition-all",
                    pct === p
                      ? "bg-brand/20 border-brand text-brand"
                      : "border-border text-text-t3",
                  ].join(" ")}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* SL ayarı */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-t3 font-mono">Stop-Loss %</span>
              <span className="text-xs text-brand font-mono font-bold">
                ${slPrice.toFixed(2)}{" "}
                <span className="text-rose-400">(-${riskUsd.toFixed(1)})</span>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 1.5, 2, 3].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    haptics.light();
                    setSlPct(pct);
                  }}
                  className={[
                    "py-2 rounded-lg font-mono text-sm border transition-all",
                    slPct === pct
                      ? "bg-rose-500/20 border-rose-500 text-rose-400"
                      : "border-border text-text-t3",
                  ].join(" ")}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Fiyat bilgisi */}
          <div className="flex items-center justify-between text-xs font-mono py-2 px-3 rounded-lg bg-bg border border-border">
            <span className="text-text-t3">
              {pair}/USDT Anlık
            </span>
            <span className="text-text-t1 font-bold">
              ${currentPrice > 0 ? currentPrice.toLocaleString() : "—"}
            </span>
          </div>

          {/* Hata mesajı */}
          {error && (
            <div className="text-xs text-rose-400 font-mono px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
              {error}
            </div>
          )}

          {/* Gönder butonu */}
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || qty <= 0 || currentPrice <= 0}
            className={[
              "w-full py-4 rounded-xl font-mono text-sm font-bold",
              "transition-all active:scale-[0.98]",
              success
                ? "bg-emerald-500 text-white"
                : direction === "LONG"
                ? "bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white"
                : "bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white",
            ].join(" ")}
          >
            {success
              ? "✅ İşlem Açıldı"
              : loading
              ? "İşleniyor..."
              : direction === "LONG"
              ? `▲ LONG ${pair} Aç — ${notional.toFixed(0)} USDT`
              : `▼ SHORT ${pair} Aç — ${notional.toFixed(0)} USDT`}
          </button>

          {/* Uyarı */}
          <p className="text-center text-[10px] text-text-t4 font-mono">
            {demoMode
              ? "Demo mod — gerçek işlem yapılmaz"
              : "Gerçek futures pozisyon — dikkatli ol"}
          </p>
        </div>
      </div>
    </>
  );
}
