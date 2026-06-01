/**
 * BACKTEST STORE — Single-pair backtest + multi-pair scan state.
 */

import { create } from "zustand";
import type { BacktestConfig, BacktestResult } from "@/lib/backtest/types";
import type { Pair } from "@/lib/constants/pairs";
import { saveBtCache, loadBtCache, clearBtCache } from "@/lib/persistence/backtestCache";

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
  sharpe: number | null;
  status: "done" | "error";
  errorMsg?: string;
}

export interface ScanConfig {
  dataMonths: 6 | 12;
  frozenFg: number;
  minScore?: number;
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

  // Shared
  /** Epoch ms when results were last saved to localStorage. null = not saved yet. */
  savedAt: number | null;
  clearCache: () => void;

  // Compare pin
  pinnedResult: BacktestResult | null;
  pinnedConfig: BacktestConfig | null;
  pinForCompare: () => void;
  clearPin: () => void;
}

export const useBacktestStore = create<BacktestStoreState>((set, get) => {
  // Hydrate from localStorage on client (deferred so store is fully initialized first)
  if (typeof window !== "undefined") {
    setTimeout(() => {
      const cached = loadBtCache();
      if (!cached) return;
      if (cached.type === "single") {
        set({
          status: "done",
          result: cached.result,
          config: cached.config,
          savedAt: cached.savedAt,
        });
      } else {
        set({
          scanStatus: "done",
          scanRows: cached.scanRows,
          scanConfig: cached.scanConfig,
          savedAt: cached.savedAt,
        });
      }
    }, 0);
  }

  return {
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
    setResult: (result, config) => {
      const savedAt = Date.now();
      saveBtCache({ type: "single", result, config, savedAt });
      set({ status: "done", result, config, error: null, computePct: 1, savedAt });
    },
    setError: (msg) => set({ status: "error", error: msg }),
    reset: () => {
      clearBtCache();
      set({
        status: "idle",
        downloadPct: 0,
        computePct: 0,
        currentPair: null,
        result: null,
        error: null,
        config: null,
        savedAt: null,
      });
    },

    // Multi-pair scan initial state
    scanStatus: "idle",
    scanDone: 0,
    scanTotal: 0,
    scanCurrentPair: null,
    scanRows: [],
    scanError: null,
    scanConfig: null,

    setScanStatus: (s) => {
      set({ scanStatus: s });
      if (s === "done") {
        const { scanRows, scanConfig } = get();
        if (scanConfig && scanRows.length > 0) {
          const savedAt = Date.now();
          saveBtCache({ type: "scan", scanRows, scanConfig, savedAt });
          set({ savedAt });
        }
      }
    },
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
    resetScan: () => {
      clearBtCache();
      set({
        scanStatus: "idle",
        scanDone: 0,
        scanTotal: 0,
        scanCurrentPair: null,
        scanRows: [],
        scanError: null,
        scanConfig: null,
        savedAt: null,
      });
    },

    // Shared
    savedAt: null,
    clearCache: () => {
      clearBtCache();
      set({ savedAt: null });
    },

    // Compare pin
    pinnedResult: null,
    pinnedConfig: null,
    pinForCompare: () => {
      const { result, config } = get();
      if (result && config) set({ pinnedResult: result, pinnedConfig: config });
    },
    clearPin: () => set({ pinnedResult: null, pinnedConfig: null }),
  };
});
