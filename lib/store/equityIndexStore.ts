/**
 * EQUITY INDEX STORE — S&P500/Nasdaq/DXY/Dow proxy'leri (SPY/QQQ/UUP/DIA) için snapshot.
 *
 * marketStore.prices (Pair-keyed) ile karışmaz — bunlar Pair değil, salt
 * görsel bağlam verisi olarak başladı; spy/qqq/uup artık useScoreEngine.ts
 * üzerinden skor motoruna da giriyor (composeScoreInput → sp500ChangePct/
 * nasdaqChangePct/dxyChangePct). macroStore.ts'teki flat-global-field
 * deseniyle aynı (fgValue/btcD gibi tekil alanlar).
 *
 * useEquityIndexPoller doldurur — bu store saf state, hiç fetch yapmaz.
 */

import { create } from "zustand";

export type EquityIndexSymbol = "spy" | "qqq" | "uup" | "dow";

export interface EquityIndexSnapshot {
  price: number;
  changePct: number | null;
  updatedAt: number;
}

interface EquityIndexStoreState {
  spy: EquityIndexSnapshot | null;
  qqq: EquityIndexSnapshot | null;
  uup: EquityIndexSnapshot | null;
  dow: EquityIndexSnapshot | null;

  setIndex: (key: EquityIndexSymbol, snap: EquityIndexSnapshot) => void;
}

export const useEquityIndexStore = create<EquityIndexStoreState>((set) => ({
  spy: null,
  qqq: null,
  uup: null,
  dow: null,

  setIndex: (key, snap) => set({ [key]: snap }),
}));
