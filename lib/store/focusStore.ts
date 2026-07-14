/**
 * FOCUS STORE — Karar sayfasından grafik sayfasına "odaklan" navigasyonu.
 *
 * Bir pozisyon satırındaki "→ Chart" butonuna basıldığında set edilir,
 * /grafik sayfası bunu okuyup War Room overlay'ini aktive eder.
 */

import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";

interface FocusStoreState {
  activeFocusPair: Pair | null;
  isOverlayActive: boolean;

  setFocus: (pair: Pair) => void;
  clearFocus: () => void;
}

export const useFocusStore = create<FocusStoreState>((set) => ({
  activeFocusPair: null,
  isOverlayActive: false,

  setFocus: (pair) => set({ activeFocusPair: pair, isOverlayActive: true }),

  clearFocus: () => set({ activeFocusPair: null, isOverlayActive: false }),
}));
