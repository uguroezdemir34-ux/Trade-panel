"use client";

import { useT } from "@/lib/i18n/context";
import { useBacktest } from "@/lib/hooks/useBacktest";
import { BacktestConfigPanel } from "@/components/backtest/BacktestConfig";
import { BacktestResults } from "@/components/backtest/BacktestResults";
import type { BacktestConfig } from "@/lib/backtest/types";

export default function BacktestPage() {
  const t = useT();
  const { run, status, downloadPct, computePct, result, error, reset } = useBacktest();

  const isRunning = status === "downloading" || status === "computing";

  function handleRun(config: BacktestConfig) {
    run(config);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-text-t1 font-mono text-base font-semibold tracking-wider">
          🔬 {t("backtest.title")}
        </h1>
        {(status === "done" || status === "error") && (
          <button
            onClick={reset}
            className="text-text-t3 font-mono text-xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors"
          >
            {t("backtest.reset")}
          </button>
        )}
      </div>

      {/* Config — always visible unless running */}
      {!isRunning && status !== "done" && (
        <BacktestConfigPanel onRun={handleRun} disabled={isRunning} />
      )}

      {/* Progress */}
      {isRunning && (
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
            {status === "downloading"
              ? t("backtest.downloadHint")
              : t("backtest.computeHint")}
          </p>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="border border-red-500/40 bg-red-500/5 rounded-lg p-4">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {status === "done" && result && <BacktestResults result={result} />}
    </div>
  );
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
