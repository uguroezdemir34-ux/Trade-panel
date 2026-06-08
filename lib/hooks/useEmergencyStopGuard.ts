"use client";

/**
 * EMERGENCY STOP GUARD — İkinci katman stop-loss koruması.
 *
 * OKX/Binance/Bybit algo emri tetiklenmediği durumda (gapdown, bağlantı
 * kesintisi, vb.) client tarafında fiyatı izler ve SL seviyesi aşılınca
 * pozisyonu kapatır. Aktif borsaya göre doğru adapter kullanılır.
 *
 * Çalışma prensibi:
 *   - 5s'de bir tüm açık trade'lerin fiyatını kontrol eder
 *   - LONG: fiyat ≤ slPrice × (1 - buffer) ise → acil kapat
 *   - SHORT: fiyat ≥ slPrice × (1 + buffer) ise → acil kapat
 *   - positionStore'dan gerçek instId alınır (borsa bağımsız format)
 *   - closingSet ile çift-tetikleme engellenir
 *   - Başarısız kapatma → sonraki döngüde tekrar denenir
 */

import { useEffect, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { getAdapter } from "@/lib/exchange";

const CHECK_INTERVAL_MS = 5_000;

// SL fiyatı bu kadar aşılınca exchange algo emrinin kaçırdığı kabul edilir.
// %0.15 buffer: normal volatilite değil, gerçek breach.
const SL_BREACH_BUFFER = 0.0015;

// Fiyat verisinin bu süreden daha eski olması durumunda guard devre dışı kalır
// (stale veri ile yanlış tetikleme riski)
const MAX_PRICE_STALE_MS = 15_000;

export function useEmergencyStopGuard(): void {
  const demoMode = useSettingsStore((s) => s.demoMode);
  const closingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoRef = useRef(demoMode);
  demoRef.current = demoMode;

  useEffect(() => {
    async function check(): Promise<void> {
      const openTrades = useTradesStore.getState().getOpen();
      if (openTrades.length === 0) return;

      const { prices } = useMarketStore.getState();
      const positions = usePositionStore.getState().positions;
      const now = Date.now();

      for (const trade of openTrades) {
        if (!trade.stopPrice || trade.stopPrice <= 0) continue;
        if (closingRef.current.has(trade.id)) continue;

        const tick = prices[trade.pair];
        if (!tick || tick.last <= 0) continue;

        // Stale fiyat → bekle (WS kesilmiş olabilir, yanlış tetikleme riski)
        if (tick.ts && now - tick.ts > MAX_PRICE_STALE_MS) continue;

        const price = tick.last;
        const sl = trade.stopPrice;

        const breached =
          trade.direction === "LONG"
            ? price <= sl * (1 - SL_BREACH_BUFFER)
            : price >= sl * (1 + SL_BREACH_BUFFER);

        if (!breached) continue;

        // positionStore'dan gerçek instId al — borsa bağımsız format (OKX:"BTC-USDT-SWAP", BNB:"BTCUSDT")
        const position = positions.find(
          (p) => p.pair === trade.pair && p.direction === trade.direction,
        );
        if (!position) continue;

        console.warn(
          `[EmergencyStop] ${trade.direction} ${trade.pair} SL ihlali — ` +
            `fiyat=${price.toFixed(4)} sl=${sl.toFixed(4)} instId=${position.instId} → acil kapatma`,
        );

        closingRef.current.add(trade.id);

        const adapter = getAdapter(demoRef.current);
        const posSide =
          position.posSide === "long" || position.posSide === "short"
            ? position.posSide
            : undefined;

        try {
          const result = await adapter.closePosition({
            instId: position.instId,
            mgnMode: position.mgnMode,
            posSide,
          });

          if (result.ok) {
            usePositionStore.getState().removePosition(position.instId);
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
