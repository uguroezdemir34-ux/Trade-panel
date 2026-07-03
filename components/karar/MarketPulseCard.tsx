"use client";

import { useMacroStore } from "@/lib/store/macroStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import type { ScoreResult } from "@/lib/score/orchestrator";

function Chip({ label, value, valueClass }: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1 bg-surface-s1 border border-border/30 rounded px-1.5 py-0.5 shrink-0">
      <span className="font-mono text-[9px] text-text-t4 leading-none">{label}</span>
      <span className={`font-mono text-[9px] font-bold tabular-nums leading-none ${valueClass ?? "text-text-t2"}`}>
        {value}
      </span>
    </div>
  );
}

export function MarketPulseCard(): React.ReactElement | null {
  const marketSummary = useMacroStore((s) => s.marketSummary);
  const fgValue       = useMacroStore((s) => s.fgValue);
  const btcD          = useMacroStore((s) => s.btcD);
  const allResults    = useScoreStore((s) => s.results);

  const resultValues = (Object.values(allResults) as Array<ScoreResult | null | undefined>)
    .filter((r): r is ScoreResult => r != null);
  const total        = resultValues.length;
  const goCount      = resultValues.filter((r) => r.verdict === "go").length;
  const avgScore     = total > 0
    ? Math.round(resultValues.reduce((sum, r) => sum + (r.score ?? 0), 0) / total)
    : null;

  // Don't render until we have minimal data
  if (total === 0 && fgValue === null && !marketSummary) return null;

  const regimeLabel =
    marketSummary?.cls === "risk_on_healthy"  ? "Risk-On"  :
    marketSummary?.cls === "risk_on_caution"  ? "Caution"  :
    marketSummary?.cls === "risk_off"         ? "Risk-Off" :
    marketSummary?.cls === "neutral"          ? "Neutral"  :
    marketSummary?.cls === "undecided"        ? "—"        : "—";

  const regimeColor =
    marketSummary?.cls === "risk_on_healthy"  ? "text-green-400"  :
    marketSummary?.cls === "risk_on_caution"  ? "text-amber-400"  :
    marketSummary?.cls === "risk_off"         ? "text-red-400"    :
                                                "text-text-t3";

  const fgColor =
    fgValue === null    ? "text-text-t4"   :
    fgValue < 25        ? "text-red-400"   :
    fgValue < 45        ? "text-orange-400":
    fgValue < 55        ? "text-text-t3"   :
    fgValue < 75        ? "text-yellow-400":
                          "text-orange-400";

  return (
    <div className="flex items-center gap-1.5 px-0.5 py-1 overflow-x-auto">
      {/* Regime — icon + label */}
      <div className="flex items-center gap-1 bg-surface-s1 border border-border/30 rounded px-1.5 py-0.5 shrink-0">
        {marketSummary?.icon && (
          <span className="text-[9px] leading-none">{marketSummary.icon}</span>
        )}
        <span className={`font-mono text-[9px] font-bold leading-none ${regimeColor}`}>
          {regimeLabel}
        </span>
      </div>

      {/* Fear & Greed */}
      <Chip
        label="F&G"
        value={fgValue !== null ? fgValue : "·"}
        valueClass={fgColor}
      />

      {/* GO count */}
      <Chip
        label="GO"
        value={total > 0 ? `${goCount}/${total}` : "·"}
        valueClass={goCount > 0 ? "text-green-400" : "text-text-t4"}
      />

      {/* Avg score */}
      {avgScore !== null && (
        <Chip label="AVG" value={avgScore} />
      )}

      {/* BTC Dominance */}
      {btcD !== null && (
        <Chip label="BTC.D" value={`${btcD.toFixed(1)}%`} />
      )}
    </div>
  );
}
