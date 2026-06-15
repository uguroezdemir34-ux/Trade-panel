/**
 * CANDLE POLLER — Her pair + timeframe için mum verisini periyodik çeker.
 *
 * Stale-while-revalidate: mount'ta önce localStorage cache'den anında yükler,
 * sonra arka planda taze veri çeker. Böylece ~1dk bekleme → anlık görüntü.
 *
 * Rate-limit fix: OKX public endpoint limiti 20 req/2s (paylaşımlı Vercel IP).
 * Max 3 eşzamanlı istek; fetchShort tamamlanınca fetchLong başlar (sıralı).
 * Başarısız fetch → 1.5s sonra 1 otomatik retry, sonra bir sonraki poll'a bırak.
 */

"use client";

import { useEffect, useRef } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { fetchCandles, type Candle, type Timeframe } from "@/lib/okx/candles";
import { useCandleStore } from "@/lib/store/candleStore";

/** 15m + 1h: sinyal kritik, sık poll */
const TIMEFRAMES_SHORT: Timeframe[] = ["1h", "15m"];
/** 4h + 1d: yapısal, mum 4-24 saatte kapanır */
const TIMEFRAMES_LONG: Timeframe[] = ["4h", "1d"];
const POLL_INTERVAL_SHORT_MS = 60_000;
const POLL_INTERVAL_LONG_MS = 5 * 60_000;
const CANDLE_LIMIT = 210;
const CANDLE_LIMIT_1D = 60;
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const CACHE_PREFIX = "qx_c_";

/** Max eşzamanlı OKX isteği — paylaşımlı Vercel IP rate limit koruması */
const MAX_CONCURRENT = 3;

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

/**
 * Görevleri max N eşzamanlı çalıştır.
 */
async function runBatched(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  const queue = [...tasks];
  async function worker(): Promise<void> {
    let task = queue.shift();
    while (task) {
      await task();
      task = queue.shift();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

/** Tek fetch — başarısız olursa 1.5s sonra 1 retry. */
async function fetchWithRetry(
  pair: string,
  tf: Timeframe,
  limit: number,
): Promise<Candle[] | null> {
  const result = await fetchCandles(pair as Parameters<typeof fetchCandles>[0], tf, limit);
  if (result) return result;
  await new Promise<void>((r) => setTimeout(r, 1_500));
  return fetchCandles(pair as Parameters<typeof fetchCandles>[0], tf, limit);
}

function makeFetchTask(
  pair: string,
  tf: Timeframe,
  limit: number,
  setCandles: (p: string, tf: Timeframe, c: Candle[], ts: number) => void,
  setError: (p: string, tf: Timeframe, e: string) => void,
) {
  return async () => {
    const candles = await fetchWithRetry(pair, tf, limit);
    if (candles) {
      setCandles(pair as Parameters<typeof fetchCandles>[0], tf, candles, Date.now());
      saveCache(pair, tf, candles);
    } else {
      setError(pair as Parameters<typeof fetchCandles>[0], tf, "fetch_failed");
    }
  };
}

export function useCandlePoller(): void {
  const setCandles = useCandleStore((s) => s.setCandles);
  const setError = useCandleStore((s) => s.setError);
  const shortTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  async function fetchShort(): Promise<void> {
    const tasks = PAIRS.flatMap((pair) =>
      TIMEFRAMES_SHORT.map((tf) => makeFetchTask(pair, tf, CANDLE_LIMIT, setCandles, setError)),
    );
    await runBatched(tasks, MAX_CONCURRENT);
  }

  async function fetchLong(): Promise<void> {
    const tasks = PAIRS.flatMap((pair) => [
      makeFetchTask(pair, "4h", CANDLE_LIMIT, setCandles, setError),
      makeFetchTask(pair, "1d", CANDLE_LIMIT_1D, setCandles, setError),
    ]);
    await runBatched(tasks, MAX_CONCURRENT);
  }

  useEffect(() => {
    // Stale-while-revalidate: cache'den anında yükle, sonra fetch
    if (!initializedRef.current) {
      initializedRef.current = true;
      PAIRS.forEach((pair) => {
        ([...TIMEFRAMES_SHORT, ...TIMEFRAMES_LONG] as Timeframe[]).forEach((tf) => {
          const cached = loadCache(pair, tf);
          if (cached) setCandles(pair as Parameters<typeof setCandles>[0], tf, cached, Date.now() - 1000);
        });
      });
    }

    // Sıralı: short tamamlanınca long başlar → eşzamanlı OKX istek sayısı ≤ MAX_CONCURRENT
    void (async () => {
      await fetchShort();
      await fetchLong();
    })();

    shortTimerRef.current = setInterval(fetchShort, POLL_INTERVAL_SHORT_MS);
    longTimerRef.current = setInterval(fetchLong, POLL_INTERVAL_LONG_MS);

    return () => {
      if (shortTimerRef.current) clearInterval(shortTimerRef.current);
      if (longTimerRef.current) clearInterval(longTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
