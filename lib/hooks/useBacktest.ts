"use client";

/**
 * USEBACKTEST — Backtest orchestration hook.
 *
 * Flow:
 *   1. Check IndexedDB for 1h + 4h candles (stale if > 23h)
 *   2. If missing/stale: download via fetchHistoricalCandleRange, save to DB
 *   3. Run runBacktest engine with progress updates
 *   4. Write result to backtestStore
 */

import { useCallback } from "react";
import { getCandlesFromDb, saveCandlesToDb } from "@/lib/storage/candleDb";
import { fetchHistoricalCandleRange } from "@/lib/okx/historyCandles";
import { runBacktest } from "@/lib/backtest/engine";
import { useBacktestStore } from "@/lib/store/backtestStore";
import type { BacktestConfig } from "@/lib/backtest/types";

/** Candles older than 23h are considered stale and re-fetched */
const STALE_MS = 23 * 60 * 60 * 1000;

export function useBacktest() {
  const store = useBacktestStore();

  const run = useCallback(
    async (config: BacktestConfig) => {
      const { pair, dataMonths } = config;
      const fromMs = Date.now() - dataMonths * 30 * 24 * 60 * 60 * 1000;

      store.setStatus("downloading");
      store.setDownloadPct(0);
      store.setComputePct(0);
      store.setCurrentPair(pair);

      try {
        // ── 1h candles ──────────────────────────────────────────────
        let candles1h = await (async () => {
          const cached = await getCandlesFromDb(pair, "1h");
          if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
            return cached.candles.filter((c) => c.ts >= fromMs);
          }
          const fetched = await fetchHistoricalCandleRange(
            pair,
            "1h",
            fromMs,
            (done, est) => store.setDownloadPct(Math.min(0.45, done / est * 0.45)),
          );
          await saveCandlesToDb(pair, "1h", fetched);
          return fetched;
        })();

        // ── 4h candles ──────────────────────────────────────────────
        let candles4h = await (async () => {
          const cached = await getCandlesFromDb(pair, "4h");
          if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
            return cached.candles.filter((c) => c.ts >= fromMs);
          }
          const fetched = await fetchHistoricalCandleRange(
            pair,
            "4h",
            fromMs,
            (done, est) => store.setDownloadPct(0.45 + Math.min(0.45, done / est * 0.45)),
          );
          await saveCandlesToDb(pair, "4h", fetched);
          return fetched;
        })();

        store.setDownloadPct(1);
        store.setStatus("computing");

        const result = await runBacktest(candles1h, candles4h, config, (pct) => {
          store.setComputePct(pct);
        });

        store.setResult(result, config);
      } catch (err) {
        store.setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    },
    [store],
  );

  return { run, ...store };
}
