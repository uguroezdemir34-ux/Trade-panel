"use client";

/**
 * SL PROXIMITY ALERT — Açık pozisyon SL'e yaklaştığında Telegram bildirimi.
 *
 * Tetik:   fiyat SL_WARN_PCT içine girerse (varsayılan %3)
 * Cooldown: aynı trade için COOLDOWN_MS (15 dak) — Telegram spam'ı önler
 * Fiyat tazeliği: 15s'den eski tick → atla (stale data riski)
 *
 * NOT: Görsel uyarı için PositionCard'daki SlProximityWarning'e bakınız.
 */

import { useEffect, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { dispatchNotification } from "@/lib/notify/dispatch";

const CHECK_INTERVAL_MS = 30_000; // 30 saniye
const COOLDOWN_MS = 15 * 60_000; // aynı trade için 15 dak
const SL_WARN_PCT = 0.03;         // SL'e %3 yaklaştığında tetikle
const MAX_PRICE_STALE_MS = 15_000;

export function useSlProximityAlert(): void {
  const alertedRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function check(): Promise<void> {
      if (!useSettingsStore.getState().goAlertsEnabled) return;

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
        const distPct = Math.abs(price - sl) / price;

        if (distPct > SL_WARN_PCT) continue;

        const lastAlerted = alertedRef.current.get(trade.id) ?? 0;
        if (now - lastAlerted < COOLDOWN_MS) continue;

        alertedRef.current.set(trade.id, now);

        void dispatchNotification({
          kind: "sl_proximity",
          pair: trade.pair,
          direction: trade.direction,
          entry: price,
          stopPrice: sl,
          reasonText: `${(distPct * 100).toFixed(1)}% uzakta`,
          timestamp: now,
        }).catch(() => {});
      }
    }

    void check();
    timerRef.current = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
