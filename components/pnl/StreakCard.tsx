"use client";

/**
 * STREAK CARD — Current win/loss streak + historical bests.
 *
 * Shows:
 *   - Current streak (wins or losses from the most recent trades, newest first)
 *   - Max win streak + max loss streak across all trades
 *   - Discipline hint when on 3+ consecutive losses
 *
 * Hidden if fewer than 5 trades.
 */

import { useMemo } from "react";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

interface StreakStats {
  current: number;     // positive = wins, negative = losses
  maxWin: number;
  maxLoss: number;
}

function computeStreaks(trades: readonly TradeRecord[]): StreakStats {
  if (trades.length === 0) return { current: 0, maxWin: 0, maxLoss: 0 };

  // Sort ascending by closedAt
  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);

  let maxWin = 0;
  let maxLoss = 0;
  let run = 0; // positive=wins, negative=losses

  for (const t of sorted) {
    const isWin = t.pnlUsd > 0;
    if (isWin) {
      run = run > 0 ? run + 1 : 1;
    } else {
      run = run < 0 ? run - 1 : -1;
    }
    if (run > maxWin) maxWin = run;
    if (-run > maxLoss) maxLoss = -run;
  }

  return { current: run, maxWin, maxLoss };
}

export function StreakCard({ trades }: Props): React.ReactElement | null {
  const stats = useMemo(() => {
    if (trades.length < 5) return null;
    return computeStreaks(trades);
  }, [trades]);

  if (!stats) return null;

  const { current, maxWin, maxLoss } = stats;
  const isWinStreak = current > 0;
  const streakLen = Math.abs(current);

  const streakColor = isWinStreak ? "text-signal-green" : "text-signal-red";
  const streakBg   = isWinStreak ? "bg-soft-green border-signal-green/30" : "bg-soft-red border-signal-red/30";
  const streakLabel = isWinStreak ? "WIN STREAK" : "LOSS STREAK";
  const streakIcon  = isWinStreak ? "🔥" : "🌧";

  const hint =
    !isWinStreak && streakLen >= 5
      ? { text: "5+ consecutive losses — stop trading today.", color: "text-signal-red" }
      : !isWinStreak && streakLen >= 3
      ? { text: "3+ consecutive losses — consider a break.", color: "text-amber-400" }
      : null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 mb-3 font-mono text-2xs tracking-widest uppercase">
        {streakIcon} Current Streak
      </h3>

      <div className="flex items-start gap-4">
        {/* Current streak big number */}
        <div className={`flex-1 rounded-lg border p-3 ${streakBg}`}>
          <div className={`font-mono text-4xl font-bold tabular-nums leading-none ${streakColor}`}>
            {streakLen}
          </div>
          <div className={`mt-1 font-mono text-2xs tracking-widest ${streakColor}`}>
            {streakLabel}
          </div>
        </div>

        {/* Historical bests */}
        <div className="flex flex-col gap-2 text-right">
          <div>
            <div className="text-signal-green font-mono text-lg font-bold tabular-nums leading-none">
              {maxWin}
            </div>
            <div className="text-text-t4 font-mono text-2xs tracking-wider">Best Win</div>
          </div>
          <div>
            <div className="text-signal-red font-mono text-lg font-bold tabular-nums leading-none">
              {maxLoss}
            </div>
            <div className="text-text-t4 font-mono text-2xs tracking-wider">Worst Loss</div>
          </div>
        </div>
      </div>

      {/* Recent 10 trades dots */}
      <div className="mt-3 flex items-center gap-1">
        {[...trades]
          .sort((a, b) => b.closedAt - a.closedAt)
          .slice(0, 10)
          .reverse()
          .map((t, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${t.pnlUsd > 0 ? "bg-signal-green" : "bg-signal-red"}`}
              title={`${t.pnlUsd > 0 ? "W" : "L"} ${t.pnlUsd.toFixed(2)}`}
            />
          ))}
        <span className="text-text-t4 font-mono text-2xs ml-1">← last 10</span>
      </div>

      {/* Discipline hint */}
      {hint && (
        <div className={`mt-3 border-t border-border pt-2 font-mono text-xs ${hint.color}`}>
          ⚠ {hint.text}
        </div>
      )}
    </div>
  );
}
