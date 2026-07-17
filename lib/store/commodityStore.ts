/**
 * COMMODITY STORE — Altın/Gümüş/Brent snapshot'ı (TickerTape'in "küresel
 * makro" şeridi için, bkz. useCommodityPoller). Salt kozmetik — equityIndexStore'un
 * aksine skor motoruna GİRMİYOR, lib/score/*'a hiç bağlı değil.
 *
 * useCommodityPoller doldurur — bu store saf state, hiç fetch yapmaz.
 */

import { create } from "zustand";

export type CommoditySymbol = "gold" | "silver" | "brent";

export interface CommoditySnapshot {
  /** Yahoo'nun zaten formatladığı fiyat string'i (örn. "2,345.67") */
  price: string;
  changePct: number | null;
  updatedAt: number;
}

interface CommodityStoreState {
  gold: CommoditySnapshot | null;
  silver: CommoditySnapshot | null;
  brent: CommoditySnapshot | null;

  setCommodity: (key: CommoditySymbol, snap: CommoditySnapshot) => void;
}

export const useCommodityStore = create<CommodityStoreState>((set) => ({
  gold: null,
  silver: null,
  brent: null,

  setCommodity: (key, snap) => set({ [key]: snap }),
}));
