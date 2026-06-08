"use client";

/**
 * EMERGENCY STOP GUARD — İkinci katman stop-loss koruması.
 *
 * OKX algo emri tetiklenmediği durumda (gapdown, bağlantı kesintisi, vb.)
 * client tarafında fiyatı izler ve SL seviyesi aşılınca pozisyonu kapatır.
 *
 * Çalışma prensibi:
 *   - 5s'de bir tüm açık trade'leri kontrol eder
 *   - LONG: fiyat ≤ slPrice × (1 - buffer) ise → acil kapat
 *   - SHORT: fiyat ≥ slPrice × (1 + buffer) ise → acil kapat
 *   - closingSet ile çift-tetikleme engellenir
 *   - Başarısız kapatma → 1 kez daha denenir (buffer sonraki döngüde temizlenir)
 */

import { useEffect, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { getOkxAdapter } from "@/lib/exchange/okx-adapter";
import { pairToInstId } from "@/lib/exchange/okx/symbol-format";

const CHECK_INTERVAL_MS = 5_000;

// SL fiyatı bu kadar aşılınca OKX algo emrinin kaçırdığı kabul edilir.
// %0.15 buffer: normal volatilite değil, gerçek breach.
const SL_BREACH_BUFFER = 0.0015;

export function useEmergencyStopGuard(): void {
  const demoMode = useSettingsStore((s) => s.demoMode);
  // Şu an kapatma işlemi süren trade ID'leri — çift tetikleme engeli
  const closingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoRef = useRef(demoMode);
  demoRef.current = demoMode;

  useEffect(() => {
    async function check(): Promise<void> {
      const openTrades = useTradesStore.getState().getOpen();
      if (openTrades.length === 0) return;

      const prices = useMarketStore.getState().prices;
      const positions = usePositionStore.getState().positions;

      for (const trade of openTrades) {
        if (!trade.stopPrice || trade.stopPrice <= 0) continue;
        if (closingRef.current.has(trade.id)) continue;

        const tick = prices[trade.pair];
        if (!tick || tick.last <= 0) continue;

        const price = tick.last;
        const sl = trade.stopPrice;

        const breached =
          trade.direction === "LONG"
            ? price <= sl * (1 - SL_BREACH_BUFFER)
            : price >= sl * (1 + SL_BREACH_BUFFER);

        if (!breached) continue;

        const instId = pairToInstId(trade.pair);
        const positionExists = positions.some((p) => p.instId === instId);
        if (!positionExists) continue;

        console.warn(
          `[EmergencyStop] ${trade.direction} ${trade.pair} SL ihlali — ` +
            `fiyat=${price.toFixed(4)} sl=${sl.toFixed(4)} → acil kapatma`,
        );

        closingRef.current.add(trade.id);

        const adapter = getOkxAdapter(demoRef.current);

        const position = positions.find((p) => p.instId === instId);
        const posSide =
          position?.posSide === "long" || position?.posSide === "short"
            ? position.posSide
            : undefined;

        try {
          const result = await adapter.closePosition({
            instId,
            mgnMode: position?.mgnMode ?? "cross",
            posSide,
          });

          if (result.ok) {
            usePositionStore.getState().removePosition(instId);
            useTradesStore.getState().closeTradeById({
              id: trade.id,
              exitPrice: price,
              reason: "sl",
              now: Date.now(),
            });
            console.log(`[EmergencyStop] ${trade.pair} başarıyla kapatıldı`);
          } else {
            console.error(
              `[EmergencyStop] kapatma başarısız: ${result.errorMessage} — sonraki döngüde tekrar denenecek`,
            );
            // Bir sonraki check döngüsünde tekrar denenebilsin diye kaldır
            closingRef.current.delete(trade.id);
          }
        } catch (e) {
          console.error("[EmergencyStop] kapatma hatası:", e);
          closingRef.current.delete(trade.id);
        }
      }
    }

    timerRef.current = setInterval(() => void check(), CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
