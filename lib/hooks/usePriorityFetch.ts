/**
 * PRIORITY FETCH — Aktif pair değiştiğinde tüm 4 TF'yi bulk queue'yu
 * atlatarak anında paralel çeker. useCandlePoller'ın sıralı batch'ine
 * göre ~4× daha hızlı ilk veri sağlar.
 *
 * Kullanım: karar/page.tsx ve grafik/page.tsx'de mount edilir.
 * AppShell/useCandlePoller'a dokunmaz; sadece candleStore'u günceller.
 */

"use client";

import { useEffect } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import {
  fetchWithRetry,
  saveCache,
  CANDLE_LIMIT,
  CANDLE_LIMIT_1D,
} from "@/lib/okx/candleFetch";
import type { Pair } from "@/lib/constants/pairs";
import type { Timeframe } from "@/lib/okx/candles";

const PRIORITY_TFS: Array<{ tf: Timeframe; limit: number }> = [
  { tf: "15m", limit: CANDLE_LIMIT },
  { tf: "1h",  limit: CANDLE_LIMIT },
  { tf: "4h",  limit: CANDLE_LIMIT },
  { tf: "1d",  limit: CANDLE_LIMIT_1D },
];

export function usePriorityFetch(pair: Pair, onDone?: (ms: number) => void): void {
  const setCandles = useCandleStore((s) => s.setCandles);
  const setError   = useCandleStore((s) => s.setError);

  useEffect(() => {
    const t0 = performance.now();
    void (async () => {
      await Promise.all(
        PRIORITY_TFS.map(async ({ tf, limit }) => {
          const candles = await fetchWithRetry(pair, tf, limit);
          if (candles) {
            setCandles(pair, tf, candles, Date.now());
            saveCache(pair, tf, candles);
          } else {
            setError(pair, tf, "fetch_failed");
          }
        }),
      );
      const ms = Math.round(performance.now() - t0);
      console.log("[PRIO]", pair, "all 4 tf done in", ms, "ms");
      onDone?.(ms);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, setCandles, setError]);
}
