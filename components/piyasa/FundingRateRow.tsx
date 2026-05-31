"use client";

/**
 * FUNDING RATE ROW — Tüm pair'ler için funding rate grid.
 *
 * 15 pair desteği: funding map'ten dinamik olarak render eder.
 * Kompakt 3-sütun grid.
 */

import { useT } from "@/lib/i18n/context";
import {
  classifyFundingRate,
  type FundingRateResult,
  type FundingTier,
} from "@/lib/market/fundingRate";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

interface Props {
  funding: Partial<Record<Pair, FundingRateResult>>;
  loading?: boolean;
}

const TIER_COLOR: Record<FundingTier, string> = {
  extreme_long:    "text-signal-red",
  elevated_long:   "text-signal-amber",
  neutral:         "text-text-t2",
  elevated_short:  "text-signal-amber",
  extreme_short:   "text-signal-red",
};

export function FundingRateRow({ funding, loading }: Props): React.ReactElement {
  const t = useT();
  const hasAnyData = Object.keys(funding).length > 0;

  if (loading && !hasAnyData) {
    return (
      <div className="border-border bg-bg-card h-32 animate-pulse rounded-lg border" />
    );
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-3">
      <h3 className="text-text-t3 mb-2 font-mono text-2xs tracking-widest uppercase">
        {t("piyasa.funding.title")}
      </h3>

      <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 sm:grid-cols-5">
        {PAIRS.map((pair) => {
          const data = funding[pair];
          return <FundingCell key={pair} pair={pair} data={data ?? null} t={t} />;
        })}
      </div>
    </div>
  );
}

function FundingCell({
  pair,
  data,
  t,
}: {
  pair: Pair;
  data: FundingRateResult | null;
  t: (k: string) => string;
}) {
  if (!data) {
    return (
      <div>
        <div className="text-text-t4 font-mono text-[9px] tracking-wider">{pair}</div>
        <div className="text-text-t4 font-mono text-sm">—</div>
      </div>
    );
  }

  const tier = classifyFundingRate(data.fundingRate);
  const tierColor = TIER_COLOR[tier];
  const ratePct = (data.fundingRate * 100).toFixed(4);
  const sign = data.fundingRate >= 0 ? "+" : "";

  return (
    <div>
      <div className="text-text-t3 font-mono text-[9px] tracking-wider">{pair}</div>
      <div className={`font-mono text-sm font-bold tabular-nums ${tierColor}`}>
        {sign}{ratePct}%
      </div>
      <div className={`font-mono text-[9px] uppercase tracking-widest ${tierColor}`}>
        {t(`piyasa.funding.tier.${tier}`)}
      </div>
    </div>
  );
}
