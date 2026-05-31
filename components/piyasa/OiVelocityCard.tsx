"use client";

/**
 * OI VELOCITY CARD — Open Interest ivme analizi (tüm pair'ler).
 *
 * 15 pair desteği: velocity map'ten dinamik olarak render eder.
 * Kompakt liste: pair | rejim | skor | OI% | fiyat%
 */

import type { OiVelocityResult } from "@/lib/market/oi-velocity";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

interface Props {
  velocity: Partial<Record<Pair, OiVelocityResult>>;
  loading: boolean;
}

const REGIME_META: Record<
  string,
  { label: string; color: string }
> = {
  aggressive_long:    { label: "Agresif Long",    color: "#22C55E" },
  short_squeeze_risk: { label: "Squeeze Riski",   color: "#EF4444" },
  long_unwind:        { label: "Long Kapanıyor",  color: "#F59E0B" },
  bear_exhaustion:    { label: "Bear Yorgunluğu", color: "#3B82F6" },
  neutral:            { label: "Nötr",            color: "rgb(var(--text-t3))" },
};

function scoreColor(s: number): string {
  if (s >= 3) return "#22C55E";
  if (s >= 1) return "#86EFAC";
  if (s <= -3) return "#EF4444";
  if (s <= -1) return "#FCA5A5";
  return "rgb(var(--text-t3))";
}

export function OiVelocityCard({ velocity, loading }: Props): React.ReactElement {
  const hasData = Object.keys(velocity).length > 0;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          OI Velocity
        </span>
        {loading && !hasData && (
          <span className="text-text-t4 animate-pulse font-mono text-2xs">~5dk</span>
        )}
      </div>

      {/* Header */}
      <div className="mb-0.5 grid grid-cols-[44px_1fr_40px_48px_48px] gap-x-2 px-1">
        {["", "Rejim", "Skor", "OI%", "Fiyat%"].map((h) => (
          <span key={h} className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">
            {h}
          </span>
        ))}
      </div>

      <div className="divide-border/30 flex flex-col divide-y">
        {PAIRS.map((pair) => {
          const result = velocity[pair];
          const regime = result ? (REGIME_META[result.regime] ?? REGIME_META.neutral) : null;

          return (
            <div
              key={pair}
              className="grid grid-cols-[44px_1fr_40px_48px_48px] items-center gap-x-2 py-0.5 px-1"
            >
              <span className="text-text-t2 font-mono text-xs font-semibold">{pair}</span>

              {result && regime ? (
                <>
                  <span
                    className="truncate font-mono text-[9px] font-medium"
                    style={{ color: regime.color }}
                  >
                    {regime.label}
                  </span>
                  <span
                    className="text-right font-mono text-xs font-bold tabular-nums"
                    style={{ color: scoreColor(result.oiVelocityScore) }}
                  >
                    {result.oiVelocityScore >= 0 ? "+" : ""}
                    {result.oiVelocityScore.toFixed(1)}
                  </span>
                  <span className="text-text-t3 text-right font-mono text-[9px] tabular-nums">
                    {result.oiChangePct >= 0 ? "+" : ""}
                    {result.oiChangePct.toFixed(2)}%
                  </span>
                  <span className="text-text-t3 text-right font-mono text-[9px] tabular-nums">
                    {result.priceChangePct >= 0 ? "+" : ""}
                    {result.priceChangePct.toFixed(2)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-text-t4 font-mono text-[9px]">—</span>
                  <span className="text-text-t4 font-mono text-xs text-right">—</span>
                  <span />
                  <span />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
