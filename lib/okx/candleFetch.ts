/**
 * CANDLE FETCH UTILITIES — useCandlePoller ve usePriorityFetch tarafından
 * paylaşılan temel yardımcılar: localStorage cache, fetchWithRetry, runBatched.
 *
 * Bu modül saf yardımcı fonksiyonlar içerir; hook değildir.
 * Yalnızca client-side context'ten çağrılmalıdır (localStorage kullanır).
 */

import { fetchCandles, type Candle, type Timeframe } from "@/lib/okx/candles";

export const CACHE_PREFIX    = "qx_c_";
export const CANDLE_LIMIT     = 210;
export const CANDLE_LIMIT_15M = 50;  // ADX14 → 29 bar yeterli; backtest 1h proxy kullanır
export const CANDLE_LIMIT_1D  = 60;
const CACHE_MAX_AGE_MS       = 10 * 60 * 1000;

export function cacheKey(pair: string, tf: string): string {
  return `${CACHE_PREFIX}${pair}_${tf}`;
}

export function loadCache(pair: string, tf: string): Candle[] | null {
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

export function saveCache(pair: string, tf: string, data: Candle[]): void {
  try {
    localStorage.setItem(cacheKey(pair, tf), JSON.stringify({ d: data, ts: Date.now() }));
  } catch {
    // QuotaExceededError — silently skip
  }
}

/** Tek fetch — başarısız olursa exponential backoff ile 2 retry (1s, 3s). */
export async function fetchWithRetry(
  pair: string,
  tf: Timeframe,
  limit: number,
  onRetry?: (waitMs: number, attempt: number) => void,
): Promise<Candle[] | null> {
  const delays = [1_000, 3_000];
  for (let i = 0; i <= delays.length; i++) {
    const result = await fetchCandles(pair as Parameters<typeof fetchCandles>[0], tf, limit);
    if (result) return result;
    if (i < delays.length) {
      onRetry?.(delays[i], i + 1);
      await new Promise<void>((r) => setTimeout(r, delays[i]));
    }
  }
  return null;
}

/** usePriorityFetch tarafından şu an çekilen pair — poller init'te bu pair'i atlar. */
let _priorityPair: string | null = null;
export function setPriorityPair(pair: string): void { _priorityPair = pair; }
export function getPriorityPair(): string | null { return _priorityPair; }

/** Görevleri max N eşzamanlı çalıştır; staggerMs: worker başlangıç aralığı. */
export async function runBatched(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
  staggerMs = 0,
): Promise<void> {
  // task index'iyle birlikte kuyruğa alınıyor — pair/tf burada bilinmiyor
  // (task opaque bir closure), ama en azından kuyruk pozisyonu loglanabilsin.
  const queue = tasks.map((task, index) => ({ task, index }));
  async function worker(workerIndex: number): Promise<void> {
    if (staggerMs > 0 && workerIndex > 0)
      await new Promise<void>((r) => setTimeout(r, workerIndex * staggerMs));
    let item = queue.shift();
    while (item) {
      try {
        await item.task();
      } catch (err) {
        // task() zaten kendi try/catch'ine sahipse (fetchCandles, saveCache
        // vb.) bu no-op'tur — beklenmedik bir throw'a karşı savunma:
        // worker kalıcı olarak durmasın, kuyruğa devam etsin (FAZ 3).
        console.warn(`[runBatched] task #${item.index} threw, kuyruğa devam ediliyor`, err);
      }
      item = queue.shift();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, (_, i) => worker(i)));
}
