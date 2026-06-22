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
 * Persist:
 *   vpinState oturum boyunca sessionStorage'da ("qx_vpin_states") korunur.
 *   Bucket kapandığında yazılır (~5 dk'da bir üretimde). F5 sonrası sıfırdan
 *   bekleme süresi ortadan kalkar. seenIds/buffer persist edilmez.
 */

import { create } from "zustand";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
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
import { getDefaultConfig, type VpinState } from "@/lib/orderflow/vpin";

const VPIN_STORAGE_KEY = "qx_vpin_states";

function loadVpinFromStorage(): Partial<Record<Pair, VpinState>> {
  try {
    const raw = sessionStorage.getItem(VPIN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<Pair, VpinState>>;
    const result: Partial<Record<Pair, VpinState>> = {};
    for (const p of PAIRS) {
      const saved = parsed[p];
      if (!saved || !Array.isArray(saved.closedBuckets)) continue;
      // Config doğrulaması: bucketSizeUsd eşleşmeli — deploy'lar arası config
      // değişimi varsa eski bucket'lar geçersizleşir, temiz başla.
      if (saved.config?.bucketSizeUsd !== getDefaultConfig(p).bucketSizeUsd) continue;
      result[p] = saved;
    }
    return result;
  } catch (err) {
    console.warn("[vpin-persist] sessionStorage okuma hatası:", err);
    return {};
  }
}

function saveVpinToStorage(feeds: Record<Pair, PairFeedState>): void {
  try {
    const toSave: Partial<Record<Pair, VpinState>> = {};
    for (const p of PAIRS) {
      if (feeds[p]) toSave[p] = feeds[p].vpinState;
    }
    sessionStorage.setItem(VPIN_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn("[vpin-persist] sessionStorage yazma hatası:", err);
  }
}

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
  const saved = typeof window !== "undefined" ? loadVpinFromStorage() : {};
  const feeds: Partial<Record<Pair, PairFeedState>> = {};
  for (const p of PAIRS) {
    const feed = createPairFeedState(p);
    feeds[p] = saved[p] ? { ...feed, vpinState: saved[p]! } : feed;
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
    // Yeni bucket kapandıysa sessionStorage'a yaz
    if (next.vpinState.closedBuckets.length > current.vpinState.closedBuckets.length) {
      saveVpinToStorage(get().feeds);
    }
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

