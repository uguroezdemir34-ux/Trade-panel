"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { useBacktest } from "@/lib/hooks/useBacktest";
import { BacktestConfigPanel } from "@/components/backtest/BacktestConfig";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";
import { BacktestResults } from "@/components/backtest/BacktestResults";
import { BacktestCompare } from "@/components/backtest/BacktestCompare";
import { MultiScanResults } from "@/components/backtest/MultiScanResults";
import { BacktestTemporalCard } from "@/components/backtest/BacktestTemporalCard";
import { ThresholdOptimizerCard } from "@/components/backtest/ThresholdOptimizerCard";
import { PatternDiscoveryCard } from "@/components/backtest/PatternDiscoveryCard";
import { WalkForwardCard } from "@/components/backtest/WalkForwardCard";
import { TemporalConsistencyCard } from "@/components/backtest/TemporalConsistencyCard";
import type { BacktestConfig } from "@/lib/backtest/types";
import type { ScanConfig } from "@/lib/store/backtestStore";

function BacktestPageInner() {
  const t = useT();
  const searchParams = useSearchParams();
  const pairParam = searchParams.get("pair")?.toUpperCase();
  const initialPair: Pair | undefined =
    pairParam && PAIRS.includes(pairParam as Pair) ? (pairParam as Pair) : undefined;

  const {
    run,
    runScan,
    // single-pair state
    status,
    downloadPct,
    computePct,
    result,
    config,
    error,
    reset,
    // scan state
    scanStatus,
    scanDone,
    scanTotal,
    scanCurrentPair,
    scanRows,
    scanConfig,
    resetScan,
    // persistence
    savedAt,
    clearCache,
    // compare
    pinnedResult,
    pinnedConfig,
    pinForCompare,
    clearPin,
  } = useBacktest();

  const isSingleRunning = status === "downloading" || status === "computing";
  const isScanRunning = scanStatus === "scanning";
  const isAnyRunning = isSingleRunning || isScanRunning;

  const showSingleResult = status === "done" && result !== null;
  const showScan = scanStatus === "scanning" || scanStatus === "done" || scanRows.length > 0;

  function handleRun(config: BacktestConfig) {
    resetScan();
    run(config);
  }

  function handleScan(config: ScanConfig) {
    reset();
    runScan(config);
  }

  function handleReset() {
    reset();
    resetScan();
  }

  function handleDrillDown(pair: string) {
    if (!scanConfig) return;
    reset(); // clear any previous single result
    run({
      pair: pair as import("@/lib/constants/pairs").Pair,
      dataMonths: scanConfig.dataMonths,
      frozenFg: scanConfig.frozenFg,
      minScore: scanConfig.minScore,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-text-t1 font-mono text-base font-semibold tracking-wider">
          🔬 {t("backtest.title")}
        </h1>
        {(showSingleResult || showScan) && !isAnyRunning && (
          <button
            onClick={handleReset}
            className="text-text-t3 font-mono text-xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors"
          >
            {t("backtest.reset")}
          </button>
        )}
      </div>

      {/* Restored-from-cache banner */}
      {savedAt !== null && !isAnyRunning && (
        <div className="flex items-center justify-between rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2">
          <span className="font-mono text-xs text-amber-400/80">
            📂 {t("backtest.restoredBanner")} · {relativeTime(savedAt)} {t("backtest.restoredAgo")}
          </span>
          <button
            onClick={clearCache}
            className="font-mono text-xs text-text-t4 hover:text-text-t2 transition-colors"
          >
            {t("backtest.clearCache")}
          </button>
        </div>
      )}

      {/* Config — visible when idle or only scan is showing */}
      {!isSingleRunning && !showSingleResult && (
        <BacktestConfigPanel
          onRun={handleRun}
          onScan={handleScan}
          disabled={isAnyRunning}
          initialPair={initialPair}
        />
      )}

      {/* Single-pair progress */}
      {isSingleRunning && (
        <div className="border-border bg-surface rounded-lg border p-4 flex flex-col gap-4">
          <h2 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
            {status === "downloading" ? t("backtest.downloading") : t("backtest.computing")}
          </h2>
          <ProgressBar
            label={t("backtest.downloading")}
            pct={downloadPct}
            done={status === "computing" || status === "done"}
          />
          <ProgressBar
            label={t("backtest.computing")}
            pct={computePct}
            done={status === "done"}
            inactive={status === "downloading"}
          />
          <p className="text-text-t4 font-mono text-xs">
            {status === "downloading" ? t("backtest.downloadHint") : t("backtest.computeHint")}
          </p>
        </div>
      )}

      {/* Single-pair error */}
      {status === "error" && error && (
        <div className="border border-red-500/40 bg-red-500/5 rounded-lg p-4">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      {/* Single-pair result */}
      {showSingleResult && pinnedResult && pinnedConfig && config ? (
        <BacktestCompare
          resultA={pinnedResult}
          configA={pinnedConfig}
          resultB={result!}
          configB={config}
          onClear={clearPin}
        />
      ) : showSingleResult ? (
        <>
          <BacktestResults
            result={result!}
            onPin={pinForCompare}
            isPinned={pinnedResult?.runAt === result?.runAt}
          />
          <BacktestTemporalCard trades={result!.trades} />
          <ThresholdOptimizerCard
            result={result!}
            currentThreshold={config?.minScore ?? 70}
          />
          <PatternDiscoveryCard result={result!} />
          <TemporalConsistencyCard result={result!} />
          <WalkForwardCard result={result!} />
        </>
      ) : null}

      {/* Multi-pair scan (can show alongside config) */}
      {showScan && (
        <MultiScanResults
          rows={scanRows}
          scanDone={scanDone}
          scanTotal={scanTotal}
          scanCurrentPair={scanCurrentPair}
          config={scanConfig}
          status={scanStatus === "idle" ? "done" : scanStatus}
          onSelectPair={scanConfig && scanStatus === "done" ? handleDrillDown : undefined}
        />
      )}
    </div>
  );
}

export default function BacktestPage() {
  return (
    <SubscriptionGate feature="backtest">
      <Suspense fallback={null}>
        <BacktestPageInner />
      </Suspense>
    </SubscriptionGate>
  );
}

function relativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function ProgressBar({
  label,
  pct,
  done,
  inactive,
}: {
  label: string;
  pct: number;
  done?: boolean;
  inactive?: boolean;
}): React.ReactElement {
  const displayPct = done ? 100 : Math.round(pct * 100);
  const color = done ? "bg-green-500" : inactive ? "bg-border" : "bg-brand";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className={`font-mono text-xs ${inactive ? "text-text-t4" : "text-text-t3"}`}>
          {label}
        </span>
        <span className={`font-mono text-xs tabular-nums ${inactive ? "text-text-t4" : "text-text-t2"}`}>
          {displayPct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
    </div>
  );
}
