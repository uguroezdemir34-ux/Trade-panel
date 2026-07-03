"use client";

import type { GoSignalEntry } from "@/lib/store/goSignalLogStore";

const SUB_MAX = {
  trend:   25,
  adx:     15,
  rsi:     10,
  vol:     15,
  bb:      10,
  vwap:    10,
  funding:  8,
  macro:    7,
} as const;

type SubKey = keyof typeof SUB_MAX;

function SubBar({ label, value, max }: { label: SubKey; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const barColor = pct >= 60 ? "#4ade80" : pct >= 30 ? "#fbbf24" : "#f87171";
  const textColor = pct >= 60 ? "text-green-400" : pct >= 30 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2 font-mono text-2xs">
      <span className="text-text-t4 w-12 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className={`${textColor} tabular-nums w-9 text-right`}>
        {value}/{max}
      </span>
    </div>
  );
}

function ModifierTag({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "green" | "red" | "blue" | "purple" | "teal" | "amber";
}) {
  const cls = {
    green:  "text-green-400 bg-green-500/10 border-green-500/20",
    red:    "text-red-400 bg-red-500/10 border-red-500/20",
    blue:   "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    teal:   "text-teal-400 bg-teal-500/10 border-teal-500/20",
    amber:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  }[variant];
  return (
    <span className={`font-mono text-2xs px-1.5 py-0.5 rounded border ${cls} leading-none`}>
      {children}
    </span>
  );
}

interface Props {
  entry: GoSignalEntry;
}

export function GoSignalPostmortem({ entry }: Props): React.ReactElement {
  const { sub, blocks, softBlocks, sweepBonus, regimeBonus, pullbackActive, srModifier } = entry;

  const hasModifiers =
    (srModifier !== undefined && srModifier !== 0) ||
    sweepBonus !== 0 ||
    regimeBonus !== 0 ||
    pullbackActive;

  return (
    <div className="px-3 pt-1.5 pb-2 bg-surface-s1/40 border-t border-border/20 flex flex-col gap-2">

      {/* Sub-score bars */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs text-text-t4/60 uppercase tracking-widest">
          Sub-scores
        </span>
        {(Object.entries(SUB_MAX) as [SubKey, number][]).map(([key, max]) => (
          <SubBar key={key} label={key} value={sub?.[key] ?? 0} max={max} />
        ))}
      </div>

      {/* Modifiers row */}
      {hasModifiers && (
        <div className="flex flex-wrap gap-1.5">
          {srModifier !== undefined && srModifier !== 0 && (
            <ModifierTag variant={srModifier > 0 ? "green" : "red"}>
              S/R {srModifier > 0 ? "+" : ""}{srModifier}
            </ModifierTag>
          )}
          {sweepBonus !== 0 && (
            <ModifierTag variant="blue">Sweep +{sweepBonus}</ModifierTag>
          )}
          {regimeBonus !== 0 && (
            <ModifierTag variant="purple">Regime +{regimeBonus}</ModifierTag>
          )}
          {pullbackActive && (
            <ModifierTag variant="teal">Pullback mode</ModifierTag>
          )}
        </div>
      )}

      {/* Soft blocks — overridden at time of GO */}
      {softBlocks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-2xs text-amber-400/50 uppercase tracking-widest">
            Soft blocks (overridden)
          </span>
          <div className="flex flex-col gap-0.5">
            {softBlocks.map((b, i) => (
              <span
                key={i}
                className="font-mono text-2xs text-amber-300/80 bg-amber-500/5 px-1.5 py-0.5 rounded leading-snug"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hard blocks — should be empty on a GO, but show if present */}
      {blocks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-2xs text-red-400/50 uppercase tracking-widest">
            Hard blocks
          </span>
          <div className="flex flex-col gap-0.5">
            {blocks.map((b, i) => (
              <span
                key={i}
                className="font-mono text-2xs text-red-300/80 bg-red-500/5 px-1.5 py-0.5 rounded leading-snug"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
