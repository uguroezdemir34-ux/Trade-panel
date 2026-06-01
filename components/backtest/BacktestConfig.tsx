"use client";

import { useState } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";
import type { BacktestConfig } from "@/lib/backtest/types";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  onRun: (config: BacktestConfig) => void;
  disabled: boolean;
}

export function BacktestConfigPanel({ onRun, disabled }: Props): React.ReactElement {
  const t = useT();
  const [pair, setPair] = useState<Pair>("BTC");
  const [dataMonths, setDataMonths] = useState<6 | 12>(6);
  const [frozenFg, setFrozenFg] = useState(50);

  return (
    <div className="border-border bg-surface rounded-lg border p-4 flex flex-col gap-4">
      <h2 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("backtest.configTitle")}
      </h2>

      {/* Pair selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-text-t3 font-mono text-xs tracking-wider">
          {t("backtest.pair")}
        </label>
        <select
          value={pair}
          onChange={(e: { target: HTMLSelectElement }) => setPair(e.target.value as Pair)}
          disabled={disabled}
          className="border-border bg-bg text-text-t1 font-mono text-sm rounded border px-2 py-1.5 focus:outline-none focus:border-brand"
        >
          {PAIRS.map((p) => (
            <option key={p} value={p}>
              {p}/USDT
            </option>
          ))}
        </select>
      </div>

      {/* Data range */}
      <div className="flex flex-col gap-1.5">
        <label className="text-text-t3 font-mono text-xs tracking-wider">
          {t("backtest.dataRange")}
        </label>
        <div className="flex gap-2">
          {([6, 12] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDataMonths(m)}
              disabled={disabled}
              className={[
                "flex-1 rounded border font-mono text-xs py-1.5 transition-colors",
                dataMonths === m
                  ? "border-brand text-brand bg-brand/10"
                  : "border-border text-text-t3 hover:text-text-t2",
              ].join(" ")}
            >
              {m} {t("backtest.months")}
            </button>
          ))}
        </div>
      </div>

      {/* Fear & Greed frozen value */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-text-t3 font-mono text-xs tracking-wider">
            {t("backtest.frozenFg")}
          </label>
          <span className="text-text-t1 font-mono text-xs tabular-nums">{frozenFg}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={frozenFg}
          onChange={(e: { target: HTMLInputElement }) => setFrozenFg(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-brand"
        />
        <div className="flex justify-between text-text-t4 font-mono text-2xs">
          <span>{t("backtest.fgExtremeFear")}</span>
          <span>{t("backtest.fgNeutral")}</span>
          <span>{t("backtest.fgExtremeGreed")}</span>
        </div>
      </div>

      <button
        onClick={() => onRun({ pair, dataMonths, frozenFg })}
        disabled={disabled}
        className={[
          "w-full rounded font-mono text-sm font-semibold py-2.5 transition-colors",
          disabled
            ? "bg-border text-text-t4 cursor-not-allowed"
            : "bg-brand text-white hover:opacity-90 active:opacity-80",
        ].join(" ")}
      >
        {disabled ? t("backtest.running") : t("backtest.runButton")}
      </button>
    </div>
  );
}
