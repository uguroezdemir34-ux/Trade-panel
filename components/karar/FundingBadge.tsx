"use client";

/**
 * FUNDING BADGE — Live funding rate for the active pair.
 *
 * Shows the current funding rate with color coding:
 *   green = negative rate (long pays short → favorable for longs)
 *   red = positive rate (short pays long → favorable for shorts)
 *
 * Also shows time until next funding settlement.
 */

import { useMemo } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import type { Pair } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";

interface Props {
  pair: Pair;
  direction?: "LONG" | "SHORT" | "NEUTRAL";
}

export function FundingBadge({ pair, direction }: Props): React.ReactElement | null {
  const t = useT();
  const funding = useMacroStore((s) => s.funding);
  const fundingLoading = useMacroStore((s) => s.fundingLoading);

  const info = funding[pair];

  // useMemo must be called before any early returns (Rules of Hooks)
  const timeUntilNext = useMemo(() => {
    if (!info?.nextFundingTime) return null;
    const ms = info.nextFundingTime - Date.now();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }, [info?.nextFundingTime]);

  if (!info && !fundingLoading) return null;
  if (!info) return null;

  const rate = info.fundingRate;
  const rateAnnualized = rate * 3 * 365; // 8h → annual (3 settlements/day × 365)

  // Funding direction impact on intended trade direction
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  // If rate > 0: longs pay shorts (costly for longs, favorable for shorts)
  // If rate < 0: shorts pay longs (costly for shorts, favorable for longs)
  const rateFavorable = isLong ? rate < 0 : isShort ? rate > 0 : null;

  const rateColor = rateFavorable === true ? "text-green-400" :
                    rateFavorable === false ? "text-red-400" :
                    rate < 0 ? "text-green-400/70" : rate > 0 ? "text-red-400/70" : "text-text-t4";

  const rateSign = rate > 0 ? "+" : "";
  const ratePct = (rate * 100).toFixed(4);


  return (
    <div className="flex items-center gap-2 rounded border border-border/50 bg-surface-s1 px-2.5 py-1.5 font-mono">
      <span className="text-text-t4 text-2xs tracking-wider uppercase">{t("karar.fundingLabel")}</span>
      <span className={`text-xs font-semibold tabular-nums ${rateColor}`}>
        {rateSign}{ratePct}%
      </span>
      <span className="text-text-t4 text-2xs tabular-nums">
        {rateSign}{(rateAnnualized * 100).toFixed(1)}%/yr
      </span>
      {timeUntilNext && (
        <span className="text-text-t4 text-2xs ml-auto">
          in {timeUntilNext}
        </span>
      )}
    </div>
  );
}
