"use client";

import { useEffect } from "react";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { directionalMovePct, isAdverseMove } from "@/lib/signals/outcomeTracking";

// 15 dakika outcome: 15–20 dakika penceresi
const WIN_15M_MIN = 15 * 60_000;
const WIN_15M_MAX = 20 * 60_000;

// 1 saat outcome: 60–65 dakika penceresi
const WIN_1H_MIN = 60 * 60_000;
const WIN_1H_MAX = 65 * 60_000;

/**
 * GO sinyal sonrası fiyat hareketi takipçisi.
 *
 * Her 30 saniyede bir çalışır; outcome15m/outcome1h eksik entryleri
 * tarar ve zamanı geldiyse marketStore'daki anlık fiyatla doldurur.
 * Browser kapalıyken çalışmaz — pencere geçilirse outcome undefined kalır.
 */
export function useGoSignalOutcomeTracker(): void {
  const entries = useGoSignalLogStore((s) => s.entries);
  const updateOutcome = useGoSignalLogStore((s) => s.updateOutcome);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const prices = useMarketStore.getState().prices;

      for (const entry of entries) {
        // Fiyat güvenilir değilse atla
        if (entry.priceWasStale || entry.triggerPriceAtGo <= 0) continue;

        const elapsed = now - entry.ts;
        const currentPrice = prices[entry.pair]?.last ?? null;
        if (!currentPrice || currentPrice <= 0) continue;

        const movePct =
          ((currentPrice - entry.triggerPriceAtGo) / entry.triggerPriceAtGo) * 100;
        const movePctDir = directionalMovePct(entry.triggerPriceAtGo, currentPrice, entry.direction);
        const isAdverse = isAdverseMove(movePctDir);

        if (!entry.outcome15m && elapsed >= WIN_15M_MIN && elapsed <= WIN_15M_MAX) {
          updateOutcome(entry.pair, entry.ts, "outcome15m", {
            price: currentPrice,
            movePct,
            isAdverse,
            ts: now,
          });
        }
        if (!entry.outcome1h && elapsed >= WIN_1H_MIN && elapsed <= WIN_1H_MAX) {
          updateOutcome(entry.pair, entry.ts, "outcome1h", {
            price: currentPrice,
            movePct,
            isAdverse,
            ts: now,
          });
        }
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [entries, updateOutcome]);
}
