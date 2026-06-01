"use client";

/**
 * USEBACKTEST — Backtest orchestration hook.
 *
 * run(config)      — single pair backtest
 * runScan(config)  — all 15 pairs sequentially, streaming results to scanRows
 *
 * Data flow:
 *   1. Check IndexedDB for 1h + 4h candles (stale if > 23h)
 *   2. If missing/stale: download, save to DB
 *   3. Run runBacktest engine with progress callbacks
 */

import { useCallback } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { getCandlesFromDb, saveCandlesToDb } from "@/lib/storage/candleDb";
import { fetchHistoricalCandleRange } from "@/lib/okx/historyCandles";
import { runBacktest } from "@/lib/backtest/engine";
import { useBacktestStore } from "@/lib/store/backtestStore";
import type { BacktestConfig } from "@/lib/backtest/types";
import type { ScanConfig, ScanRow } from "@/lib/store/backtestStore";
import type { Pair } from "@/lib/constants/pairs";

const STALE_MS = 23 * 60 * 60 * 1000;

// ── Shared candle fetch (with IndexedDB cache) ────────────────────────────

async function fetchCandles(
  pair: Pair,
  tf: "1h" | "4h",
  fromMs: number,
  onProgress?: (pct: number) => void,
) {
  const cached = await getCandlesFromDb(pair, tf);
  if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
    onProgress?.(1);
    return cached.candles.filter((c) => c.ts >= fromMs);
  }
  const fetched = await fetchHistoricalCandleRange(pair, tf, fromMs, (done, est) => {
    onProgress?.(Math.min(0.99, est > 0 ? done / est : 0));
  });
  await saveCandlesToDb(pair, tf, fetched);
  onProgress?.(1);
  return fetched;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useBacktest() {
  const store = useBacktestStore();

  // ── Single-pair run ──────────────────────────────────────────────────────
  const run = useCallback(
    async (config: BacktestConfig) => {
      const { pair, dataMonths } = config;
      const fromMs = Date.now() - dataMonths * 30 * 24 * 60 * 60 * 1000;

      store.setStatus("downloading");
      store.setDownloadPct(0);
      store.setComputePct(0);
      store.setCurrentPair(pair);

      try {
        const candles1h = await fetchCandles(pair, "1h", fromMs, (p) =>
          store.setDownloadPct(p * 0.5),
        );
        const candles4h = await fetchCandles(pair, "4h", fromMs, (p) =>
          store.setDownloadPct(0.5 + p * 0.5),
        );

        store.setDownloadPct(1);
        store.setStatus("computing");

        const result = await runBacktest(candles1h, candles4h, config, (pct) =>
          store.setComputePct(pct),
        );

        store.setResult(result, config);
      } catch (err) {
        store.setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    },
    [store],
  );

  // ── Multi-pair scan ──────────────────────────────────────────────────────
  const runScan = useCallback(
    async (scanConfig: ScanConfig) => {
      const { dataMonths, frozenFg } = scanConfig;
      const fromMs = Date.now() - dataMonths * 30 * 24 * 60 * 60 * 1000;

      store.startScan(scanConfig);
      store.setScanProgress(0, PAIRS.length, PAIRS[0]);

      for (let i = 0; i < PAIRS.length; i++) {
        const pair = PAIRS[i];
        store.setScanProgress(i, PAIRS.length, pair);

        try {
          const candles1h = await fetchCandles(pair, "1h", fromMs);
          const candles4h = await fetchCandles(pair, "4h", fromMs);

          const result = await runBacktest(candles1h, candles4h, {
            pair,
            dataMonths,
            frozenFg,
          });

          const { stats } = result;
          const row: ScanRow = {
            pair,
            totalTrades: stats.totalTrades,
            winRate: stats.winRate,
            avgR: stats.avgRMultiple,
            maxDrawdownR: stats.maxDrawdownR,
            longWinRate: stats.byDirection.LONG.winRate,
            shortWinRate: stats.byDirection.SHORT.winRate,
            ev:
              stats.avgRMultiple !== null
                ? (stats.winRate / 100) * stats.avgRMultiple
                : null,
            status: "done",
          };
          store.addScanRow(row);
        } catch (err) {
          store.addScanRow({
            pair,
            totalTrades: 0,
            winRate: 0,
            avgR: null,
            maxDrawdownR: 0,
            longWinRate: null,
            shortWinRate: null,
            ev: null,
            status: "error",
            errorMsg: err instanceof Error ? err.message : "Error",
          });
        }
      }

      store.setScanProgress(PAIRS.length, PAIRS.length, null);
      store.setScanStatus("done");
    },
    [store],
  );

  return { run, runScan, ...store };
}
