"use client";

/**
 * WEEKLY SUMMARY — Son 8 haftalık P&L bar grafiği.
 *
 * Pure SVG, sıfır dış bağımlılık.
 * - Yeşil bar: karlı hafta
 * - Kırmızı bar: zararlı hafta
 * - Gri: trade olmayan hafta
 * - Üstte toplam PnL etiketi
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { WeeklyAggregate } from "@/lib/pnl/weekly";

interface Props {
  weeks: WeeklyAggregate[];
}

const BAR_GAP = 4;
const MIN_BAR_H = 2; // işlem olan haftalar için minimum bar yüksekliği

export function WeeklySummary({ weeks }: Props): React.ReactElement {
  const t = useT();
  const hasData = weeks.some((w) => w.tradeCount > 0);

  const { bars, totalPnl } = useMemo(() => {
    const totalPnl = weeks.reduce((s, w) => s + w.totalPnlUsd, 0);
    if (weeks.length === 0) return { bars: [], totalPnl: 0 };

    const maxAbs = weeks.reduce(
      (m, w) => Math.max(m, Math.abs(w.totalPnlUsd)),
      0.01,
    );

    return {
      totalPnl,
      bars: weeks.map((w) => ({
        ...w,
        heightPct: Math.max(
          w.tradeCount > 0 ? MIN_BAR_H : 0,
          (Math.abs(w.totalPnlUsd) / maxAbs) * 100,
        ),
        isProfit: w.totalPnlUsd >= 0,
        isEmpty: w.tradeCount === 0,
      })),
    };
  }, [weeks]);

  const totalSign = totalPnl >= 0 ? "+" : "";
  const totalColor =
    totalPnl > 0 ? "#22C55E" : totalPnl < 0 ? "#EF4444" : undefined;

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("pnl.weeklySummary.title")}
        </span>
        {hasData && (
          <span
            className="font-mono text-xs font-bold tabular-nums"
            style={{ color: totalColor }}
          >
            {totalSign}${Math.abs(totalPnl).toFixed(2)}
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex h-[88px] items-center justify-center">
          <span className="text-text-t4 font-mono text-2xs tracking-wider">
            {t("pnl.weeklySummary.noData")}
          </span>
        </div>
      ) : (
        <div className="flex items-end gap-1" style={{ height: 72 }}>
          {bars.map((bar) => (
            <div
              key={bar.weekStart}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              {/* Bar */}
              <div
                className="w-full rounded-sm transition-opacity group-hover:opacity-80"
                style={{
                  height: `${bar.heightPct}%`,
                  minHeight: bar.tradeCount > 0 ? MIN_BAR_H : 0,
                  background: bar.isEmpty
                    ? "rgb(var(--border))"
                    : bar.isProfit
                      ? "#22C55E"
                      : "#EF4444",
                  opacity: bar.isEmpty ? 0.3 : 0.85,
                }}
                title={
                  bar.isEmpty
                    ? bar.weekLabel
                    : `${bar.weekLabel}: ${bar.totalPnlUsd >= 0 ? "+" : ""}$${bar.totalPnlUsd.toFixed(2)} (${bar.tradeCount} trades)`
                }
              />

              {/* Trade count badge — only if has trades */}
              {bar.tradeCount > 0 && (
                <div
                  className="absolute -top-4 font-mono text-[8px] tabular-nums"
                  style={{
                    color: bar.isProfit ? "#22C55E" : "#EF4444",
                  }}
                >
                  {bar.totalPnlUsd >= 0 ? "+" : ""}
                  {bar.totalPnlUsd.toFixed(0)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* X-axis week labels */}
      <div className="mt-1 flex" style={{ gap: BAR_GAP }}>
        {bars.map((bar) => (
          <div
            key={bar.weekStart}
            className="text-text-t4 flex-1 text-center font-mono"
            style={{ fontSize: 7 }}
          >
            {bar.weekLabel.split(" ")[1]}
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div className="mt-0.5 flex" style={{ gap: BAR_GAP }}>
        {bars.map((bar, i) => {
          const month = bar.weekLabel.split(" ")[0];
          const prevMonth = i > 0 ? bars[i - 1].weekLabel.split(" ")[0] : null;
          const showMonth = month !== prevMonth;
          return (
            <div
              key={bar.weekStart}
              className="text-text-t4 flex-1 text-center font-mono"
              style={{ fontSize: 7 }}
            >
              {showMonth ? month : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
