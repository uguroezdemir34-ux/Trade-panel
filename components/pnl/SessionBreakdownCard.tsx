"use client";

/**
 * SESSION BREAKDOWN CARD — Win rate + P&L by market session (UTC).
 *
 * Sessions:
 *   Asia       00-08 UTC
 *   London     08-13 UTC  (pre-NY)
 *   Overlap    13-16 UTC  (London + NY both open — highest volatility)
 *   New York   16-21 UTC  (post-London)
 *   Off Hours  21-00 UTC
 *
 * Uses trade openedAt for classification (entry timing is what matters).
 * Hidden if no trades have openedAt data.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

const SESSIONS = [
  { key: "asia",     name: "Asia",      hours: "00-08 UTC", from: 0,  to: 7  },
  { key: "london",   name: "London",    hours: "08-13 UTC", from: 8,  to: 12 },
  { key: "overlap",  name: "LDN+NY",   hours: "13-16 UTC", from: 13, to: 15 },
  { key: "newyork",  name: "New York",  hours: "16-21 UTC", from: 16, to: 20 },
  { key: "offhours", name: "Off-Hours", hours: "21-00 UTC", from: 21, to: 23 },
] as const;

type SessionKey = (typeof SESSIONS)[number]["key"];

function classifySession(openedAt: number): SessionKey {
  const h = new Date(openedAt).getUTCHours();
  for (const s of SESSIONS) {
    if (h >= s.from && h <= s.to) return s.key;
  }
  return "offhours";
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function SessionBreakdownCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const rows = useMemo(() => {
    const map = Object.fromEntries(
      SESSIONS.map((s) => [s.key, { wins: 0, total: 0, pnlUsd: 0 }]),
    ) as Record<SessionKey, { wins: number; total: number; pnlUsd: number }>;

    for (const t of trades) {
      if (!t.openedAt) continue;
      const key = classifySession(t.openedAt);
      map[key].total++;
      map[key].pnlUsd += t.pnlUsd;
      if (t.pnlUsd > 0) map[key].wins++;
    }

    return SESSIONS.map((s) => {
      const { wins, total, pnlUsd } = map[s.key];
      return { ...s, wins, total, pnlUsd, winRate: total > 0 ? wins / total : 0 };
    }).filter((s) => s.total > 0);
  }, [trades]);

  if (rows.length === 0) return null;

  const maxTrades = Math.max(...rows.map((r) => r.total), 1);
  const maxAbsPnl = Math.max(...rows.map((r) => Math.abs(r.pnlUsd)), 1);

  const bestKey = rows
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.winRate - a.winRate)[0]?.key;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 mb-3 font-mono text-2xs tracking-widest uppercase">
        🕐 {t("pnl.sessionBreakdown.title")}
      </h3>

      {/* Column headers */}
      <div className="mb-1 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-right">
        <span />
        <span className="text-text-t4 font-mono text-2xs w-12">{t("pnl.sessionBreakdown.colWR")}</span>
        <span className="text-text-t4 font-mono text-2xs w-16">{t("pnl.sessionBreakdown.colPnl")}</span>
        <span className="text-text-t4 font-mono text-2xs w-6">{t("pnl.sessionBreakdown.colN")}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((s) => {
          const wrColor =
            s.winRate >= 0.60
              ? "text-signal-green"
              : s.winRate >= 0.45
              ? "text-text-t2"
              : "text-signal-red";
          const pnlColor = s.pnlUsd >= 0 ? "text-signal-green" : "text-signal-red";
          const barFill = s.total / maxTrades;
          const pnlFill = Math.abs(s.pnlUsd) / maxAbsPnl;
          const isBest = bestKey === s.key;

          return (
            <div key={s.key}>
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3">
                {/* Name + time range */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-text-t2 font-mono text-xs font-medium">
                    {s.name}
                  </span>
                  <span className="text-text-t4 font-mono text-2xs hidden sm:inline">
                    {s.hours}
                  </span>
                  {isBest && (
                    <span className="rounded bg-amber-400/10 px-1 py-0 font-mono text-2xs text-amber-400">
                      ★
                    </span>
                  )}
                </div>

                {/* Win rate */}
                <span className={`font-mono text-xs tabular-nums w-12 text-right ${wrColor}`}>
                  {pct(s.winRate)}
                </span>

                {/* P&L */}
                <span className={`font-mono text-xs tabular-nums w-16 text-right ${pnlColor}`}>
                  {s.pnlUsd >= 0 ? "+" : ""}{s.pnlUsd.toFixed(1)}
                </span>

                {/* Trade count */}
                <span className="text-text-t4 font-mono text-2xs tabular-nums w-6 text-right">
                  {s.total}
                </span>
              </div>

              {/* Dual bar: trade volume (grey) + P&L sign (green/red) */}
              <div className="mt-1 h-1 overflow-hidden rounded bg-border/40">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${barFill * 100}%`,
                    background: s.pnlUsd >= 0
                      ? `rgba(34,197,94,${0.3 + pnlFill * 0.5})`
                      : `rgba(239,68,68,${0.3 + pnlFill * 0.5})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
