/**
 * HISTORY CANDLES — OKX /api/v5/market/history-candles cursor pagination.
 *
 * Regular /market/candles → max 300 bars (recent only).
 * /market/history-candles → max 100 bars per call, paginated via `after` cursor.
 *   `after` = oldest ts from last batch → returns candles BEFORE that ts.
 *
 * Rate limit: OKX public endpoints ≈ 20 req/2s.
 * We use 1 req/300ms (3.3 req/s) — safe with margin.
 */

import { parseCandleResponse, type Candle, type Timeframe } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";

const HISTORY_PATH = "/api/okx/api/v5/market/history-candles";
const LIMIT = 100;
const THROTTLE_MS = 300;

function instId(pair: Pair): string { return `${pair}-USDT-SWAP`; }
function bar(tf: Timeframe): string {
  if (tf === "1w") return "1W";
  if (tf === "1d") return "1D";
  if (tf === "4h") return "4H";
  if (tf === "1h") return "1H";
  return tf;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(
  pair: Pair,
  tf: Timeframe,
  afterTs?: number,
): Promise<Candle[] | null> {
  let url =
    `${HISTORY_PATH}?instId=${encodeURIComponent(instId(pair))}&bar=${bar(tf)}&limit=${LIMIT}`;
  if (afterTs !== undefined) url += `&after=${afterTs}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await res.json() as Record<string, unknown>;

    // Handle proxy envelope (same logic as fetchCandles)
    if (typeof raw.ok === "boolean") {
      if (!raw.ok) return null;
      const inner = raw.data;
      if (Array.isArray(inner)) return parseCandleResponse({ code: "0", data: inner });
      if (inner && typeof inner === "object") return parseCandleResponse(inner);
      return null;
    }
    if (typeof raw.code === "string") return parseCandleResponse(raw);
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch historical candles from `fromMs` to now.
 *
 * Pages backward (newest → oldest) using `after` cursor until we've
 * collected enough bars or reached fromMs.
 *
 * @param onProgress called with (fetched, estimated) — for progress UI
 */
export async function fetchHistoricalCandleRange(
  pair: Pair,
  tf: Timeframe,
  fromMs: number,
  onProgress?: (fetched: number, estimated: number) => void,
): Promise<Candle[]> {
  const all: Candle[] = [];
  let afterTs: number | undefined;
  let retries = 0;
  const MAX_RETRIES = 3;
  const MS_PER_BAR: Record<Timeframe, number> = {
    "1w": 604_800_000,
    "1d": 86_400_000,
    "4h": 14_400_000,
    "1h": 3_600_000,
    "15m": 900_000,
    "5m": 300_000,
    "1m": 60_000,
  };
  const estimated = Math.ceil((Date.now() - fromMs) / MS_PER_BAR[tf]);

  while (true) {
    const page = await fetchPage(pair, tf, afterTs);

    if (!page || page.length === 0) {
      retries++;
      if (retries >= MAX_RETRIES) break;
      await sleep(THROTTLE_MS * 2);
      continue;
    }

    retries = 0;

    // page is sorted oldest→newest; we paginate backward so newest is at end
    // oldest in this page = page[0].ts
    const oldest = page[0].ts;

    // Prepend to accumulation (older candles go before newer ones)
    all.unshift(...page);

    onProgress?.(all.length, estimated);

    if (oldest <= fromMs || page.length < LIMIT) break;

    afterTs = oldest; // next call: fetch candles older than oldest
    await sleep(THROTTLE_MS);
  }

  // Deduplicate and sort ascending by ts
  const map = new Map<number, Candle>();
  for (const c of all) map.set(c.ts, c);
  const sorted = Array.from(map.values()).sort((a, b) => a.ts - b.ts);

  // Filter to requested range
  return sorted.filter((c) => c.ts >= fromMs);
}
