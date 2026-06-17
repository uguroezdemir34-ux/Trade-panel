/**
 * SERVER-SIDE SIGNAL ENGINE — Cron job score computation.
 *
 * Fetches OKX candles directly (public API — no signing needed),
 * runs the same composeScoreInput + computeScore pipeline as the browser.
 * Stateless: deduplication via two-bar comparison (no DB required).
 *
 * Used by: /api/cron/signal-check, /api/cron/daily-summary
 */

import { composeScoreInput } from "@/lib/score/composeScoreInput";
import { computeScore } from "@/lib/score/orchestrator";
import type { Pair } from "@/lib/constants/pairs";
import type { Candle } from "@/lib/okx/candles";

const OKX_BASE = "https://www.okx.com";
const CANDLE_MIN_1H = 200;
const CANDLE_MIN_4H = 200;
const CANDLE_MIN_15M = 20;

/** Frozen risk/macro state — mirrors backtest engine FROZEN_STATE */
const FROZEN_STATE = {
  eventSkipUntil: null,
  btcCooldownUntil: null,
  btcCooldownReason: "",
  btcSelfCooldownUntil: null,
  lockReleasedAt: null,
  openPositions: [] as [],
  drawdownProtocol: {
    tier: "normal" as const,
    minScore: 80,
    label: "Normal",
    reason: "",
  },
  trades: [] as [],
  srModifier: 0,
  sweep15m: { type: null as null, strength: 0 as const },
  timeQuality: { quality: 1.0, reason: "server-cron" },
};

export interface ServerSignalResult {
  pair: Pair;
  verdict: "go" | "wait" | "no";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
  prevVerdict: "go" | "wait" | "no" | null;
  isNewSignal: boolean;
  price: number;
  error?: string;
}

/** Fetch OKX public candles — no auth required */
async function fetchOkxCandles(instId: string, bar: string, limit: number): Promise<Candle[]> {
  const url = `${OKX_BASE}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { code: string; data?: string[][] };
    if (json.code !== "0" || !Array.isArray(json.data)) return [];
    return json.data
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        confirm: row[8] === "1",
      }))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/** Score a single pair using server-fetched candles */
async function fetchAndScore(pair: Pair): Promise<{
  candles1h: Candle[];
  candles4h: Candle[];
  score: number;
  verdict: "go" | "wait" | "no";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  price: number;
} | null> {
  const instId = `${pair}-USDT-SWAP`;
  const [raw1h, raw4h] = await Promise.all([
    fetchOkxCandles(instId, "1H", 300),
    fetchOkxCandles(instId, "4H", 300),
  ]);

  // Only use confirmed (closed) bars
  const candles1h = raw1h.filter((c) => c.confirm);
  const candles4h = raw4h.filter((c) => c.confirm);

  if (candles1h.length < CANDLE_MIN_1H || candles4h.length < CANDLE_MIN_4H) return null;

  const latest = candles1h[candles1h.length - 1];
  const candles15m = candles1h.slice(-25); // 1h bars as 15m proxy (same approach as backtest)

  if (candles15m.length < CANDLE_MIN_15M) return null;

  const composed = composeScoreInput({
    pair,
    livePrice: latest.close,
    candles1h,
    candles4h,
    candles15m,
    fg: 50, // neutral frozen F&G
    fundingRate: null,
    oiVelocityScore: null,
    now: latest.ts,
    ...FROZEN_STATE,
  });

  if (!composed) return null;

  const result = computeScore({ ...composed, scorerWeights: null });

  return {
    candles1h,
    candles4h,
    score: result.score,
    verdict: result.verdict,
    direction: result.direction,
    price: latest.close,
  };
}

/** Score using the second-to-last bar (for deduplication comparison) */
function scorePrevBar(
  candles1h: Candle[],
  candles4h: Candle[],
  pair: Pair,
): "go" | "wait" | "no" | null {
  const prev1h = candles1h.slice(0, -1);
  const prevLatest = prev1h[prev1h.length - 1];
  if (!prevLatest) return null;

  const prev15m = prev1h.slice(-25);
  if (prev1h.length < CANDLE_MIN_1H || prev15m.length < CANDLE_MIN_15M) return null;

  // 4h: re-align to previous bar's timestamp
  const prev4h = candles4h.filter((c) => c.ts <= prevLatest.ts);
  if (prev4h.length < CANDLE_MIN_4H) return null;

  try {
    const composed = composeScoreInput({
      pair,
      livePrice: prevLatest.close,
      candles1h: prev1h,
      candles4h: prev4h,
      candles15m: prev15m,
      fg: 50,
      fundingRate: null,
      oiVelocityScore: null,
      now: prevLatest.ts,
      ...FROZEN_STATE,
    });
    if (!composed) return null;
    return computeScore({ ...composed, scorerWeights: null }).verdict;
  } catch {
    return null;
  }
}

/**
 * Compute server-side signal for a single pair.
 * Returns null if candle data is insufficient.
 */
export async function computeServerSignal(pair: Pair): Promise<ServerSignalResult | null> {
  try {
    const current = await fetchAndScore(pair);
    if (!current) return null;

    const prevVerdict = scorePrevBar(current.candles1h, current.candles4h, pair);
    const isNewSignal = current.verdict === "go" && prevVerdict !== "go";

    return {
      pair,
      verdict: current.verdict,
      direction: current.direction,
      score: current.score,
      prevVerdict,
      isNewSignal,
      price: current.price,
    };
  } catch (err) {
    return {
      pair,
      verdict: "no" as const,
      direction: "NEUTRAL",
      score: 0,
      prevVerdict: null,
      isNewSignal: false,
      price: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Batch compute signals for all pairs in parallel */
export async function computeAllSignals(pairs: readonly Pair[]): Promise<ServerSignalResult[]> {
  const results = await Promise.all(pairs.map((p) => computeServerSignal(p)));
  return results.filter((r): r is ServerSignalResult => r !== null);
}

/** Fetch 24h ticker data for all SWAP pairs */
export async function fetch24hTickers(
  pairs: readonly Pair[],
): Promise<Map<Pair, { last: number; chg24hPct: number }>> {
  const map = new Map<Pair, { last: number; chg24hPct: number }>();
  try {
    const res = await fetch(`${OKX_BASE}/api/v5/market/tickers?instType=SWAP`, {
      cache: "no-store",
    });
    if (!res.ok) return map;
    const json = (await res.json()) as {
      code: string;
      data?: Array<{ instId: string; last: string; open24h: string }>;
    };
    if (json.code !== "0" || !Array.isArray(json.data)) return map;

    for (const ticker of json.data) {
      for (const pair of pairs) {
        if (ticker.instId === `${pair}-USDT-SWAP`) {
          const last = Number(ticker.last);
          const open24h = Number(ticker.open24h);
          map.set(pair, {
            last,
            chg24hPct: open24h > 0 ? ((last - open24h) / open24h) * 100 : 0,
          });
        }
      }
    }
  } catch {
    // return empty map
  }
  return map;
}
