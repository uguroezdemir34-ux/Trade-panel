/**
 * CANDLE POLLER — Her pair + timeframe için mum verisini periyodik çeker.
 *
 * Stale-while-revalidate: mount'ta önce localStorage cache'den anında yükler,
 * sonra arka planda taze veri çeker. Böylece ~1dk bekleme → anlık görüntü.
 */

"use client";

import { useEffect, useRef } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { fetchCandles, type Candle, type Timeframe } from "@/lib/okx/candles";
import { useCandleStore } from "@/lib/store/candleStore";

const TIMEFRAMES: Timeframe[] = ["4h", "1h", "15m"];
const TIMEFRAMES_1D: Timeframe[] = ["1d"];
const POLL_INTERVAL_MS = 30_000;
const CANDLE_LIMIT = 210;
const CANDLE_LIMIT_1D = 60;
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_PREFIX = "qx_c_";

function cacheKey(pair: string, tf: string): string {
  return `${CACHE_PREFIX}${pair}_${tf}`;
}

function loadCache(pair: string, tf: string): Candle[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(pair, tf));
    if (!raw) return null;
    const { d, ts } = JSON.parse(raw) as { d: Candle[]; ts: number };
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return d;
  } catch {
    return null;
  }
}

function saveCache(pair: string, tf: string, data: Candle[]): void {
  try {
    localStorage.setItem(cacheKey(pair, tf), JSON.stringify({ d: data, ts: Date.now() }));
  } catch {
    // QuotaExceededError — silently skip
  }
}

export function useCandlePoller(): void {
  const setCandles = useCandleStore((s) => s.setCandles);
  const setError = useCandleStore((s) => s.setError);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  async function fetchAll(): Promise<void> {
    await Promise.all(
      PAIRS.flatMap((pair) => [
        ...TIMEFRAMES.map(async (tf) => {
          const candles = await fetchCandles(pair, tf, CANDLE_LIMIT);
          if (candles) {
            setCandles(pair, tf, candles, Date.now());
            saveCache(pair, tf, candles);
          } else {
            setError(pair, tf, "fetch_failed");
          }
        }),
        ...TIMEFRAMES_1D.map(async (tf) => {
          const candles = await fetchCandles(pair, tf, CANDLE_LIMIT_1D);
          if (candles) {
            setCandles(pair, tf, candles, Date.now());
            saveCache(pair, tf, candles);
          } else {
            setError(pair, tf, "fetch_failed");
          }
        }),
      ]),
    );
  }

  useEffect(() => {
    // Stale-while-revalidate: load cached candles instantly on first render
    if (!initializedRef.current) {
      initializedRef.current = true;
      PAIRS.forEach((pair) => {
        ([...TIMEFRAMES, ...TIMEFRAMES_1D] as Timeframe[]).forEach((tf) => {
          const cached = loadCache(pair, tf);
          if (cached) {
            setCandles(pair, tf, cached, Date.now() - 1000);
          }
        });
      });
    }

    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
