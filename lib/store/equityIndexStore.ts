/**
 * EQUITY INDEX STORE — S&P500/Nasdaq/DXY proxy'leri (SPY/QQQ/UUP) için snapshot.
 *
 * marketStore.prices (Pair-keyed) ile karışmaz — bunlar Pair değil, skor
 * motoruna hiç girmeyen, salt görsel bağlam verisi. macroStore.ts'teki
 * flat-global-field deseniyle aynı (fgValue/btcD gibi tekil alanlar).
 *
 * useEquityIndexPoller doldurur — bu store saf state, hiç fetch yapmaz.
 */

import { create } from "zustand";

export type EquityIndexSymbol = "spy" | "qqq" | "uup";

export interface EquityIndexSnapshot {
  price: number;
  changePct: number | null;
  updatedAt: number;
}

interface EquityIndexStoreState {
  spy: EquityIndexSnapshot | null;
  qqq: EquityIndexSnapshot | null;
  uup: EquityIndexSnapshot | null;

  setIndex: (key: EquityIndexSymbol, snap: EquityIndexSnapshot) => void;
}

export const useEquityIndexStore = create<EquityIndexStoreState>((set) => ({
  spy: null,
  qqq: null,
  uup: null,

  setIndex: (key, snap) => set({ [key]: snap }),
}));
