/**
 * CANDLE POLLER — Her pair + timeframe için mum verisini periyodik çeker.
 *
 * Stale-while-revalidate: mount'ta önce localStorage cache'den anında yükler,
 * sonra arka planda taze veri çeker.
 *
 * İlk yükleme (fetchPairAllTFs): Her pair için 4 TF birlikte çekilir.
 * composeScoreInput candles4h >= 200 gerektirir — short/long sıralı yaklaşım
 * bunu bozuyordu (4h gelmeden score hesaplanamıyordu). Per-pair yaklaşım ile
 * her pair kendi verisiyle anında skor alır.
 *
 * Sonraki poll'lar: fetchShort (1h+15m) 60s'de bir, fetchLong (4h+1d) 5dk'da bir.
 */

"use client";

import { useEffect, useRef } from "react";

// --- debug instrumentation (?debug=1 only) ---
function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("debug") === "1"; }
  catch { return false; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function perfLog(entry: Record<string, unknown>): void {
  if (!isDebug()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__PERF_LOG__) w.__PERF_LOG__ = [];
  w.__PERF_LOG__.push({ ...entry, _ts: Date.now() });
}
// --- end debug ---
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

/** İlk yükleme: 2 pair eşzamanlı = max 8 OKX isteği — rate limit koruması */
const MAX_CONCURRENT_INIT = 2;
/** Sonraki poll'lar için max eşzamanlı TF isteği */
const MAX_CONCURRENT = 6;

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

  /** İlk yükleme: pair başına 4 TF birlikte çek (usePriorityFetch mantığı). */
  async function fetchPairAllTFs(pair: string): Promise<void> {
    const t0 = performance.now();
    let pairRetries = 0;
    const TFS: Array<[Timeframe, number]> = [
      ["15m", CANDLE_LIMIT],
      ["1h",  CANDLE_LIMIT],
      ["4h",  CANDLE_LIMIT],
      ["1d",  CANDLE_LIMIT_1D],
    ];
    await Promise.all(
      TFS.map(([tf, limit]) =>
        fetchWithRetry(pair, tf, limit, (waitMs, attempt) => {
          pairRetries++;
          perfLog({ type: "fetch_retry", pair, tf, attempt, waitMs });
        }).then((c) => {
          if (c) { setCandles(pair as Pair, tf, c, Date.now()); saveCache(pair, tf, c); }
          else {
            setError(pair as Pair, tf, "fetch_failed");
            perfLog({ type: "fetch_failed", pair, tf });
          }
        }),
      ),
    );
    perfLog({ type: "fetch_pair", pair, durationMs: Math.round(performance.now() - t0), retries: pairRetries });
  }

  async function fetchShort(): Promise<void> {
    const tasks = PAIRS.flatMap((pair) =>
      TIMEFRAMES_SHORT.map((tf) => makeFetchTask(pair, tf, CANDLE_LIMIT, setCandles, setError)),
    );
    await runBatched(tasks, MAX_CONCURRENT, 150);
  }

  async function fetchLong(): Promise<void> {
    const tasks = PAIRS.flatMap((pair) => [
      makeFetchTask(pair, "4h", CANDLE_LIMIT, setCandles, setError),
      makeFetchTask(pair, "1d", CANDLE_LIMIT_1D, setCandles, setError),
    ]);
    await runBatched(tasks, MAX_CONCURRENT, 200);
  }

  useEffect(() => {
    // Stale-while-revalidate: cache'den anında yükle
    if (!initializedRef.current) {
      initializedRef.current = true;
      PAIRS.forEach((pair) => {
        ([...TIMEFRAMES_SHORT, ...TIMEFRAMES_LONG] as Timeframe[]).forEach((tf) => {
          const cached = loadCache(pair, tf);
          if (cached) setCandles(pair as Pair, tf, cached, Date.now() - 1000);
        });
      });
    }

    // 1s gecikme: usePriorityFetch (BTC) tamamlanmadan başlatma
    // Per-pair: 4 TF birlikte → composeScoreInput (4h >= 200) anında geçer
    const initTimer = setTimeout(async () => {
      const batchT0 = performance.now();
      await runBatched(
        PAIRS.map((pair) => () => fetchPairAllTFs(pair)),
        MAX_CONCURRENT_INIT,
      );
      perfLog({ type: "init_complete", totalMs: Math.round(performance.now() - batchT0), pairs: PAIRS.length });
    }, 1_000);

    shortTimerRef.current = setInterval(fetchShort, POLL_INTERVAL_SHORT_MS);
    longTimerRef.current = setInterval(fetchLong, POLL_INTERVAL_LONG_MS);

    return () => {
      clearTimeout(initTimer);
      if (shortTimerRef.current) clearInterval(shortTimerRef.current);
      if (longTimerRef.current) clearInterval(longTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
