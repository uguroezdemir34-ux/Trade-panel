import type { TradeRecord } from "./types";

export interface MonthlyAggregate {
  yearMonth: string; // "2025-01"
  label: string;     // "Jan 2025"
  tradeCount: number;
  totalPnlUsd: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  /** Average R-multiple for trades that have rMultiple set — null if none */
  avgR: number | null;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function computeMonthlyAggregates(
  trades: readonly TradeRecord[],
): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();

  const rSums = new Map<string, number>();
  const rCounts = new Map<string, number>();

  for (const trade of trades) {
    const d = new Date(trade.closedAt);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let agg = map.get(ym);
    if (!agg) {
      agg = {
        yearMonth: ym,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        tradeCount: 0,
        totalPnlUsd: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
        avgR: null,
      };
      map.set(ym, agg);
    }
    agg.tradeCount++;
    agg.totalPnlUsd += trade.pnlUsd;
    if (trade.pnlUsd > 0) agg.winCount++;
    else if (trade.pnlUsd < 0) agg.lossCount++;
    if (typeof trade.rMultiple === "number") {
      rSums.set(ym, (rSums.get(ym) ?? 0) + trade.rMultiple);
      rCounts.set(ym, (rCounts.get(ym) ?? 0) + 1);
    }
  }

  for (const agg of map.values()) {
    agg.winRate = agg.tradeCount > 0 ? agg.winCount / agg.tradeCount : 0;
    const rc = rCounts.get(agg.yearMonth) ?? 0;
    agg.avgR = rc > 0 ? (rSums.get(agg.yearMonth) ?? 0) / rc : null;
  }

  return [...map.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}
