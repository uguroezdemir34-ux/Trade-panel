/**
 * BACKTEST STORE — Single-pair backtest + multi-pair scan state.
 */

import { create } from "zustand";
import type { BacktestConfig, BacktestResult } from "@/lib/backtest/types";
import type { Pair } from "@/lib/constants/pairs";

// ── Single-pair run ────────────────────────────────────────────────────────

export type BacktestStatus = "idle" | "downloading" | "computing" | "done" | "error";

// ── Multi-pair scan ────────────────────────────────────────────────────────

export type ScanStatus = "idle" | "scanning" | "done" | "error";

export interface ScanRow {
  pair: Pair;
  totalTrades: number;
  winRate: number;
  avgR: number | null;
  maxDrawdownR: number;
  longWinRate: number | null;
  shortWinRate: number | null;
  /** winRate/100 × avgR — primary sort key */
  ev: number | null;
  status: "done" | "error";
  errorMsg?: string;
}

export interface ScanConfig {
  dataMonths: 6 | 12;
  frozenFg: number;
}

// ── Combined store ─────────────────────────────────────────────────────────

interface BacktestStoreState {
  // Single-pair
  status: BacktestStatus;
  downloadPct: number;
  computePct: number;
  currentPair: Pair | null;
  result: BacktestResult | null;
  error: string | null;
  config: BacktestConfig | null;

  setStatus: (s: BacktestStatus) => void;
  setDownloadPct: (pct: number) => void;
  setComputePct: (pct: number) => void;
  setCurrentPair: (pair: Pair | null) => void;
  setResult: (result: BacktestResult, config: BacktestConfig) => void;
  setError: (msg: string) => void;
  reset: () => void;

  // Multi-pair scan
  scanStatus: ScanStatus;
  scanDone: number;
  scanTotal: number;
  scanCurrentPair: Pair | null;
  scanRows: ScanRow[];
  scanError: string | null;
  scanConfig: ScanConfig | null;

  setScanStatus: (s: ScanStatus) => void;
  setScanProgress: (done: number, total: number, current: Pair | null) => void;
  addScanRow: (row: ScanRow) => void;
  setScanError: (msg: string) => void;
  startScan: (config: ScanConfig) => void;
  resetScan: () => void;
}

export const useBacktestStore = create<BacktestStoreState>((set) => ({
  // Single-pair initial state
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

  // Multi-pair scan initial state
  scanStatus: "idle",
  scanDone: 0,
  scanTotal: 0,
  scanCurrentPair: null,
  scanRows: [],
  scanError: null,
  scanConfig: null,

  setScanStatus: (s) => set({ scanStatus: s }),
  setScanProgress: (done, total, current) =>
    set({ scanDone: done, scanTotal: total, scanCurrentPair: current }),
  addScanRow: (row) => set((s) => ({ scanRows: [...s.scanRows, row] })),
  setScanError: (msg) => set({ scanStatus: "error", scanError: msg }),
  startScan: (config: ScanConfig) =>
    set({
      scanStatus: "scanning",
      scanDone: 0,
      scanTotal: 0,
      scanCurrentPair: null,
      scanRows: [],
      scanError: null,
      scanConfig: config,
    }),
  resetScan: () =>
    set({
      scanStatus: "idle",
      scanDone: 0,
      scanTotal: 0,
      scanCurrentPair: null,
      scanRows: [],
      scanError: null,
      scanConfig: null,
    }),
}));
