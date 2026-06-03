"use client";

import { useT } from "@/lib/i18n/context";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { DEFAULT_SCORER_WEIGHTS, type ScorerWeights } from "@/lib/score/orchestrator";

type WeightKey = keyof ScorerWeights;

const WEIGHT_KEYS: WeightKey[] = ["trend", "adx", "rsi", "vol", "bb", "vwap", "funding", "macro"];

export function ScorerWeightsCard(): React.ReactElement {
  const t = useT();
  const stored = useSettingsStore((s) => s.scorerWeights);
  const setScorerWeights = useSettingsStore((s) => s.setScorerWeights);

  const weights: ScorerWeights = stored
    ? { ...DEFAULT_SCORER_WEIGHTS, ...(stored as Partial<ScorerWeights>) }
    : { ...DEFAULT_SCORER_WEIGHTS };

  function handleChange(key: WeightKey, value: number) {
    setScorerWeights({ ...weights, [key]: value });
  }

  function handleReset() {
    setScorerWeights(null);
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-text-t1 text-sm font-medium">⚖️ {t("settings.scorerWeights.title")}</h3>
        <button
          onClick={handleReset}
          className="text-text-t4 hover:text-text-t2 font-mono text-2xs tracking-wider transition-colors shrink-0"
        >
          {t("settings.scorerWeights.reset")}
        </button>
      </div>
      <p className="text-text-t3 text-xs leading-relaxed mb-4">
        {t("settings.scorerWeights.description")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {WEIGHT_KEYS.map((key) => {
          const val = weights[key];
          const isDefault = val === DEFAULT_SCORER_WEIGHTS[key];
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-text-t2 font-mono text-xs">
                  {t(`settings.scorerWeights.${key}`)}
                </span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    val === 0
                      ? "text-text-t4"
                      : val > 1
                        ? "text-signal-amber"
                        : isDefault
                          ? "text-text-t3"
                          : "text-brand"
                  }`}
                >
                  {val.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.5}
                value={val}
                onChange={(e) => handleChange(key, parseFloat(e.target.value))}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer accent-brand bg-border/50"
              />
              <div className="flex justify-between font-mono text-2xs text-text-t4">
                <span>0</span>
                <span>0.5</span>
                <span>1</span>
                <span>1.5</span>
                <span>2</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
