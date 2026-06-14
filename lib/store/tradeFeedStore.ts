/**
 * TRADE FEED STORE — Per-pair canlı trade akışı.
 *
 * Mimari:
 *   useTradeFeed() hook → OKX WS → onMessage → store.ingest(pair, raws)
 *
 * Throttling:
 *   Hook seviyesinde 100ms throttle (her tick'te store'a yazmıyoruz).
 *   Bu, render fırtınasını engeller. 100ms latency yeterli (insan algısı 200ms+).
 *
 * Persist edilmez — feed canlı veriden beslenir, restart sonrası tekrar dolar.
 */

import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import type {
  OkxTradeRaw,
  Trade,
  TradeRingBuffer,
} from "@/lib/orderflow/types";
import {
  createPairFeedState,
  ingestTrades,
  setConnectionState,
  getTrades,
  type PairFeedState,
  type FeedConnectionState,
} from "@/lib/orderflow/tradeFeed";

/** Desteklenen pair'ler. */
const PAIRS: readonly Pair[] = ["BTC", "ETH"];

interface TradeFeedStoreState {
  /** Pair başına state */
  feeds: Record<Pair, PairFeedState>;

  /** Yeni trade batch'i ingest et */
  ingest: (pair: Pair, raws: readonly OkxTradeRaw[], now?: number) => void;

  /** Connection state değiştir */
  setConnection: (
    pair: Pair,
    state: FeedConnectionState,
    error?: string,
  ) => void;

  /** Pair için trade'leri oku (selector friendly) */
  getTrades: (pair: Pair) => readonly Trade[];

  /** Pair için buffer oku */
  getBuffer: (pair: Pair) => TradeRingBuffer;

  /** Tüm pair'leri sıfırla (test için) */
  _reset: () => void;
}

function initialFeeds(): Record<Pair, PairFeedState> {
  const feeds: Partial<Record<Pair, PairFeedState>> = {};
  for (const p of PAIRS) {
    feeds[p] = createPairFeedState(p);
  }
  return feeds as Record<Pair, PairFeedState>;
}

// Sentinel değerler — feeds[pair] undefined olduğunda (BTC/ETH dışı paritelerde) güvenli fallback
const EMPTY_TRADES: readonly Trade[] = [];
const EMPTY_BUFFER: TradeRingBuffer = { capacity: 0, totalAdded: 0, items: [] };

export const useTradeFeedStore = create<TradeFeedStoreState>((set, get) => ({
  feeds: initialFeeds(),

  ingest: (pair, raws, now) => {
    const current = get().feeds[pair];
    if (!current) return;
    const next = ingestTrades(current, raws, now);
    set((s) => ({
      feeds: { ...s.feeds, [pair]: next },
    }));
  },

  setConnection: (pair, state, error) => {
    const current = get().feeds[pair];
    if (!current) return;
    const next = setConnectionState(current, state, error);
    set((s) => ({
      feeds: { ...s.feeds, [pair]: next },
    }));
  },

  getTrades: (pair) => {
    const feed = get().feeds[pair];
    return feed ? getTrades(feed) : EMPTY_TRADES;
  },

  getBuffer: (pair) => get().feeds[pair]?.buffer ?? EMPTY_BUFFER,

  _reset: () => {
    set({ feeds: initialFeeds() });
  },
}));

// ════════════════════ SELECTORS ════════════════════
// Re-render optimization için: store değişse de bu selector'ları
// useTradeFeedStore(selectXxx) ile kullan; sadece ilgili kısım değişince render.

export const selectFeed = (pair: Pair) =>
  (s: TradeFeedStoreState): PairFeedState | undefined =>
    s.feeds[pair];

export const selectTrades = (pair: Pair) =>
  (s: TradeFeedStoreState): readonly Trade[] =>
    s.feeds[pair]?.buffer?.items ?? EMPTY_TRADES;

export const selectConnectionState = (pair: Pair) =>
  (s: TradeFeedStoreState): FeedConnectionState =>
    s.feeds[pair]?.connectionState ?? "idle";

export const selectLastTrade = (pair: Pair) =>
  (s: TradeFeedStoreState): Trade | null => {
    const items = s.feeds[pair]?.buffer?.items;
    return items && items.length > 0 ? items[items.length - 1] : null;
  };
