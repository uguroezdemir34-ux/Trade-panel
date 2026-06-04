/**
 * STAT-ARB STORE — İstatistiksel Arbitraj UI Durumu.
 *
 * Executor class instance'ı React ref'te tutulur (store'da değil).
 * Bu store executor durumunu ve UI seçimlerini senkronize eder.
 */

import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import type { StatArbConfig } from "@/lib/indicators/stat-arb";
import type { StatArbState, StatArbPosition } from "@/lib/exchange/stat-arb-executor";

export interface ZScorePoint {
  timestamp: number;
  zScore: number;
  spread: number;
}

interface StatArbStoreState {
  /** Seçili çift */
  pairA: Pair;
  pairB: Pair;

  /** Kullanıcı konfigürasyonu */
  config: Required<StatArbConfig>;

  /** Executor'dan senkronize edilen durum */
  executorState: StatArbState;
  position: StatArbPosition | null;

  /** Canlı z-score geçmişi (son 200 nokta) */
  zScoreHistory: ZScorePoint[];

  /** Hesaplanan hedge ratio (OLS) */
  hedgeRatio: number | null;

  /** Çift korelasyonu */
  correlation: number | null;

  /** Son z-score */
  currentZScore: number | null;

  /** Actions */
  setPairA: (p: Pair) => void;
  setPairB: (p: Pair) => void;
  setConfig: (c: Partial<Required<StatArbConfig>>) => void;
  setExecutorState: (s: StatArbState) => void;
  setPosition: (p: StatArbPosition | null) => void;
  pushZScore: (point: ZScorePoint) => void;
  setHedgeRatio: (r: number | null) => void;
  setCorrelation: (r: number | null) => void;
  setCurrentZScore: (z: number | null) => void;
  resetHistory: () => void;
}

export const useStatArbStore = create<StatArbStoreState>((set) => ({
  pairA: "BTC",
  pairB: "ETH",

  config: {
    window: 30,
    hedgeRatio: 1.0,
    entryThreshold: 2.5,
    exitThreshold: 0.5,
    emergencyThreshold: 4.0,
  },

  executorState: "flat",
  position: null,

  zScoreHistory: [],
  hedgeRatio: null,
  correlation: null,
  currentZScore: null,

  setPairA: (pairA) => set({ pairA }),
  setPairB: (pairB) => set({ pairB }),

  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  setExecutorState: (executorState) => set({ executorState }),
  setPosition: (position) => set({ position }),

  pushZScore: (point) =>
    set((s) => ({
      zScoreHistory: [...s.zScoreHistory.slice(-199), point],
      currentZScore: point.zScore,
    })),

  setHedgeRatio: (hedgeRatio) => set({ hedgeRatio }),
  setCorrelation: (correlation) => set({ correlation }),
  setCurrentZScore: (currentZScore) => set({ currentZScore }),

  resetHistory: () =>
    set({ zScoreHistory: [], currentZScore: null, hedgeRatio: null, correlation: null }),
}));
