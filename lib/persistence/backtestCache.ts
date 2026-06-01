import type { BacktestResult, BacktestConfig } from "@/lib/backtest/types";
import type { ScanRow, ScanConfig } from "@/lib/store/backtestStore";

const KEY = "quantix_bt_v1";

interface SingleCache {
  type: "single";
  result: BacktestResult;
  config: BacktestConfig;
  savedAt: number;
}

interface ScanCache {
  type: "scan";
  scanRows: ScanRow[];
  scanConfig: ScanConfig;
  savedAt: number;
}

export type BtCache = SingleCache | ScanCache;

export function saveBtCache(cache: BtCache): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage full or unavailable
  }
}

export function loadBtCache(): BtCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BtCache;
  } catch {
    return null;
  }
}

export function clearBtCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
