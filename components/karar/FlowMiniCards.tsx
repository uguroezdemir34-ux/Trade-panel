"use client";

import { useT } from "@/lib/i18n/context";
import type { FlowIntelligenceResult } from "@/lib/orderflow/flowIntelligence";
import { formatCvd } from "@/lib/orderflow/cvd";

interface Props {
  flow: FlowIntelligenceResult | null;
}

export function FlowMiniCards({ flow }: Props): React.ReactElement | null {
  const t = useT();
  if (!flow) return null;

  const vpin = flow.flowVerdict.vpin;
  const w5m = flow.flowVerdict.cvd.w5m;

  const vpinReady = vpin && vpin.ready;
  const vpinColor =
    vpinReady
      ? vpin!.toxicity === "toxic" || vpin!.toxicity === "extreme"
        ? "text-signal-down"
        : vpin!.toxicity === "normal"
        ? "text-signal-up"
        : "text-warning"
      : "text-text-t4";

  const cvdColor =
    w5m.direction === "bullish"
      ? "text-signal-up"
      : w5m.direction === "bearish"
      ? "text-signal-down"
      : "text-text-t3";

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Smart Money (VPIN) */}
      <div className="bg-surface-s1 rounded-lg border border-border px-3 py-2">
        <div className="text-[10px] font-mono text-text-t4 tracking-widest uppercase mb-1">
          Smart Money
        </div>
        {vpinReady ? (
          <>
            <div className={`text-sm font-mono font-bold leading-tight ${vpinColor}`}>
              {vpin!.toxicity.toUpperCase()}
            </div>
            <div className="text-[10px] font-mono text-text-t4 tabular-nums">
              VPIN {vpin!.vpin.toFixed(2)}
            </div>
          </>
        ) : (
          <div className="text-[10px] font-mono text-text-t4 leading-tight">{t("karar.flowComputing")}</div>
        )}
      </div>

      {/* Volume Delta 5m */}
      <div className="bg-surface-s1 rounded-lg border border-border px-3 py-2">
        <div className="text-[10px] font-mono text-text-t4 tracking-widest uppercase mb-1">
          Vol Delta 5m
        </div>
        <div className={`text-sm font-mono font-bold tabular-nums leading-tight ${cvdColor}`}>
          {formatCvd(w5m.cvdUsd)}
        </div>
        <div className="text-[10px] font-mono text-text-t4 uppercase">
          {w5m.direction}
        </div>
      </div>
    </div>
  );
}
