/**
 * STOCK TICKER STORE — AAPL/NVDA/TSLA snapshot'ı (TickerTape'in "küresel
 * makro" şeridi için, bkz. useMarketExtrasPoller). Salt kozmetik —
 * equityIndexStore'un aksine skor motoruna GİRMİYOR, lib/score/*'a hiç
 * bağlı değil.
 *
 * useMarketExtrasPoller doldurur — bu store saf state, hiç fetch yapmaz.
 */

import { create } from "zustand";

export type StockSymbol = "aapl" | "nvda" | "tsla";

export interface StockSnapshot {
  /** Yahoo'nun zaten formatladığı fiyat string'i (örn. "212.45") */
  price: string;
  changePct: number | null;
  updatedAt: number;
}

interface StockTickerStoreState {
  aapl: StockSnapshot | null;
  nvda: StockSnapshot | null;
  tsla: StockSnapshot | null;

  setStock: (key: StockSymbol, snap: StockSnapshot) => void;
}

export const useStockTickerStore = create<StockTickerStoreState>((set) => ({
  aapl: null,
  nvda: null,
  tsla: null,

  setStock: (key, snap) => set({ [key]: snap }),
}));
