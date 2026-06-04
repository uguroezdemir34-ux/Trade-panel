"use client";

/**
 * REGIME BADGE — Mevcut paritenin 1h verisiyle piyasa rejimini gösterir.
 *
 * ADX + ATR% + EMA hizası → trending/ranging/volatile/uncertain
 * Adaptif eşik önerisi de dahil.
 */

import { useMemo } from "react";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { detectRegime, type MarketRegime } from "@/lib/ml/regimeDetector";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
  baseThreshold?: number;
}

interface RegimeMeta {
  label: string;
  color: string;
  borderBg: string;
}

const REGIME_META: Record<MarketRegime, RegimeMeta> = {
  trending_bull: {
    label: "↑ TREND",
    color: "text-green-400",
    borderBg: "border-green-400/30 bg-green-400/8",
  },
  trending_bear: {
    label: "↓ TREND",
    color: "text-red-400",
    borderBg: "border-red-400/30 bg-red-400/8",
  },
  ranging: {
    label: "~ RANGING",
    color: "text-blue-400",
    borderBg: "border-blue-400/30 bg-blue-400/8",
  },
  volatile: {
    label: "⚡ VOLATILE",
    color: "text-orange-400",
    borderBg: "border-orange-400/30 bg-orange-400/8",
  },
  uncertain: {
    label: "· NEUTRAL",
    color: "text-text-t4",
    borderBg: "border-border bg-transparent",
  },
};

export function RegimeBadge({ pair, baseThreshold = 70 }: Props) {
  const candlesRaw = useCandleStore((s) => s.candles[`${pair}_1h`]);
  const candles = candlesRaw ?? EMPTY_CANDLES;

  const regimeResult = useMemo(() => {
    if (candles.length < 60) return null;
    return detectRegime(candles, baseThreshold);
  }, [candles, baseThreshold]);

  if (!regimeResult) return null;

  const meta = REGIME_META[regimeResult.regime];
  const confPct = Math.round(regimeResult.confidence * 100);
  const adj = regimeResult.thresholdAdjustment;

  return (
    <div
      className={`flex items-center gap-2 rounded border px-2.5 py-1 ${meta.borderBg}`}
      title={regimeResult.thresholdReason}
    >
      {/* Regime label */}
      <span className={`font-mono text-2xs font-bold tracking-widest ${meta.color}`}>
        {meta.label}
      </span>

      {/* Confidence */}
      <span className="font-mono text-2xs text-text-t4 tabular-nums">
        {confPct}%
      </span>

      {/* ADX */}
      {regimeResult.adxValue !== null && (
        <span className="font-mono text-2xs text-text-t4 tabular-nums hidden sm:inline">
          ADX {regimeResult.adxValue.toFixed(0)}
        </span>
      )}

      {/* Adaptive threshold indicator */}
      {adj !== 0 && (
        <span
          className={`font-mono text-2xs font-bold tabular-nums ${
            adj < 0 ? "text-green-400/80" : "text-orange-400/80"
          }`}
          title={regimeResult.thresholdReason}
        >
          → {regimeResult.suggestedThreshold}
          {adj > 0 ? " ↑" : " ↓"}
        </span>
      )}
    </div>
  );
}
