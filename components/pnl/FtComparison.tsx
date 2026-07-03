"use client";

/**
 * FT COMPARISON — Kağıt (Forward Test) vs Gerçek trade karşılaştırması.
 *
 * Yalnızca her iki grupta en az 1 trade olduğunda gösterilir.
 * Metrikler: trade sayısı, win rate, avg PnL, toplam PnL.
 */

import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: TradeRecord[];
}

interface GroupStats {
  label: string;
  count: number;
  winRate: number;
  avgPnlUsd: number;
  totalPnlUsd: number;
  winCount: number;
}

function computeGroup(trades: TradeRecord[], label: string): GroupStats {
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const total = trades.reduce((s, t) => s + t.pnlUsd, 0);
  return {
    label,
    count: trades.length,
    winCount: wins.length,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    avgPnlUsd: trades.length > 0 ? total / trades.length : 0,
    totalPnlUsd: total,
  };
}

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`;
}
function usd(v: number) {
  return `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(1)}`;
}
function winColor(r: number) {
  if (r >= 0.6) return "#22C55E";
  if (r >= 0.5) return "#86EFAC";
  if (r >= 0.4) return "#F59E0B";
  return "#EF4444";
}
function pnlColor(v: number) {
  return v > 0 ? "#22C55E" : v < 0 ? "#EF4444" : "rgb(var(--text-t3))";
}

interface StatCellProps {
  label: string;
  value: string;
  color?: string;
}
function StatCell({ label, value, color }: StatCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">
        {label}
      </span>
      <span
        className="font-mono text-xs font-bold tabular-nums"
        style={{ color: color ?? "rgb(var(--text-t1))" }}
      >
        {value}
      </span>
    </div>
  );
}

export function FtComparison({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const liveGroup = computeGroup(
    trades.filter((tr) => !tr.isPaper),
    "Live",
  );
  const paperGroup = computeGroup(
    trades.filter((tr) => tr.isPaper === true),
    t("pnl.ftComparison.badge"),
  );

  // Only render when at least one group has data
  if (liveGroup.count === 0 && paperGroup.count === 0) return null;
  // Only render when there's paper trade data to compare
  if (paperGroup.count === 0) return null;

  const groups = [liveGroup, paperGroup];

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("pnl.ftComparison.title")}
        </span>
        <span className="rounded border border-signal-green/30 bg-signal-green/8 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-signal-green">
          {t("pnl.ftComparison.badge")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {groups.map((g) => (
          <div
            key={g.label}
            className="bg-bg-card2 border-border rounded-md border p-2.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-text-t2 font-mono text-xs font-semibold">
                {g.label}
              </span>
              <span className="text-text-t4 font-mono text-[9px]">
                {g.count} {t("pnl.ftComparison.tradesLabel")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <StatCell
                label={t("pnl.ftComparison.winPct")}
                value={g.count > 0 ? pct(g.winRate) : "—"}
                color={g.count > 0 ? winColor(g.winRate) : undefined}
              />
              <StatCell
                label={t("pnl.ftComparison.avgPnl")}
                value={g.count > 0 ? usd(g.avgPnlUsd) : "—"}
                color={g.count > 0 ? pnlColor(g.avgPnlUsd) : undefined}
              />
              <StatCell
                label={t("pnl.ftComparison.total")}
                value={g.count > 0 ? usd(g.totalPnlUsd) : "—"}
                color={g.count > 0 ? pnlColor(g.totalPnlUsd) : undefined}
              />
              <StatCell
                label={t("pnl.ftComparison.wins")}
                value={g.count > 0 ? `${g.winCount}/${g.count}` : "—"}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Delta row — only when both groups have data */}
      {liveGroup.count > 0 && paperGroup.count > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-bg-card2/50 px-2.5 py-1.5">
          <span className="text-text-t3 font-mono text-[9px] uppercase tracking-wider">
            {t("pnl.ftComparison.deltaLabel")}
          </span>
          <div className="flex gap-4">
            <span
              className="font-mono text-[9px] tabular-nums"
              style={{
                color: pnlColor(paperGroup.winRate - liveGroup.winRate),
              }}
            >
              {t("pnl.ftComparison.deltaWR")}{" "}
              {(paperGroup.winRate - liveGroup.winRate) >= 0 ? "+" : ""}
              {((paperGroup.winRate - liveGroup.winRate) * 100).toFixed(0)}{t("pnl.ftComparison.pp")}
            </span>
            <span
              className="font-mono text-[9px] tabular-nums"
              style={{
                color: pnlColor(paperGroup.avgPnlUsd - liveGroup.avgPnlUsd),
              }}
            >
              {t("pnl.ftComparison.deltaAvg")}{" "}
              {usd(paperGroup.avgPnlUsd - liveGroup.avgPnlUsd)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
