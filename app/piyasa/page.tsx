"use client";

import { useMemo } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { MarketSummaryBanner } from "@/components/piyasa/MarketSummaryBanner";
import { FearGreedGauge } from "@/components/piyasa/FearGreedGauge";
import { DominanceCard } from "@/components/piyasa/DominanceCard";
import { MtfTrendGrid } from "@/components/piyasa/MtfTrendGrid";
import { FundingRateRow } from "@/components/piyasa/FundingRateRow";
import { OiVelocityCard } from "@/components/piyasa/OiVelocityCard";
import { computeMtfTrend } from "@/lib/market/mtfTrend";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { MtfTrendResult } from "@/lib/market/mtfTrend";

export default function PiyasaPage() {
  const marketSummary = useMacroStore((s) => s.marketSummary);
  const fgInfo = useMacroStore((s) => s.fgInfo);
  const fgLoading = useMacroStore((s) => s.fgLoading);
  const dominance = useMacroStore((s) => s.dominance);
  const domLoading = useMacroStore((s) => s.domLoading);
  const funding = useMacroStore((s) => s.funding);
  const fundingLoading = useMacroStore((s) => s.fundingLoading);
  const oiVelocity = useMacroStore((s) => s.oiVelocity);
  const oiLoading = useMacroStore((s) => s.oiLoading);

  // All candles — single subscription, recalculates on each poll (~30s)
  const allCandles = useCandleStore((s) => s.candles);

  const mtfResults = useMemo(() => {
    const out: Partial<Record<Pair, MtfTrendResult>> = {};
    for (const pair of PAIRS) {
      const c1h = allCandles[`${pair}_1h`] ?? EMPTY_CANDLES;
      const c4h = allCandles[`${pair}_4h`] ?? EMPTY_CANDLES;
      const c1d = allCandles[`${pair}_1d`] ?? EMPTY_CANDLES;
      if (c1h.length >= 20) {
        out[pair] = computeMtfTrend(
          pair,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          c1h as any,
          c4h as any,
          c1d as any,
        );
      }
    }
    return out;
  }, [allCandles]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <MarketSummaryBanner summary={marketSummary} />
      <FearGreedGauge info={fgInfo} loading={fgLoading} />
      <DominanceCard info={dominance} loading={domLoading} />
      <MtfTrendGrid results={mtfResults} />
      <FundingRateRow funding={funding} loading={fundingLoading} />
      <OiVelocityCard velocity={oiVelocity} loading={oiLoading} />
    </div>
  );
}
