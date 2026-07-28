/**
 * PRIORITY FETCH — Aktif pair değiştiğinde tüm 4 TF'yi bulk queue'yu
 * atlatarak anında paralel çeker. useCandlePoller'ın sıralı batch'ine
 * göre ~4× daha hızlı ilk veri sağlar.
 *
 * Stale-while-revalidate (2dk TTL):
 *   1. Store'da eksik TF'ler için cache'den 2dk relaxed TTL ile anında yükler.
 *      → Score engine hemen hesaplar, "bekleniyor" sıfıra iner.
 *   2. Arka planda API'den taze veri çeker; try/finally ile onDone her
 *      çıkış yolunda (başarı, hata, exception) garantili çağrılır.
 *
 * Kullanım: karar/page.tsx ve grafik/page.tsx'de mount edilir.
 * AppShell/useCandlePoller'a dokunmaz; sadece candleStore'u günceller.
 */

"use client";

import { useEffect } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import {
  setPriorityPair,
  fetchWithRetry,
  saveCache,
  cacheKey,
  CANDLE_LIMIT,
  CANDLE_LIMIT_15M,
  CANDLE_LIMIT_1D,
} from "@/lib/okx/candleFetch";
import type { Candle, Timeframe } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";

/** 2 dakikadan yeni cache'i anında store'a yazar → score sıfır gecikmeyle hesaplanır. */
const STALE_CACHE_MAX_AGE = 2 * 60 * 1000;

const PRIORITY_TFS: Array<{ tf: Timeframe; limit: number }> = [
  { tf: "15m", limit: CANDLE_LIMIT_15M },
  { tf: "1h",  limit: CANDLE_LIMIT },
  { tf: "4h",  limit: CANDLE_LIMIT },
  { tf: "1d",  limit: CANDLE_LIMIT_1D },
];

function loadCacheRelaxed(pair: string, tf: string): Candle[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(pair, tf));
    if (!raw) return null;
    const { d, ts } = JSON.parse(raw) as { d: Candle[]; ts: number };
    if (Date.now() - ts > STALE_CACHE_MAX_AGE) return null;
    return d ?? null;
  } catch {
    return null;
  }
}

export function usePriorityFetch(
  pair: Pair,
  onDone?: (success: boolean, ms: number) => void,
  onPreload?: () => void,
): void {
  const setCandles = useCandleStore((s) => s.setCandles);
  const setError   = useCandleStore((s) => s.setError);

  useEffect(() => {
    setPriorityPair(pair);
    // Step 1 — Sync: 2 dakikadan yeni cache varsa hemen store'a yaz.
    const snap = useCandleStore.getState().candles;
    let preloadedAny = false;
    PRIORITY_TFS.forEach(({ tf }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(snap as any)[`${pair}_${tf}`]?.length) {
        const cached = loadCacheRelaxed(pair, tf);
        if (cached?.length) {
          setCandles(pair, tf, cached, Date.now() - 2_000);
          preloadedAny = true;
        }
      }
    });
    if (preloadedAny) onPreload?.();

    // Step 2 — Async: API'den taze veri çek.
    const t0 = performance.now();
    void (async () => {
      let anySuccess = false;
      try {
        await Promise.all(
          PRIORITY_TFS.map(async ({ tf, limit }) => {
            // TTL guard: 2 dakikadan yeni veri varsa network fetch'i atla
            const lastFetched = useCandleStore.getState().lastFetchedAt[`${pair}_${tf}` as `${Pair}_${Timeframe}`];
            if (lastFetched && Date.now() - lastFetched < STALE_CACHE_MAX_AGE) {
              anySuccess = true;
              return;
            }
            const candles = await fetchWithRetry(pair, tf, limit);
            if (candles) {
              setCandles(pair, tf, candles, Date.now());
              saveCache(pair, tf, candles);
              anySuccess = true;
            } else {
              setError(pair, tf, "fetch_failed");
            }
          }),
        );
      } finally {
        const ms = Math.round(performance.now() - t0);
        onDone?.(anySuccess, ms);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, setCandles, setError]);
}
