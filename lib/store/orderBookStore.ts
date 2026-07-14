/**
 * ORDER BOOK STORE — top-5 derinlik imbalance sonuçları (Anomali Işığı Faz 2).
 *
 * Ephemeral/canlı veri — localStorage persist yok (candleStore/marketStore
 * ile aynı sınıf: her sayfa yüklemesinde poller yeniden doldurur).
 */

import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import type { OrderBookImbalanceResult } from "@/lib/market/orderbook-imbalance";

interface OrderBookState {
  imbalance: Partial<Record<Pair, OrderBookImbalanceResult>>;
  setImbalance: (pair: Pair, result: OrderBookImbalanceResult | null) => void;
}

export const useOrderBookStore = create<OrderBookState>((set) => ({
  imbalance: {},
  setImbalance: (pair, result) =>
    set((state) => {
      if (!result) return state;
      return { imbalance: { ...state.imbalance, [pair]: result } };
    }),
}));
