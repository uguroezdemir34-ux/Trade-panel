"use client";

/**
 * EMERGENCY STOP GUARD — SL ihlalinde uyarı gönderir.
 * Emir GÖNDERİLMEZ. Kullanıcı pozisyonu borsadan manuel kapatmalıdır.
 * Her trade için 5 dakikada bir uyarı tekrarlanır (spam koruması).
 */

import { useEffect, useRef } from "react";
import { captureMessage } from "@sentry/nextjs";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { dispatchNotification } from "@/lib/notify/dispatch";
import { browserNotify } from "@/lib/notify/browser";

const CHECK_INTERVAL_MS = 5_000;
const SL_BREACH_BUFFER = 0.0015;
const MAX_PRICE_STALE_MS = 15_000;
const WARN_COOLDOWN_MS = 5 * 60_000;
// check() setInterval'dan `void check()` ile çağrılıyor — try/catch olmadan
// gövdedeki senkron bir exception hiçbir yere düşmeden kaybolurdu (bu, son-çare
// SL ihlali uyarı sistemi olduğu için sessizce durması riskli). Sentry spam'ini
// önlemek için WARN_COOLDOWN_MS ile aynı pencerede en fazla bir kez loglanır.
const ERROR_LOG_COOLDOWN_MS = WARN_COOLDOWN_MS;

export function useEmergencyStopGuard(): void {
  const warnedRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastErrorLoggedRef = useRef(0);

  useEffect(() => {
    async function check(): Promise<void> {
      try {
        await checkOnce();
      } catch (err) {
        const now = Date.now();
        if (now - lastErrorLoggedRef.current < ERROR_LOG_COOLDOWN_MS) return;
        lastErrorLoggedRef.current = now;
        captureMessage("EmergencyStopGuard check() sessizce başarısız oldu", {
          level: "error",
          extra: { err: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    async function checkOnce(): Promise<void> {
      const openTrades = useTradesStore.getState().getOpen();
      if (openTrades.length === 0) return;

      const { prices } = useMarketStore.getState();
      const now = Date.now();

      for (const trade of openTrades) {
        if (!trade.stopPrice || trade.stopPrice <= 0) continue;

        const tick = prices[trade.pair];
        if (!tick || tick.last <= 0) continue;
        if (tick.ts && now - tick.ts > MAX_PRICE_STALE_MS) continue;

        const price = tick.last;
        const sl = trade.stopPrice;

        const breached =
          trade.direction === "LONG"
            ? price <= sl * (1 - SL_BREACH_BUFFER)
            : price >= sl * (1 + SL_BREACH_BUFFER);

        if (!breached) continue;

        const lastWarned = warnedRef.current.get(trade.id) ?? 0;
        if (now - lastWarned < WARN_COOLDOWN_MS) continue;
        warnedRef.current.set(trade.id, now);

        const msg = `⛔ SL İHLALİ — ${trade.direction} ${trade.pair} fiyat=${price.toFixed(4)} sl=${sl.toFixed(4)} — Pozisyonu borsadan kapatın!`;
        console.warn("[EmergencyStopGuard]", msg);

        browserNotify("⛔ Acil Stop Uyarısı", `${trade.pair} SL seviyesi aşıldı — borsadan kapatın`);

        void dispatchNotification({
          kind: "sl_proximity",
          pair: trade.pair,
          direction: trade.direction,
          entry: price,
          stopPrice: sl,
          reasonText: `⛔ SL İHLALİ — Pozisyonu borsadan manuel kapatın!`,
          timestamp: now,
        }).catch(() => {});

        // Web push — dispatchNotification'ın kapsamadığı ayrı bir altyapı
        // (bkz. useGoAlerts.ts aynı desen). Fire-and-forget, sessiz hata.
        void fetch("/api/push/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "sl_proximity",
            pair: trade.pair,
            direction: trade.direction,
            title: `⛔ SL İhlali — ${trade.pair}`,
            body: `${trade.direction} ${trade.pair} — SL aşıldı, pozisyonu borsadan kapatın`,
          }),
        }).catch(() => {});
      }
    }

    timerRef.current = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
