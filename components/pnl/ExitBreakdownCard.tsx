"use client";

/**
 * EXIT BREAKDOWN CARD — Close reason vs direction performance matrix.
 *
 * Two tables side by side:
 *   Left: by close reason (tp1 / tp2 / sl / trail / manual)
 *   Right: by direction (LONG / SHORT)
 *
 * Each row shows count, win rate, avg P&L, total P&L.
 * Hidden if fewer than 3 trades.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

interface SegmentRow {
  label: string;
  trades: number;
  wins: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
}

const REASON_ORDER = ["tp1", "tp2", "trail", "manual", "sl"] as const;
const REASON_LABELS: Record<string, string> = {
  tp1: "TP1",
  tp2: "TP2",
  trail: "Trail",
  manual: "Manual",
  sl: "SL",
};

function buildRows(groups: Map<string, TradeRecord[]>, keys: readonly string[], labels: Record<string, string>): SegmentRow[] {
  return keys
    .filter((k) => groups.has(k))
    .map((k) => {
      const ts = groups.get(k)!;
      const wins = ts.filter((t) => t.pnlUsd > 0).length;
      const total = ts.reduce((s, t) => s + t.pnlUsd, 0);
      return {
        label: labels[k] ?? k,
        trades: ts.length,
        wins,
        winRate: (wins / ts.length) * 100,
        avgPnl: total / ts.length,
        totalPnl: total,
      };
    });
}

function BreakdownTable({ title, rows }: { title: string; rows: SegmentRow[] }) {
  const t = useT();
  if (rows.length === 0) return null;

  return (
    <div className="flex-1 min-w-0">
      <p className="text-text-t4 font-mono text-2xs tracking-widest uppercase mb-2">{title}</p>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="text-text-t4 border-b border-border">
            <th className="text-left py-1 pr-2">{t("pnl.exitBreakdown.colExit")}</th>
            <th className="text-right py-1 pr-2">{t("pnl.exitBreakdown.colN")}</th>
            <th className="text-right py-1 pr-2">{t("pnl.exitBreakdown.colWR")}</th>
            <th className="text-right py-1">{t("pnl.exitBreakdown.colAvgPnl")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const wrColor =
              row.winRate >= 60
                ? "text-green-400"
                : row.winRate >= 45
                ? "text-yellow-400"
                : "text-red-400";
            const avgColor = row.avgPnl >= 0 ? "text-green-400" : "text-red-400";
            return (
              <tr key={row.label} className="border-b border-border/30">
                <td className="text-text-t2 font-semibold py-1.5 pr-2">{row.label}</td>
                <td className="text-text-t3 text-right py-1.5 pr-2 tabular-nums">{row.trades}</td>
                <td className={`text-right py-1.5 pr-2 tabular-nums ${wrColor}`}>
                  {row.winRate.toFixed(0)}%
                </td>
                <td className={`text-right py-1.5 tabular-nums font-semibold ${avgColor}`}>
                  {row.avgPnl >= 0 ? "+" : ""}{row.avgPnl.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ExitBreakdownCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const { reasonRows, directionRows } = useMemo(() => {
    if (trades.length < 3) return { reasonRows: [], directionRows: [] };

    const byReason = new Map<string, TradeRecord[]>();
    const byDir = new Map<string, TradeRecord[]>();

    for (const t of trades) {
      const reason = t.closeReason ?? "manual";
      if (!byReason.has(reason)) byReason.set(reason, []);
      byReason.get(reason)!.push(t);

      if (!byDir.has(t.direction)) byDir.set(t.direction, []);
      byDir.get(t.direction)!.push(t);
    }

    return {
      reasonRows: buildRows(byReason, REASON_ORDER, REASON_LABELS),
      directionRows: buildRows(byDir, ["LONG", "SHORT"], { LONG: "LONG ▲", SHORT: "SHORT ▼" }),
    };
  }, [trades]);

  if (reasonRows.length === 0 && directionRows.length === 0) return null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        🔬 {t("pnl.exitBreakdown.title")}
      </h3>
      <div className="flex gap-6 flex-wrap">
        <BreakdownTable title={t("pnl.exitBreakdown.byReason")} rows={reasonRows} />
        <BreakdownTable title={t("pnl.exitBreakdown.byDirection")} rows={directionRows} />
      </div>
    </div>
  );
}
