"use client";

/**
 * FUNDING ALERT BANNER — Shows only when ≥1 pair has extreme funding.
 *
 * extreme_long (rate >= 0.01%) → longs paying heavy premium, fade risk.
 * extreme_short (rate <= -0.01%) → shorts paying heavy premium, squeeze risk.
 */

import { useMemo } from "react";
import { classifyFundingRate } from "@/lib/market/fundingRate";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { FundingRateResult } from "@/lib/market/fundingRate";

interface Props {
  funding: Partial<Record<Pair, FundingRateResult>>;
}

export function FundingAlertBanner({ funding }: Props): React.ReactElement | null {
  const extremes = useMemo(() => {
    const out: Array<{ pair: Pair; rate: number; tier: "extreme_long" | "extreme_short" }> = [];
    for (const pair of PAIRS) {
      const data = funding[pair];
      if (!data) continue;
      const tier = classifyFundingRate(data.fundingRate);
      if (tier === "extreme_long" || tier === "extreme_short") {
        out.push({ pair, rate: data.fundingRate, tier });
      }
    }
    return out.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));
  }, [funding]);

  if (extremes.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-amber-400 font-mono text-2xs font-bold tracking-widest shrink-0">
        ⚡ EXTREME FUNDING
      </span>
      {extremes.map(({ pair, rate, tier }) => {
        const sign = rate >= 0 ? "+" : "";
        const ratePct = `${sign}${(rate * 100).toFixed(4)}%`;
        const isLong = tier === "extreme_long";
        return (
          <div key={pair} className="flex items-center gap-1 font-mono text-2xs tabular-nums whitespace-nowrap">
            <span className="text-text-t2 font-bold">{pair}</span>
            <span className={isLong ? "text-red-400" : "text-green-400"}>{ratePct}</span>
            <span className="text-text-t4">
              {isLong ? "crowded long" : "crowded short"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
