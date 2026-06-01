/**
 * BACKTEST STORE — Backtest engine durumu.
 */

import { create } from "zustand";
import type { BacktestConfig, BacktestResult } from "@/lib/backtest/types";
import type { Pair } from "@/lib/constants/pairs";

export type BacktestStatus = "idle" | "downloading" | "computing" | "done" | "error";

interface BacktestStoreState {
  status: BacktestStatus;
  /** Download progress 0-1 */
  downloadPct: number;
  /** Compute progress 0-1 */
  computePct: number;
  /** Currently processing pair */
  currentPair: Pair | null;
  /** Last completed result */
  result: BacktestResult | null;
  /** Error message if status === "error" */
  error: string | null;
  /** Config that produced the current result */
  config: BacktestConfig | null;

  setStatus: (s: BacktestStatus) => void;
  setDownloadPct: (pct: number) => void;
  setComputePct: (pct: number) => void;
  setCurrentPair: (pair: Pair | null) => void;
  setResult: (result: BacktestResult, config: BacktestConfig) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useBacktestStore = create<BacktestStoreState>((set) => ({
  status: "idle",
  downloadPct: 0,
  computePct: 0,
  currentPair: null,
  result: null,
  error: null,
  config: null,

  setStatus: (s) => set({ status: s }),
  setDownloadPct: (pct) => set({ downloadPct: pct }),
  setComputePct: (pct) => set({ computePct: pct }),
  setCurrentPair: (pair) => set({ currentPair: pair }),
  setResult: (result, config) =>
    set({ status: "done", result, config, error: null, computePct: 1 }),
  setError: (msg) => set({ status: "error", error: msg }),
  reset: () =>
    set({
      status: "idle",
      downloadPct: 0,
      computePct: 0,
      currentPair: null,
      result: null,
      error: null,
      config: null,
    }),
}));
