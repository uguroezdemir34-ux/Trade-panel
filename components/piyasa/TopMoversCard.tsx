"use client";

/**
 * TOP MOVERS CARD — Top 3 gainers and top 3 losers by 24h % change.
 *
 * Reads live prices from marketStore. Hidden until at least 6 pairs
 * have live data.
 */

import { useMemo } from "react";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS } from "@/lib/constants/pairs";

export function TopMoversCard(): React.ReactElement | null {
  const prices = useMarketStore((s) => s.prices);

  const { gainers, losers } = useMemo(() => {
    const rows = PAIRS
      .map((p) => ({ pair: p, tick: prices[p] }))
      .filter((r): r is { pair: typeof r.pair; tick: NonNullable<typeof r.tick> } => !!r.tick);

    if (rows.length < 6) return { gainers: [], losers: [] };

    const sorted = [...rows].sort((a, b) => b.tick.chg - a.tick.chg);
    return {
      gainers: sorted.slice(0, 3),
      losers:  sorted.slice(-3).reverse(),
    };
  }, [prices]);

  if (gainers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Gainers */}
      <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-3">
        <p className="text-green-400 font-mono text-2xs tracking-widest uppercase mb-2">
          🚀 Top Gainers
        </p>
        <div className="flex flex-col gap-1.5">
          {gainers.map(({ pair, tick }) => (
            <MoverRow key={pair} pair={pair} chg={tick.chg} last={tick.last} positive />
          ))}
        </div>
      </div>

      {/* Losers */}
      <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-3">
        <p className="text-red-400 font-mono text-2xs tracking-widest uppercase mb-2">
          📉 Top Losers
        </p>
        <div className="flex flex-col gap-1.5">
          {losers.map(({ pair, tick }) => (
            <MoverRow key={pair} pair={pair} chg={tick.chg} last={tick.last} positive={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MoverRow({
  pair,
  chg,
  last,
  positive,
}: {
  pair: string;
  chg: number;
  last: number;
  positive: boolean;
}) {
  const sign = chg >= 0 ? "+" : "";
  const color = positive ? "text-green-400" : "text-red-400";

  const fmtPrice = (p: number) => {
    if (p >= 10_000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (p >= 100)    return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (p >= 1)      return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
  };

  return (
    <div className="flex items-center justify-between font-mono text-xs tabular-nums gap-2">
      <span className="text-text-t2 font-semibold w-12 whitespace-nowrap">{pair}</span>
      <span className="text-text-t4 flex-1 text-right whitespace-nowrap">${fmtPrice(last)}</span>
      <span className={`font-bold ${color} w-14 text-right whitespace-nowrap`}>
        {sign}{chg.toFixed(2)}%
      </span>
    </div>
  );
}
