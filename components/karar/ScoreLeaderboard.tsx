"use client";

import { useMemo } from "react";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { ScoreResult } from "@/lib/score/orchestrator";
import { useT } from "@/lib/i18n/context";

interface Props {
  results: Partial<Record<Pair, ScoreResult>>;
  activePair: Pair;
  onSelect: (pair: Pair) => void;
}

const VERDICT_COLOR: Record<string, string> = {
  go:   "text-signal-green",
  wait: "text-signal-amber",
  no:   "text-signal-red/70",
};
const VERDICT_BG: Record<string, string> = {
  go:   "bg-soft-green",
  wait: "bg-soft-amber",
  no:   "",
};

export function ScoreLeaderboard({ results, activePair, onSelect }: Props): React.ReactElement | null {
  const t = useT();
  const rows = useMemo(() => {
    return PAIRS
      .map((p) => ({ pair: p, result: results[p] }))
      .filter((r): r is { pair: Pair; result: ScoreResult } => !!r.result)
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 7);
  }, [results]);

  if (rows.length === 0) return null;

  const goCount = rows.filter((r) => r.result.verdict === "go").length;

  return (
    <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">
          {t("karar.leaderboardTitle")}
        </span>
        {goCount > 0 && (
          <span className="text-signal-green font-mono text-2xs font-semibold">
            {goCount} GO
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {rows.map((row, idx) => {
          const { pair, result } = row;
          const isActive = pair === activePair;
          const vColor = VERDICT_COLOR[result.verdict] ?? "text-text-t4";
          const vBg = VERDICT_BG[result.verdict] ?? "";
          const dirArrow = result.direction === "LONG" ? "▲" : result.direction === "SHORT" ? "▼" : "";
          const dirColor = result.direction === "LONG" ? "text-signal-green" : result.direction === "SHORT" ? "text-signal-red" : "text-text-t4";

          return (
            <button
              key={pair}
              onClick={() => onSelect(pair)}
              className={[
                "w-full grid items-center gap-x-2 px-3 py-1.5 font-mono text-xs transition-colors text-left",
                "hover:bg-surface-s1",
                isActive ? "bg-surface-s1" : vBg,
              ].join(" ")}
              style={{
                gridTemplateColumns: "16px 44px 1fr auto auto",
                ...(result.verdict === "go" && {
                  boxShadow: "inset 2px 0 0 rgb(var(--signal-green) / 0.55), 0 0 10px rgb(var(--signal-green) / 0.08)",
                }),
              }}
            >
              {/* Rank */}
              <span className="text-text-t4 text-2xs tabular-nums">
                {idx + 1}
              </span>

              {/* Pair */}
              <span className={`font-semibold tracking-wide ${isActive ? "text-text-t1" : "text-text-t2"}`}>
                {pair}
              </span>

              {/* Score bar */}
              <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    result.verdict === "go" ? "bg-signal-green" :
                    result.verdict === "wait" ? "bg-signal-amber" : "bg-signal-red/50"
                  }`}
                  style={{ width: `${result.score}%` }}
                />
              </div>

              {/* Score */}
              <span className={`tabular-nums text-right w-8 ${vColor}`}>
                {result.score}
              </span>

              {/* Direction */}
              <span className={`tabular-nums text-right w-4 ${dirColor}`}>
                {dirArrow || "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
