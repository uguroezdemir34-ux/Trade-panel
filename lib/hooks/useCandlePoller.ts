/**
 * CANDLE POLLER — Her pair + timeframe için mum verisini periyodik çeker.
 *
 * Stale-while-revalidate: mount'ta önce localStorage cache'den anında yükler,
 * sonra arka planda taze veri çeker. Böylece ~1dk bekleme → anlık görüntü.
 *
 * Rate-limit: OKX public endpoint limiti 20 req/2s (paylaşımlı Vercel IP).
 * Max 12 eslesik istek; 20p×2TF=40 task → 4 tur. fetchShort biter, fetchLong baslar.
 * Başarısız fetch → 1.5s sonra 1 otomatik retry, sonra bir sonraki poll'a bırak.
 *
 * Aktif pair önceliği: setFocusedPair() ile işaretlenen pair her batch'te öne alınır.
 */

"use client";

import { useEffect, useRef } from "react";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { type Candle, type Timeframe } from "@/lib/okx/candles";
import { useCandleStore } from "@/lib/store/candleStore";
import {
  fetchWithRetry,
  runBatched,
  loadCache,
  saveCache,
  CANDLE_LIMIT,
  CANDLE_LIMIT_1D,
} from "@/lib/okx/candleFetch";

/** 15m + 1h: sinyal kritik, sık poll */
const TIMEFRAMES_SHORT: Timeframe[] = ["1h", "15m"];
/** 4h + 1d: yapısal, mum 4-24 saatte kapanır */
const TIMEFRAMES_LONG: Timeframe[] = ["4h", "1d"];
const POLL_INTERVAL_SHORT_MS = 60_000;
const POLL_INTERVAL_LONG_MS = 5 * 60_000;

/** Max eşzamanlı OKX isteği — 20 pair × 2 TF = 40 task/batch; 12 ile 4 tur */
const MAX_CONCURRENT = 12;

/** Aktif pair — her batch'te öne alınır. setFocusedPair() ile güncellenir. */
let focusedPair: Pair | null = null;

/** Karar/grafik sayfalarından çağrılır; aktif pair'i batch sırasının başına taşır. */
export function setFocusedPair(pair: Pair): void {
  focusedPair = pair;
}

function orderedPairs(): Pair[] {
  if (!focusedPair) return [...PAIRS];
  return [focusedPair, ...PAIRS.filter((p) => p !== focusedPair)];
}

function makeFetchTask(
  pair: string,
  tf: Timeframe,
  limit: number,
  setCandles: (p: Pair, tf: Timeframe, c: Candle[], ts: number) => void,
  setError: (p: Pair, tf: Timeframe, e: string) => void,
) {
  return async () => {
    const candles = await fetchWithRetry(pair, tf, limit);
    if (candles) {
      setCandles(pair as Pair, tf, candles, Date.now());
      saveCache(pair, tf, candles);
    } else {
      setError(pair as Pair, tf, "fetch_failed");
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
    const tasks = orderedPairs().flatMap((pair) =>
      TIMEFRAMES_SHORT.map((tf) => makeFetchTask(pair, tf, CANDLE_LIMIT, setCandles, setError)),
    );
    await runBatched(tasks, MAX_CONCURRENT);
  }

  async function fetchLong(): Promise<void> {
    const tasks = orderedPairs().flatMap((pair) => [
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
          if (cached) setCandles(pair as Pair, tf, cached, Date.now() - 1000);
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
