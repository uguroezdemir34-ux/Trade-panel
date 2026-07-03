/**
 * CANDLE FETCH UTILITIES — useCandlePoller ve usePriorityFetch tarafından
 * paylaşılan temel yardımcılar: localStorage cache, fetchWithRetry, runBatched.
 *
 * Bu modül saf yardımcı fonksiyonlar içerir; hook değildir.
 * Yalnızca client-side context'ten çağrılmalıdır (localStorage kullanır).
 */

import { fetchCandles, type Candle, type Timeframe } from "@/lib/okx/candles";

export const CACHE_PREFIX    = "qx_c_";
export const CANDLE_LIMIT    = 210;
export const CANDLE_LIMIT_1D = 60;
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
): Promise<Candle[] | null> {
  const delays = [1_000, 3_000];
  for (let i = 0; i <= delays.length; i++) {
    const result = await fetchCandles(pair as Parameters<typeof fetchCandles>[0], tf, limit);
    if (result) return result;
    if (i < delays.length) await new Promise<void>((r) => setTimeout(r, delays[i]));
  }
  return null;
}

/** Görevleri max N eşzamanlı çalıştır; staggerMs: worker başlangıç aralığı. */
export async function runBatched(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
  staggerMs = 0,
): Promise<void> {
  const queue = [...tasks];
  async function worker(index: number): Promise<void> {
    if (staggerMs > 0 && index > 0)
      await new Promise<void>((r) => setTimeout(r, index * staggerMs));
    let task = queue.shift();
    while (task) {
      await task();
      task = queue.shift();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, (_, i) => worker(i)));
}
