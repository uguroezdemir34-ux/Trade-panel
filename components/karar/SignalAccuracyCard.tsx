"use client";

import { useMemo } from "react";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";

const WINDOW_7D  = 7  * 24 * 60 * 60 * 1000;
const WINDOW_30D = 30 * 24 * 60 * 60 * 1000;
const MIN_ENTRIES = 3;

interface AccuracyStats {
  wins: number;
  losses: number;
  total: number;
  pct: number;
}

function calcStats(entries: ReturnType<typeof useGoSignalLogStore.getState>["entries"], windowMs: number): AccuracyStats | null {
  const cutoff = Date.now() - windowMs;
  let wins = 0;
  let losses = 0;

  for (const e of entries) {
    if (e.ts < cutoff) continue;
    const outcome = e.outcome1h ?? e.outcome15m;
    if (!outcome) continue;
    if (outcome.isAdverse) losses++; else wins++;
  }

  const total = wins + losses;
  if (total < MIN_ENTRIES) return null;
  return { wins, losses, total, pct: Math.round((wins / total) * 100) };
}

function BarColor({ pct }: { pct: number }): string {
  if (pct >= 60) return "bg-green-500";
  if (pct >= 40) return "bg-amber-400";
  return "bg-red-500";
}

function PctColor(pct: number): string {
  if (pct >= 60) return "text-green-400";
  if (pct >= 40) return "text-amber-400";
  return "text-red-400";
}

export function SignalAccuracyCard(): React.ReactElement | null {
  const entries = useGoSignalLogStore((s) => s.entries);

  const stats7d  = useMemo(() => calcStats(entries, WINDOW_7D),  [entries]);
  const stats30d = useMemo(() => calcStats(entries, WINDOW_30D), [entries]);

  // Nothing to show if not enough data in either window
  if (!stats7d && !stats30d) return null;

  const primary   = stats7d ?? stats30d!;
  const label     = stats7d ? "7g" : "30g";
  const barColor  = BarColor({ pct: primary.pct });
  const pctColor  = PctColor(primary.pct);
  const secondary = stats7d && stats30d && stats30d.total > stats7d.total ? stats30d : null;

  return (
    <div className="rounded-lg border border-border bg-surface-s1 px-3 py-2.5 flex flex-col gap-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-text-t3 uppercase tracking-wider">
          GO İsabet · Son {label}
        </span>
        <span className={`font-mono text-sm font-bold tabular-nums ${pctColor}`}>
          %{primary.pct}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-s3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${primary.pct}%` }}
        />
      </div>

      {/* W / L counts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-green-400 tabular-nums">
            {primary.wins}W
          </span>
          <span className="font-mono text-xs text-red-400 tabular-nums">
            {primary.losses}L
          </span>
          <span className="font-mono text-2xs text-text-t4">
            ({primary.total} sinyal · outcome1h)
          </span>
        </div>
        {secondary && (
          <span className="font-mono text-2xs text-text-t4">
            30g: %{secondary.pct}
          </span>
        )}
      </div>
    </div>
  );
}
