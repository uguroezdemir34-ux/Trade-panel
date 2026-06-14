/**
 * MACRO STORE — Piyasa sekmesi için snapshot (F&G, dominance, funding, OI).
 *
 * 15 pair desteği: funding ve OI verileri artık Partial<Record<Pair, ...>> map'lerde.
 * Refresh stratejisi:
 *   - F&G: macro/cache layer (30dk TTL)
 *   - Dominance: macro/cache layer (30dk TTL)
 *   - Funding: 5dk TTL, tüm PAIRS
 *   - OI: 5dk TTL, tüm PAIRS (+ velocity snapshot geçmişi)
 *
 * OI Snapshot persist:
 *   oiSnapshots localStorage'a kaydedilir (quantix_oi_snaps_v1).
 *   Sayfa yenilemede önceki snapshot'lardan velocity anında hesaplanır.
 *   2 saatten eski snapshot'lar yükleme ve yazımda otomatik filtrelenir.
 */

import { create } from "zustand";
import { fetchFearGreed, fetchBtcDominance } from "@/lib/macro/fetch";
import {
  getFgInfo,
  getDominancePhase,
  getMarketSummary,
} from "@/lib/macro/regime";
import {
  fetchFundingRate,
  type FundingRateResult,
} from "@/lib/market/fundingRate";
import {
  fetchOpenInterest,
  type OpenInterestResult,
} from "@/lib/market/openInterest";
import {
  computeOiVelocityWindow,
  type OiSnapshot,
  type OiVelocityResult,
} from "@/lib/market/oi-velocity";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type {
  FgInfo,
  DominanceInfo,
  MarketSummary,
} from "@/lib/macro/types";

const FUNDING_TTL_MS = 5 * 60_000;
const OI_TTL_MS = 5 * 60_000;
const MAX_OI_HISTORY = 10;

// Bootstrap flag: ilk poll'dan sonra velocity hâlâ boşsa 30s'de tek seferlik
// TTL bypass fetch yapar. Sadece OI'yi etkiler — funding/F&G/dominance dokunulmaz.
let _oiBootstrapScheduled = false;

// ─── OI Snapshot Persist (scoreHistoryStore ile aynı pattern) ───
const OI_SNAPS_KEY = "quantix_oi_snaps_v1";
const OI_SNAP_MAX_AGE_MS = 2 * 60 * 60_000; // 2 saat

function loadOiSnapshots(): Partial<Record<Pair, OiSnapshot[]>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OI_SNAPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<Pair, OiSnapshot[]>>;
    const now = Date.now();
    const fresh: Partial<Record<Pair, OiSnapshot[]>> = {};
    for (const [pair, snaps] of Object.entries(parsed)) {
      if (!Array.isArray(snaps)) continue;
      const kept = snaps.filter((s) => now - s.timestamp < OI_SNAP_MAX_AGE_MS);
      if (kept.length > 0) fresh[pair as Pair] = kept;
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveOiSnapshots(snaps: Partial<Record<Pair, OiSnapshot[]>>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OI_SNAPS_KEY, JSON.stringify(snaps));
  } catch {
    // storage full — skip persist
  }
}

function appendOiSnapshot(
  history: OiSnapshot[] | undefined,
  oi: OpenInterestResult,
  price: number,
  ts: number,
): OiSnapshot[] {
  const prev = history ?? [];
  if (price <= 0) return prev;
  const oiVal = oi.oiCcy > 0 ? oi.oiCcy : oi.oi;
  if (oiVal <= 0) return prev;
  const snap: OiSnapshot = { timestamp: ts, openInterest: oiVal, price };
  return [...prev.slice(-(MAX_OI_HISTORY - 1)), snap];
}

interface MacroStoreState {
  // F&G (raw value + computed info)
  fgValue: number | null;
  fgInfo: FgInfo | null;
  fgFetchedAt: number;
  fgLoading: boolean;

  // Dominance (raw values + computed phase)
  btcD: number | null;
  usdtD: number | null;
  ethD: number | null;
  btcDChange24h: number | null;
  ethDChange24h: number | null;
  dominance: DominanceInfo | null;
  domFetchedAt: number;
  domLoading: boolean;

  // Funding — all pairs
  funding: Partial<Record<Pair, FundingRateResult>>;
  fundingFetchedAt: number;
  fundingLoading: boolean;

  // Open Interest — all pairs
  oi: Partial<Record<Pair, OpenInterestResult>>;
  oiFetchedAt: number;
  oiLoading: boolean;
  // OI snapshot history per pair (for velocity computation)
  oiSnapshots: Partial<Record<Pair, OiSnapshot[]>>;
  // Computed OI velocity per pair
  oiVelocity: Partial<Record<Pair, OiVelocityResult>>;

  // Computed: market summary
  marketSummary: MarketSummary | null;

  // Actions
  refreshFg: (fetchFn?: typeof fetch) => Promise<void>;
  refreshDominance: (fetchFn?: typeof fetch) => Promise<void>;
  refreshFunding: (fetchFn?: typeof fetch) => Promise<void>;
  refreshOpenInterest: (fetchFn?: typeof fetch) => Promise<void>;
  refreshAll: (fetchFn?: typeof fetch) => Promise<void>;

  // Test helper
  _reset: () => void;
}

/** F&G + USDT-D varsa market summary hesapla */
function recomputeSummary(
  fg: number | null,
  usdtD: number | null,
): MarketSummary | null {
  if (fg === null || usdtD === null) return null;
  return getMarketSummary(fg, usdtD);
}

const initialState = {
  fgValue: null,
  fgInfo: null,
  fgFetchedAt: 0,
  fgLoading: false,
  btcD: null,
  usdtD: null,
  ethD: null,
  btcDChange24h: null,
  ethDChange24h: null,
  dominance: null,
  domFetchedAt: 0,
  domLoading: false,
  funding: {} as Partial<Record<Pair, FundingRateResult>>,
  fundingFetchedAt: 0,
  fundingLoading: false,
  oi: {} as Partial<Record<Pair, OpenInterestResult>>,
  oiFetchedAt: 0,
  oiLoading: false,
  oiSnapshots: {} as Partial<Record<Pair, OiSnapshot[]>>,
  oiVelocity: {} as Partial<Record<Pair, OiVelocityResult>>,
  marketSummary: null,
};

export const useMacroStore = create<MacroStoreState>((set, get) => {
  // Hydrate oiSnapshots from localStorage on client (scoreHistoryStore pattern)
  if (typeof window !== "undefined") {
    setTimeout(() => {
      const loaded = loadOiSnapshots();
      if (Object.keys(loaded).length > 0) {
        set({ oiSnapshots: loaded });
      }
    }, 0);
  }

  return {
  ...initialState,

  refreshFg: async (fetchFn) => {
    if (get().fgLoading) return;
    set({ fgLoading: true });
    try {
      const now = Date.now();
      const r = await fetchFearGreed(now, fetchFn);
      const info = getFgInfo(r.value);
      const usdtD = get().usdtD;
      set({
        fgValue: r.value,
        fgInfo: info,
        fgFetchedAt: now,
        fgLoading: false,
        marketSummary: recomputeSummary(r.value, usdtD),
      });
    } catch {
      set({ fgLoading: false });
    }
  },

  refreshDominance: async (fetchFn) => {
    if (get().domLoading) return;
    set({ domLoading: true });
    try {
      const now = Date.now();
      const r = await fetchBtcDominance(now, fetchFn);
      const info = getDominancePhase(r.btcD, r.usdtD);
      const fgValue = get().fgValue;
      set({
        btcD: r.btcD,
        usdtD: r.usdtD,
        ethD: r.ethD,
        btcDChange24h: r.btcDChange24h,
        ethDChange24h: r.ethDChange24h,
        dominance: info,
        domFetchedAt: now,
        domLoading: false,
        marketSummary: recomputeSummary(fgValue, r.usdtD),
      });
    } catch {
      set({ domLoading: false });
    }
  },

  refreshFunding: async (fetchFn) => {
    if (get().fundingLoading) return;
    const now = Date.now();
    if (now - get().fundingFetchedAt < FUNDING_TTL_MS) return;

    set({ fundingLoading: true });
    try {
      const results = await Promise.all(
        PAIRS.map((pair) => fetchFundingRate(pair, fetchFn).then((r) => [pair, r] as const)),
      );
      const funding: Partial<Record<Pair, FundingRateResult>> = {};
      for (const [pair, result] of results) {
        funding[pair] = result;
      }
      set({ funding, fundingFetchedAt: now, fundingLoading: false });
    } catch {
      set({ fundingLoading: false });
    }
  },

  refreshOpenInterest: async (fetchFn) => {
    if (get().oiLoading) return;
    const now = Date.now();
    if (now - get().oiFetchedAt < OI_TTL_MS) return;

    set({ oiLoading: true });
    try {
      const results = await Promise.all(
        PAIRS.map((pair) => fetchOpenInterest(pair, fetchFn).then((r) => [pair, r] as const)),
      );

      const { prices, lastKnownGood } = useMarketStore.getState();
      const prevSnapshots = get().oiSnapshots;

      const newOi: Partial<Record<Pair, OpenInterestResult>> = {};
      const newSnapshots: Partial<Record<Pair, OiSnapshot[]>> = { ...prevSnapshots };
      const newVelocity: Partial<Record<Pair, OiVelocityResult>> = {};

      for (const [pair, oiResult] of results) {
        newOi[pair] = oiResult;
        let price = prices[pair]?.last ?? 0;
        if (price <= 0) {
          // WS henüz bağlanmadıysa lastKnownGood'dan fallback (max 30 dk)
          const lkg = lastKnownGood[pair];
          if (lkg && now - lkg.cachedAt < 30 * 60_000) {
            price = lkg.tick.last;
          }
        }
        const snaps = appendOiSnapshot(prevSnapshots[pair], oiResult, price, now);
        newSnapshots[pair] = snaps;
        const vel = computeOiVelocityWindow(snaps, pair, 5);
        if (vel) newVelocity[pair] = vel;
      }

      set({
        oi: newOi,
        oiFetchedAt: now,
        oiLoading: false,
        oiSnapshots: newSnapshots,
        oiVelocity: newVelocity,
      });
      // Persist snapshots so velocity is available immediately on next page load
      saveOiSnapshots(newSnapshots);

      // Bootstrap: yeni kullanıcı veya localStorage temizlendiyse ilk poll'dan
      // sonra velocity hâlâ boşsa 30sn'de tek seferlik TTL-bypass re-fetch yap.
      // Diğer macro poller'lara (funding/F&G/dom) dokunmaz.
      if (!_oiBootstrapScheduled && Object.keys(newVelocity).length === 0) {
        _oiBootstrapScheduled = true;
        setTimeout(() => {
          set({ oiFetchedAt: 0 }); // sadece OI TTL'yi sıfırla
          void get().refreshOpenInterest();
        }, 30_000);
      }
    } catch {
      set({ oiLoading: false });
    }
  },

  refreshAll: async (fetchFn) => {
    await Promise.all([
      get().refreshFg(fetchFn),
      get().refreshDominance(fetchFn),
      get().refreshFunding(fetchFn),
      get().refreshOpenInterest(fetchFn),
    ]);
  },

  _reset: () => set(initialState),
  };
});
