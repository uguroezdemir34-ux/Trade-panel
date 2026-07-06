/**
 * OKX Datafeed — TradingView Advanced Charts IDatafeedChartApi implementation.
 *
 * Usage:
 *   import { createOkxDatafeed } from "@/lib/datafeed";
 *   const widget = new TradingView.widget({ datafeed: createOkxDatafeed(), ... });
 *
 * getBars strategy:
 *   Paginates backward from `periodParams.to` using OKX history-candles cursor
 *   (`after` param). Stops when the oldest fetched bar reaches `from`, or the
 *   page is empty. This avoids paging from "now" all the way back for deep history.
 *
 * Rate limit: 1 page / 300ms. OKX public limit ~20 req/2s — safe with margin.
 */

import { parseCandleResponse } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";
import type {
  IDatafeedChartApi,
  DatafeedConfiguration,
  LibrarySymbolInfo,
  Bar,
  PeriodParams,
  HistoryCallback,
  DatafeedErrorCallback,
  ResolveCallback,
  OnReadyCallback,
  SearchSymbolResultItem,
  ResolutionString,
} from "./types";
import { SUPPORTED_RESOLUTIONS, toOkxBar, toTimeframe } from "./resolution";
import { parsePair, buildSymbolInfo, buildSearchResults } from "./symbolInfo";
import { subscribeToCandles, unsubscribeFromCandles } from "./liveUpdates";

// ─── History fetch (getBars) ──────────────────────────────────────────────────

const HISTORY_PATH = "/api/okx/api/v5/market/history-candles";
const PAGE_LIMIT = 100;
const THROTTLE_MS = 300;
const MAX_PAGES = 25;

async function fetchHistoryPage(
  instId: string,
  okxBar: string,
  afterMs?: number,
): Promise<ReturnType<typeof parseCandleResponse>> {
  let url = `${HISTORY_PATH}?instId=${encodeURIComponent(instId)}&bar=${okxBar}&limit=${PAGE_LIMIT}`;
  if (afterMs !== undefined) url += `&after=${afterMs}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, unknown>;
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

async function fetchBarsRange(
  pair: string,
  resolution: ResolutionString,
  fromMs: number,
  toMs: number,
): Promise<Bar[]> {
  const okxBarStr = toOkxBar(resolution);
  if (!okxBarStr) return [];

  const instId = `${pair}-USDT-SWAP`;
  const accumulated: Bar[] = [];
  // Start just past `to` so OKX returns candles at or before `to`
  let afterCursor = toMs + 1;
  const seen = new Set<number>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const candles = await fetchHistoryPage(instId, okxBarStr, afterCursor);
    if (!candles || candles.length === 0) break;

    // parseCandleResponse returns ascending order; oldest is candles[0]
    const oldest = candles[0].ts;

    for (const c of candles) {
      if (c.ts < fromMs || c.ts > toMs) continue;
      if (seen.has(c.ts)) continue;
      seen.add(c.ts);
      accumulated.push({
        time: c.ts,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    }

    // Reached the beginning of the requested range
    if (oldest <= fromMs) break;

    // Next page: fetch candles older than the oldest bar we've seen
    afterCursor = oldest;
    await new Promise<void>((r) => setTimeout(r, THROTTLE_MS));
  }

  return accumulated.sort((a, b) => a.time - b.time);
}

// ─── Datafeed factory ────────────────────────────────────────────────────────

const DATAFEED_CONFIG: DatafeedConfiguration = {
  supported_resolutions: SUPPORTED_RESOLUTIONS,
  exchanges: [{ value: "OKX", name: "OKX", desc: "OKX Perpetual Futures" }],
  symbols_types: [{ name: "Crypto Perpetual", value: "crypto" }],
};

export function createOkxDatafeed(): IDatafeedChartApi {
  return {
    onReady(callback: OnReadyCallback): void {
      // TV requires async callback (setTimeout 0)
      setTimeout(() => callback(DATAFEED_CONFIG), 0);
    },

    searchSymbols(
      userInput: string,
      _exchange: string,
      _symbolType: string,
      onResult: (items: SearchSymbolResultItem[]) => void,
    ): void {
      onResult(buildSearchResults(userInput));
    },

    resolveSymbol(
      symbolName: string,
      onResolve: ResolveCallback,
      onError: DatafeedErrorCallback,
    ): void {
      const pair = parsePair(symbolName);
      if (!pair) {
        onError(`Unknown symbol: ${symbolName}`);
        return;
      }
      // TV requires async callback
      setTimeout(() => onResolve(buildSymbolInfo(pair as Pair)), 0);
    },

    getBars(
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      periodParams: PeriodParams,
      onResult: HistoryCallback,
      onError: DatafeedErrorCallback,
    ): void {
      const pair = parsePair(symbolInfo.name);
      if (!pair || !toTimeframe(resolution)) {
        onError(`Unsupported symbol or resolution: ${symbolInfo.name} @ ${resolution}`);
        return;
      }

      const fromMs = periodParams.from * 1000;
      const toMs = periodParams.to * 1000;

      fetchBarsRange(pair, resolution, fromMs, toMs)
        .then((bars) => {
          onResult(bars, { noData: bars.length === 0 });
        })
        .catch((err: unknown) => {
          onError(String(err));
        });
    },

    subscribeBars(
      symbolInfo: LibrarySymbolInfo,
      resolution: ResolutionString,
      onRealtimeCallback,
      subscriberUID: string,
    ): void {
      const pair = parsePair(symbolInfo.name);
      if (!pair) return;
      subscribeToCandles(subscriberUID, pair, resolution, onRealtimeCallback);
    },

    unsubscribeBars(subscriberUID: string): void {
      unsubscribeFromCandles(subscriberUID);
    },
  };
}
