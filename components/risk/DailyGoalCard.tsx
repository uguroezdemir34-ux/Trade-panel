"use client";

/**
 * DAILY GOAL CARD — Progress toward daily P&L target.
 *
 * Reads dailyGoalUsd from settingsStore and today's P&L from tradesStore.
 * Shows a progress bar + percentage toward goal. Hidden when goal is 0.
 * Allows inline editing of the goal amount.
 */

import { useState, useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useT } from "@/lib/i18n/context";

function todayBounds() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { start: d.getTime(), end: d.getTime() + 86_400_000 };
}

export function DailyGoalCard(): React.ReactElement | null {
  const t = useT();
  const trades = useTradesStore((s) => s.trades);
  const dailyGoalUsd = useSettingsStore((s) => s.dailyGoalUsd);
  const setDailyGoalUsd = useSettingsStore((s) => s.setDailyGoalUsd);

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const todayPnl = useMemo(() => {
    const { start, end } = todayBounds();
    return trades
      .filter((t) => t.status === "closed" && t.exit != null && t.exit.closedAt >= start && t.exit.closedAt < end)
      .reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);
  }, [trades]);

  function handleSetGoal() {
    const n = parseFloat(inputVal);
    if (!isNaN(n) && n >= 0) setDailyGoalUsd(n);
    setEditing(false);
    setInputVal("");
  }

  if (dailyGoalUsd === 0 && !editing) {
    return (
      <div className="border-border bg-bg-card rounded-lg border p-4 flex items-center justify-between gap-3">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">🎯 {t("risk.dailyGoal.title")}</span>
        <button
          onClick={() => { setEditing(true); setInputVal(""); }}
          className="text-text-t4 font-mono text-2xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors"
        >
          {t("risk.dailyGoal.setButton")}
        </button>
      </div>
    );
  }

  const pct = dailyGoalUsd > 0 ? Math.min((todayPnl / dailyGoalUsd) * 100, 150) : 0;
  const reached = todayPnl >= dailyGoalUsd && dailyGoalUsd > 0;
  const pnlSign = todayPnl >= 0 ? "+" : "";
  const barColor = reached ? "#22c55e" : todayPnl < 0 ? "#ef4444" : "#f59e0b";

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          🎯 {t("risk.dailyGoal.title")}
        </h3>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setInputVal(dailyGoalUsd.toString()); }}
            className="text-text-t4 font-mono text-2xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors"
          >
            ${dailyGoalUsd} ✎
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-text-t4 font-mono text-xs">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSetGoal(); if (e.key === "Escape") setEditing(false); }}
              className="bg-bg border border-brand rounded px-2 py-0.5 font-mono text-xs text-text-t1 w-20 focus:outline-none"
              autoFocus
            />
            <button onClick={handleSetGoal} className="text-brand font-mono text-xs px-1">✓</button>
            <button onClick={() => setEditing(false)} className="text-text-t4 font-mono text-xs px-1">✕</button>
          </div>
        )}
      </div>

      {dailyGoalUsd > 0 && (
        <>
          {/* Progress bar */}
          <div className="h-3 bg-border/20 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(Math.min(pct, 100), pct < 0 ? 0 : 0)}%`,
                background: barColor,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: todayPnl >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {pnlSign}${Math.abs(todayPnl).toFixed(2)}
            </span>
            {reached ? (
              <span className="text-green-400 font-mono text-xs font-semibold">
                ✓ {t("risk.dailyGoal.reached")}
              </span>
            ) : (
              <span className="text-text-t4 font-mono text-2xs tabular-nums">
                {pct.toFixed(0)}% · ${(dailyGoalUsd - todayPnl).toFixed(2)} {t("risk.dailyGoal.toGo")}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
