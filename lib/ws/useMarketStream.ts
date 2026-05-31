"use client";

/**
 * USE MARKET STREAM — React hook ile WS client orchestration.
 *
 * Mantık:
 *   - Sayfa mount'a olduğunda bir defa WS client'ı başlatır
 *   - Tick gelince marketStore.pushTick() çağrılır
 *   - Status değişince marketStore.setConnection() çağrılır
 *   - Sayfa unmount'a olduğunda client.destroy() çağrılır
 *
 * SINGLETON PATTERN:
 *   - Birden fazla component bu hook'u kullansa bile **tek bir client**
 *     instance'ı oluşturulur. Aynı WS bağlantısını paylaşırlar.
 *   - HMR (hot module reload) sırasında eski client temizlenir.
 *
 * REST TICKER FALLBACK:
 *   - WS "silent" veya "disconnected" olduğunda REST ticker devreye girer.
 *   - Her 3 saniyede bir /api/okx/api/v5/market/ticker ile fiyat çeker.
 *   - WS geri döndüğünde (connected) fallback poller durur.
 */

import { useEffect } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { OkxWsClient } from "./client";
import type { ConnectionState } from "./types";
import { useMarketStore } from "@/lib/store/marketStore";
import { setActiveMarketClient } from "./marketClientRef";
import { fetchRestTicker } from "@/lib/okx/ticker";

// Module-level singleton
let activeClient: OkxWsClient | null = null;
let activeSubscriberCount = 0;

// REST fallback — circuit breaker + exponential backoff
// Prevents 300 req/min hammer when WS is down for extended periods.
const REST_FALLBACK_BASE_MS = 3_000;
const REST_FALLBACK_MAX_MS = 30_000;
const REST_CIRCUIT_BREAK_AFTER = 5; // consecutive all-failed rounds
const REST_CIRCUIT_BREAK_PAUSE_MS = 60_000;
// After 2 min without WS, drop to BTC+ETH only to conserve API quota
const REST_REDUCED_MODE_AFTER_MS = 2 * 60_000;

let restFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let restConsecutiveFailures = 0;
let restBackoffMs = REST_FALLBACK_BASE_MS;
let restFallbackStartedAt = 0;
let circuitOpenUntil = 0;

function scheduleNextFallback(): void {
  if (restFallbackTimer !== null || restFallbackStartedAt === 0) return;
  const delay = Date.now() < circuitOpenUntil ? REST_CIRCUIT_BREAK_PAUSE_MS : restBackoffMs;
  restFallbackTimer = setTimeout(runFallbackTick, delay);
}

async function runFallbackTick(): Promise<void> {
  restFallbackTimer = null;
  if (restFallbackStartedAt === 0) return; // stopped while tick was pending

  if (Date.now() < circuitOpenUntil) {
    scheduleNextFallback();
    return;
  }

  const { pushTick } = useMarketStore.getState();
  const now = Date.now();
  const elapsed = now - restFallbackStartedAt;
  // Reduced mode: WS down >2min → BTC+ETH only to preserve quota
  const activePairs = elapsed > REST_REDUCED_MODE_AFTER_MS ? [PAIRS[0], PAIRS[1]] : PAIRS;

  const results = await Promise.allSettled(
    activePairs.map(async (pair) => {
      const tick = await fetchRestTicker(pair, now);
      if (tick) pushTick(tick);
      return tick;
    }),
  );

  const anySuccess = results.some((r) => r.status === "fulfilled" && r.value !== null);
  if (anySuccess) {
    restConsecutiveFailures = 0;
    restBackoffMs = REST_FALLBACK_BASE_MS;
  } else {
    restConsecutiveFailures++;
    restBackoffMs = Math.min(restBackoffMs * 2, REST_FALLBACK_MAX_MS);
    if (restConsecutiveFailures >= REST_CIRCUIT_BREAK_AFTER) {
      circuitOpenUntil = now + REST_CIRCUIT_BREAK_PAUSE_MS;
      restConsecutiveFailures = 0;
    }
  }

  scheduleNextFallback();
}

function startRestFallback(): void {
  if (restFallbackStartedAt !== 0) return; // already running
  restFallbackStartedAt = Date.now();
  restBackoffMs = REST_FALLBACK_BASE_MS;
  restConsecutiveFailures = 0;
  scheduleNextFallback();
}

function stopRestFallback(): void {
  restFallbackStartedAt = 0;
  if (restFallbackTimer !== null) {
    clearTimeout(restFallbackTimer);
    restFallbackTimer = null;
  }
  restConsecutiveFailures = 0;
  restBackoffMs = REST_FALLBACK_BASE_MS;
}

function handleStatusChange(state: ConnectionState): void {
  useMarketStore.getState().setConnection(state);

  if (state.status === "silent" || state.status === "disconnected") {
    startRestFallback();
  } else if (state.status === "connected") {
    stopRestFallback();
  }
}

/**
 * Component'in WS stream'e bağlanmasını sağlar.
 * Birden fazla component çağırırsa singleton paylaşılır.
 *
 * @returns void (UI verisi marketStore'dan okunur)
 */
export function useMarketStream(): void {
  useEffect(() => {
    // Browser only
    if (typeof window === "undefined") return;

    // İlk subscriber → client'ı oluştur ve başlat
    if (!activeClient) {
      activeClient = new OkxWsClient({ autoConnect: true });
      setActiveMarketClient(activeClient);

      const { pushTick } = useMarketStore.getState();

      activeClient.onTick(pushTick);
      activeClient.onStatus(handleStatusChange);
    }

    activeSubscriberCount++;

    return () => {
      activeSubscriberCount--;
      // Son subscriber gitti → client'ı destroy et
      if (activeSubscriberCount <= 0 && activeClient) {
        stopRestFallback();
        activeClient.destroy();
        activeClient = null;
        setActiveMarketClient(null);
        activeSubscriberCount = 0;
        useMarketStore.getState().reset();
      }
    };
  }, []);
}

/**
 * Test helper — module-level singleton'ı temizle.
 * Production'da çağırılmamalı.
 */
export function _resetMarketStreamForTesting(): void {
  if (activeClient) {
    activeClient.destroy();
    activeClient = null;
    setActiveMarketClient(null);
  }
  activeSubscriberCount = 0;
}
