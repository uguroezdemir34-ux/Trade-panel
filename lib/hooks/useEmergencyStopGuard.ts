"use client";

/**
 * EMERGENCY STOP GUARD — İkinci katman stop-loss izleme.
 *
 * EXECUTION_ENABLED=true: SL ihlalinde adapter.closePosition() çağrılır.
 * EXECUTION_ENABLED=false: SL ihlalinde Telegram + browser uyarısı gönderilir,
 *   emir GÖNDERİLMEZ. Kullanıcı pozisyonu borsadan manuel kapatmalıdır.
 *   Her trade için 5 dakikada bir uyarı tekrarlanır (spam koruması).
 */

import { useEffect, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { getAdapter } from "@/lib/exchange";
import { EXECUTION_ENABLED } from "@/lib/config/execution";
import { createChannel } from "@/lib/notify/registry";
import { browserNotify } from "@/lib/notify/browser";

const CHECK_INTERVAL_MS = 5_000;
const SL_BREACH_BUFFER = 0.0015;
const MAX_PRICE_STALE_MS = 15_000;
// Execution kapalıyken aynı trade için uyarı tekrar süresi
const WARN_COOLDOWN_MS = 5 * 60_000;

export function useEmergencyStopGuard(): void {
  const demoMode = useSettingsStore((s) => s.demoMode);
  const closingRef = useRef<Set<string>>(new Set());
  const warnedRef = useRef<Map<string, number>>(new Map()); // id → last warned ts
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
        if (tick.ts && now - tick.ts > MAX_PRICE_STALE_MS) continue;

        const price = tick.last;
        const sl = trade.stopPrice;

        const breached =
          trade.direction === "LONG"
            ? price <= sl * (1 - SL_BREACH_BUFFER)
            : price >= sl * (1 + SL_BREACH_BUFFER);

        if (!breached) continue;

        if (!EXECUTION_ENABLED) {
          // ── Execution kapalı: uyar, emir gönderme ──
          const lastWarned = warnedRef.current.get(trade.id) ?? 0;
          if (now - lastWarned < WARN_COOLDOWN_MS) continue;
          warnedRef.current.set(trade.id, now);

          const msg = `⛔ SL İHLALİ — ${trade.direction} ${trade.pair} fiyat=${price.toFixed(4)} sl=${sl.toFixed(4)} — Pozisyonu borsadan kapatın!`;
          console.warn("[EmergencyStopGuard]", msg);

          browserNotify("⛔ Acil Stop Uyarısı", `${trade.pair} SL seviyesi aşıldı — OKX'ten kapatın`);

          const channel = createChannel("telegram");
          if (channel.isConfigured()) {
            void channel.send({
              kind: "sl_proximity",
              pair: trade.pair,
              direction: trade.direction,
              entry: price,
              stopPrice: sl,
              reasonText: `⛔ SL İHLALİ — Pozisyonu borsadan manuel kapatın!`,
              timestamp: now,
            }).catch(() => {});
          }
          continue;
        }

        // ── Execution açık: pozisyonu kapat ──
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
            console.error(`[EmergencyStop] kapatma başarısız: ${result.errorMessage}`);
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
