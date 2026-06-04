/**
 * ORDER BOOK STORE — Çift bazında anlık order book snapshot'ı tutar.
 * Persist edilmez — useOrderbookPoller her 500ms'de günceller.
 */

import { create } from "zustand";
import type { OrderBookSnapshot } from "@/lib/orderflow/orderbook";
import type { Pair } from "@/lib/constants/pairs";

interface OBStoreState {
  snapshots: Partial<Record<string, OrderBookSnapshot>>;
  updateSnapshot: (pair: Pair, snap: OrderBookSnapshot) => void;
  getSnapshot: (pair: Pair) => OrderBookSnapshot | null;
}

export const useOrderbookStore = create<OBStoreState>((set, get) => ({
  snapshots: {},

  updateSnapshot: (pair, snap) => {
    set((s) => ({ snapshots: { ...s.snapshots, [pair]: snap } }));
  },

  getSnapshot: (pair) => get().snapshots[pair] ?? null,
}));
