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
import { useMarketStore } from "@/lib/store/marketStore";

// Dinamik bucket clamp sınırları
const BUCKET_MIN_USD = 100_000;      // $100K — tek trade'in gürültü yapmaması için
const BUCKET_MAX_USD = 300_000_000;  // $300M — bkz. DAILY_BUCKETS_TARGET notu

/**
 * Günde hedeflenen bucket sayısı — dolayısıyla dinamik bucket'ın divisor'ı
 * (bkz. computeDynamicBucketUsd: bucketUsd = vol24h / DAILY_BUCKETS_TARGET,
 * bu formülasyonda "vol24h / D" ifadesi TANIM GEREĞİ günde D bucket üretir).
 *
 * TARİHÇE (chat'te tartışıldı, bilinçli karar — bug düzeltmesi DEĞİL):
 * Burada önceden "/50" vardı. Bu bir kaza değildi — 50, klasik Easley et al.
 * VPIN metodolojisinin kendisi (günde 50 bucket × 50 bucket'lık pencere =
 * tam 1 günlük pencere; windowSize=50 bu yüzden 50, kaza değil, tutarlı bir
 * seçimdi — bkz. lib/orderflow/vpin.ts DEFAULT_VPIN_CONFIG/ETH_VPIN_CONFIG).
 * Asıl bug SADECE lib/ws/messages.ts'teki vol24h ölçek hatasıydı (coin-adedi,
 * USD değil) — o düzeltilince D=50 ile BTC bucket'ı ~$300-600M çıkar,
 * BUCKET_MAX_USD eski tavanına ($100M) yapışırdı.
 *
 * 500'e BİLİNÇLİ SAPMA — akademik sadakat değil, ürün kararı: Easley VPIN
 * E-mini S&P vadelilerinde GÜNLÜK ölçekte toksik akış ölçmek için tasarlandı.
 * Bu sistem 1H ana + 4H teyit mimarisiyle çalışıyor, kararlar 15dk-1sa
 * pencerelerinde değerlendiriliyor — 1 günlük pencereli bir VPIN rozetesi
 * gün boyu neredeyse hiç değişmez, /karar'da bakan trader için bilgi
 * taşımaz. D=500 → 50 bucket'lık pencere = günün 1/10'u = 2.4 saat, bu
 * ürünün karar ufkuyla örtüşüyor (ve vpin.ts'in kendi DEFAULT_VPIN_CONFIG
 * yorumundaki "2-3 saat"/"400-1000 bucket/gün" hedefiyle de uyumlu). VPIN
 * computeScore()'a girmiyor (doğrulandı, grep) — bu saf bir "kullanıcıya ne
 * göstermek faydalı" kararı, GO/WAIT/NO kararını etkilemiyor.
 *
 * BTC için kaba doğrulama: vol24h ~$20-50B/gün (vpin.ts'in kendi tahmini,
 * ölçülmedi) ise dinamik bucket $40M-$100M çıkar — statik fallback $50M'i
 * kapsıyor. BUCKET_MAX_USD $100M'den $300M'e yükseltildi çünkü D=500 ile
 * BTC'nin üst-normal ucu ($50B/500=$100M) eski tavana zaten değiyordu —
 * kriz-günü payı için gevşetildi.
 */
const DAILY_BUCKETS_TARGET = 500;

/**
 * Pair'in anlık vol24h'ından dinamik bucket boyutu hesapla.
 * vol24h yoksa null döner → getDefaultConfig(pair) fallback kullanılır.
 */
function computeDynamicBucketUsd(pair: Pair): number | null {
  const vol24h = useMarketStore.getState().prices[pair]?.vol24h;
  if (!vol24h || vol24h <= 0) return null;
  return Math.max(BUCKET_MIN_USD, Math.min(BUCKET_MAX_USD, vol24h / DAILY_BUCKETS_TARGET));
}

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

    // Dinamik bucket: yalnızca tamamen boş VPIN state'inde seçilir.
    // Koşul: hiç bucket kapanmamış VE mevcut bucket henüz trade almamış.
    // → Bucket dolmaya başladıktan sonra config kilitlenir, değişmez.
    // → SessionStorage'dan restore edilen state (closedBuckets.length > 0):
    //   bu blok hiç çalışmaz, restore edilen config aynen kullanılır.
    let feedToIngest = current;
    if (
      current.vpinState.closedBuckets.length === 0 &&
      current.vpinState.currentBucket.totalVolumeUsd === 0
    ) {
      const dynamicSize = computeDynamicBucketUsd(pair);
      if (dynamicSize !== null && dynamicSize !== current.vpinState.config.bucketSizeUsd) {
        feedToIngest = {
          ...current,
          vpinState: {
            ...current.vpinState,
            config: { ...current.vpinState.config, bucketSizeUsd: dynamicSize },
          },
        };
      }
    }

    const next = ingestTrades(feedToIngest, raws, now);
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

