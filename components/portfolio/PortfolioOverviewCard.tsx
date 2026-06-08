"use client";

import { useAccountStore } from "@/lib/store/accountStore";
import { useTradesStore, selectClosedTrades } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useT } from "@/lib/i18n/context";

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function signed(n: number, dec = 2): string {
  return (n >= 0 ? "+" : "") + n.toFixed(dec);
}

export function PortfolioOverviewCard(): React.ReactElement {
  const t = useT();
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const balanceFree = useAccountStore((s) => s.balanceFree);
  const dailyPnlPct = useAccountStore((s) => s.dailyPnlPct);
  const weeklyPnlPct = useAccountStore((s) => s.weeklyPnlPct);
  const drawdownProtocol = useAccountStore((s) => s.drawdownProtocol);

  const closedTrades = useTradesStore(selectClosedTrades);
  const openPositions = usePositionStore((s) => s.positions);

  const wins = closedTrades.filter((tr) => (tr.exit?.pnlUsd ?? 0) > 0).length;
  const total = closedTrades.length;
  const winRate = total > 0 ? (wins / total) * 100 : null;
  const realizedPnl = closedTrades.reduce((sum, tr) => sum + (tr.exit?.pnlUsd ?? 0), 0);
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.upl, 0);

  const tierStyle: Record<string, string> = {
    normal: "bg-green-500/10 text-green-400 border-green-500/30",
    caution: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    restricted: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    locked: "bg-red-500/10 text-red-400 border-red-500/30 animate-pulse",
  };
  const tierCls = tierStyle[drawdownProtocol.tier] ?? tierStyle.normal;

  return (
    <div className="border-b border-border bg-bg-card px-4 pt-3 pb-3">
      {/* Top row: equity + tier */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-widest uppercase mb-0.5">
            {t("portfolio.overview.totalEquity")}
          </div>
          <div className="font-mono text-2xl font-bold text-text-t1 tabular-nums">
            ${fmt(balanceTotal)}
          </div>
          <div className="font-mono text-2xs text-text-t4 tabular-nums">
            {t("portfolio.overview.free")} ${fmt(balanceFree)}
          </div>
        </div>
        <span className={`font-mono text-2xs px-2.5 py-1 rounded border font-bold shrink-0 ${tierCls}`}>
          {drawdownProtocol.label}
        </span>
      </div>

      {/* Stats grid 4×2 */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-2">
        <OvStat
          label={t("portfolio.overview.dailyPnl")}
          value={`${signed(dailyPnlPct)}%`}
          color={dailyPnlPct >= 0 ? "text-signal-green" : "text-signal-red"}
        />
        <OvStat
          label={t("portfolio.overview.weekly")}
          value={`${signed(weeklyPnlPct)}%`}
          color={weeklyPnlPct >= 0 ? "text-signal-green" : "text-signal-red"}
        />
        <OvStat
          label={t("portfolio.overview.realizedPnl")}
          value={`${realizedPnl >= 0 ? "+" : "-"}$${fmt(Math.abs(realizedPnl))}`}
          color={realizedPnl >= 0 ? "text-signal-green" : "text-signal-red"}
        />
        <OvStat
          label={t("portfolio.overview.unrealized")}
          value={`${unrealizedPnl >= 0 ? "+" : "-"}$${fmt(Math.abs(unrealizedPnl), 1)}`}
          color={unrealizedPnl >= 0 ? "text-signal-green" : "text-signal-red"}
        />
        <OvStat
          label={t("portfolio.overview.winRate")}
          value={winRate !== null ? `${winRate.toFixed(0)}%` : "—"}
          sub={
            total > 0
              ? t("portfolio.overview.tradesCount")
                  .replace("{w}", String(wins))
                  .replace("{t}", String(total))
              : undefined
          }
        />
        <OvStat label={t("portfolio.overview.openPos")} value={String(openPositions.length)} />
        <OvStat label={t("portfolio.overview.closedTrades")} value={String(total)} />
        <OvStat
          label={t("portfolio.overview.riskMult")}
          value={`${drawdownProtocol.multiplier}×`}
          color={drawdownProtocol.multiplier < 1 ? "text-yellow-400" : "text-text-t1"}
        />
      </div>
    </div>
  );
}

function OvStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div>
      <div className="font-mono text-2xs text-text-t4 tracking-wider leading-tight">{label}</div>
      <div className={`font-mono text-xs font-semibold tabular-nums mt-0.5 ${color ?? "text-text-t1"}`}>
        {value}
      </div>
      {sub && <div className="font-mono text-2xs text-text-t4 tabular-nums">{sub}</div>}
    </div>
  );
}
