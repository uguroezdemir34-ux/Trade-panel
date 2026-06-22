"use client";

/**
 * REASONS LIST — Skor pipeline açıklamaları.
 *
 * Meta açıklamaları (regime, sweep, pullback, vs.) iconlu liste olarak gösterir.
 */

import { useT } from "@/lib/i18n/context";
import type { ScoreReasons } from "@/lib/score/orchestrator";

const META_FIELDS: Array<{
  key: keyof ScoreReasons;
  labelKey: string;
  icon: string;
}> = [
  { key: "sweep", labelKey: "reasons.sweep", icon: "🌊" },
  { key: "regime", labelKey: "reasons.regime", icon: "🌐" },
  { key: "regimeRelax", labelKey: "reasons.regimeRelax", icon: "🔓" },
  { key: "atrRegime", labelKey: "reasons.atrRegime", icon: "📊" },
  { key: "volBreakout", labelKey: "reasons.volBreakout", icon: "💥" },
  { key: "drawdownGate", labelKey: "reasons.drawdownGate", icon: "🛑" },
  { key: "adaptiveCut", labelKey: "reasons.adaptiveCut", icon: "✂️" },
  { key: "lockRamp", labelKey: "reasons.lockRamp", icon: "⏱" },
  { key: "pullback", labelKey: "reasons.pullback", icon: "🔄" },
  { key: "pullbackThreshold", labelKey: "reasons.pullbackThreshold", icon: "🎯" },
];

export function ReasonsList({
  reasons,
}: {
  reasons: ScoreReasons;
}): React.ReactElement | null {
  const t = useT();
  const activeFields = META_FIELDS.filter((f) => reasons[f.key]);
  if (activeFields.length === 0) return null;

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.38) 100%)",
        border: "1px solid rgba(184,140,60,0.12)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 4px rgba(0,0,0,0.32)",
      }}
    >
      <h3 className="text-text-t3 mb-3 font-mono text-2xs tracking-widest">
        {t("reasons.title")}
      </h3>
      <div className="space-y-2">
        {activeFields.map((f) => (
          <div key={f.key} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className="shrink-0">{f.icon}</span>
            <span className="text-text-t3 w-20 shrink-0 font-mono text-2xs tracking-wider">
              {t(f.labelKey).toUpperCase()}
            </span>
            <span className="text-text-t2 flex-1">{reasons[f.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
