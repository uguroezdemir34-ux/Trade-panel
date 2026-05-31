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

/** 15m + 1h: signal-critical, poll frequently */
const TIMEFRAMES_SHORT: Timeframe[] = ["1h", "15m"];
/** 4h + 1d: structural, a candle closes every 4-24h — no need for 30s polls */
const TIMEFRAMES_LONG: Timeframe[] = ["4h", "1d"];
const POLL_INTERVAL_SHORT_MS = 60_000; // was 30s — halves request count
const POLL_INTERVAL_LONG_MS = 5 * 60_000; // 4h/1d candles change every 4-24h
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
  const shortTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  async function fetchShort(): Promise<void> {
    await Promise.all(
      PAIRS.flatMap((pair) =>
        TIMEFRAMES_SHORT.map(async (tf) => {
          const candles = await fetchCandles(pair, tf, CANDLE_LIMIT);
          if (candles) {
            setCandles(pair, tf, candles, Date.now());
            saveCache(pair, tf, candles);
          } else {
            setError(pair, tf, "fetch_failed");
          }
        }),
      ),
    );
  }

  async function fetchLong(): Promise<void> {
    const limit4h = CANDLE_LIMIT;
    await Promise.all(
      PAIRS.flatMap((pair) => [
        (async () => {
          const candles = await fetchCandles(pair, "4h", limit4h);
          if (candles) { setCandles(pair, "4h", candles, Date.now()); saveCache(pair, "4h", candles); }
          else setError(pair, "4h", "fetch_failed");
        })(),
        (async () => {
          const candles = await fetchCandles(pair, "1d", CANDLE_LIMIT_1D);
          if (candles) { setCandles(pair, "1d", candles, Date.now()); saveCache(pair, "1d", candles); }
          else setError(pair, "1d", "fetch_failed");
        })(),
      ]),
    );
  }

  useEffect(() => {
    // Stale-while-revalidate: serve cache instantly on first render
    if (!initializedRef.current) {
      initializedRef.current = true;
      PAIRS.forEach((pair) => {
        ([...TIMEFRAMES_SHORT, ...TIMEFRAMES_LONG] as Timeframe[]).forEach((tf) => {
          const cached = loadCache(pair, tf);
          if (cached) setCandles(pair, tf, cached, Date.now() - 1000);
        });
      });
    }

    // Initial fetch for all TFs
    fetchShort();
    fetchLong();

    // 15m/1h: every 60s (was 30s — 2× reduction)
    shortTimerRef.current = setInterval(fetchShort, POLL_INTERVAL_SHORT_MS);
    // 4h/1d: every 5min (was 30s — 10× reduction for structural TFs)
    longTimerRef.current = setInterval(fetchLong, POLL_INTERVAL_LONG_MS);

    return () => {
      if (shortTimerRef.current) clearInterval(shortTimerRef.current);
      if (longTimerRef.current) clearInterval(longTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
