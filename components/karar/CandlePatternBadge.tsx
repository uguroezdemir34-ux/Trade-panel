"use client";

import { useMemo } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import { detectPatterns } from "@/lib/patterns/candles";
import type { Pair } from "@/lib/constants/pairs";
import type { PatternBias } from "@/lib/patterns/candles";

interface Props {
  pair: Pair;
}

function biasColors(bias: PatternBias): string {
  if (bias === "bullish") return "border-signal-green/30 bg-signal-green/8 text-signal-green";
  if (bias === "bearish") return "border-signal-red/30 bg-signal-red/8 text-signal-red";
  return "border-border bg-surface-s1 text-text-t3";
}

function strengthDot(strength: "weak" | "moderate" | "strong"): string {
  if (strength === "strong") return "●●●";
  if (strength === "moderate") return "●●○";
  return "●○○";
}

export function CandlePatternBadge({ pair }: Props): React.ReactElement | null {
  const candles1h = useCandleStore((s) => s.candles[`${pair}_1h`]);

  const patterns = useMemo(
    () => (candles1h ? detectPatterns(candles1h) : []),
    [candles1h],
  );

  if (patterns.length === 0) return null;

  // Show max 2 patterns (strongest first)
  const shown = patterns.slice(0, 2);

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((p, i) => (
        <div
          key={i}
          title={p.description}
          className={`flex items-center gap-1.5 rounded border px-2 py-1 ${biasColors(p.bias)}`}
        >
          <span className="font-mono text-2xs font-medium whitespace-nowrap">{p.name}</span>
          <span className="font-mono text-2xs opacity-60">{strengthDot(p.strength)}</span>
        </div>
      ))}
    </div>
  );
}
