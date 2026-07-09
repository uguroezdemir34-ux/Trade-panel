/**
 * ORDER BOOK POLLER — top-5 derinlik periyodik güncelleme (Anomali Işığı Faz 2).
 *
 * - Tüm PAIRS için `fetchOrderBook` çağırır, `computeOrderBookImbalance` ile
 *   türetir, orderBookStore'a yazar.
 * - 3 dakika cadence — OI/funding'den (5dk) daha sık ama candle'dan (dakikalar)
 *   çok daha seyrek; macro veri gibi "yavaş değişen" sınıfta.
 * - runBatched(MAX_CONCURRENT=3, staggerMs=250) — useCandlePoller ile aynı
 *   rate-limit disiplini, OKX'in paylaşılan Vercel IP public limitini
 *   (~20 req/2s) aşmamak için eşzamanlı istek sayısı ve başlangıç gecikmesi
 *   sınırlanır.
 */

"use client";

import { useEffect, useRef } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { fetchOrderBook } from "@/lib/okx/orderbook";
import { computeOrderBookImbalance } from "@/lib/market/orderbook-imbalance";
import { runBatched } from "@/lib/okx/candleFetch";
import { useOrderBookStore } from "@/lib/store/orderBookStore";

const POLL_INTERVAL_MS = 180_000; // 3 dakika
const MAX_CONCURRENT = 3;
const STAGGER_MS = 250;

export function useOrderBookPoller(delayMs = 0): void {
  const setImbalance = useOrderBookStore((s) => s.setImbalance);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function pollAll(): Promise<void> {
      const tasks = PAIRS.map((pair) => async () => {
        const snap = await fetchOrderBook(pair, 5);
        const result = computeOrderBookImbalance(snap);
        if (result) setImbalance(pair, result);
      });
      await runBatched(tasks, MAX_CONCURRENT, STAGGER_MS);
    }

    startTimerRef.current = setTimeout(() => {
      void pollAll();
      timerRef.current = setInterval(() => void pollAll(), POLL_INTERVAL_MS);
    }, delayMs);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // delayMs is a mount-time constant, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setImbalance]);
}
