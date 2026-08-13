/**
 * POSITION STORE — Açık pozisyon listesi state.
 *
 * Persist edilmez (OKX'ten her seferinde fetch edilir).
 */

import { create } from "zustand";
import type { Position } from "@/lib/okx/positions";

interface PositionStoreState {
  positions: Position[];
  lastFetchedAt: number;
  lastError: string;
  /** Şu an kapatılma sürecinde olan position instId (UI loading state için) */
  closingInstId: string | null;
  /** OKX pozisyon fetch son durum — accountStore.balanceFetchStatus ile AYNI desen. */
  positionFetchStatus: "idle" | "ok" | "error";
  /** OKX pozisyon fetch hata detayı — fetchPositions() şu an bir hata mesajı
   *  DÖNDÜRMÜYOR (her başarısızlıkta null), bu yüzden şimdilik hep null;
   *  alan yine de accountStore ile isimlendirme/şekil tutarlılığı için var. */
  positionFetchErrMsg: string | null;

  // Actions
  setPositions: (positions: Position[]) => void;
  setError: (err: string) => void;
  setPositionFetchError: (msg?: string) => void;
  removePosition: (instId: string) => void;
  setClosingInstId: (instId: string | null) => void;
  reset: () => void;
}

export const usePositionStore = create<PositionStoreState>((set) => ({
  positions: [],
  lastFetchedAt: 0,
  lastError: "",
  closingInstId: null,
  positionFetchStatus: "idle",
  positionFetchErrMsg: null,

  setPositions: (positions) =>
    set({
      positions,
      lastFetchedAt: Date.now(),
      lastError: "",
      positionFetchStatus: "ok",
      positionFetchErrMsg: null,
    }),

  setError: (err) => set({ lastError: err }),

  setPositionFetchError: (msg) => set({ positionFetchStatus: "error", positionFetchErrMsg: msg ?? null }),

  removePosition: (instId) =>
    set((s) => ({ positions: s.positions.filter((p) => p.instId !== instId) })),

  setClosingInstId: (instId) => set({ closingInstId: instId }),

  reset: () =>
    set({
      positions: [],
      lastFetchedAt: 0,
      lastError: "",
      closingInstId: null,
      positionFetchStatus: "idle",
      positionFetchErrMsg: null,
    }),
}));

// ═══════════════ SELECTOR'LAR ═══════════════

export const selectPositionByInstId =
  (instId: string) =>
  (s: PositionStoreState): Position | undefined =>
    s.positions.find((p) => p.instId === instId);

export const selectPositionsByPair =
  (pair: string) =>
  (s: PositionStoreState): Position[] =>
    s.positions.filter((p) => p.pair === pair);

export const selectHasOpenPositions = (s: PositionStoreState): boolean =>
  s.positions.length > 0;
