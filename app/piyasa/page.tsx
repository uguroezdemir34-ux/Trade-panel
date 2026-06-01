"use client";

import { useMemo } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { MarketSummaryBanner } from "@/components/piyasa/MarketSummaryBanner";
import { FearGreedGauge } from "@/components/piyasa/FearGreedGauge";
import { DominanceCard } from "@/components/piyasa/DominanceCard";
import { MtfTrendGrid } from "@/components/piyasa/MtfTrendGrid";
import { FundingRateRow } from "@/components/piyasa/FundingRateRow";
import { FundingAlertBanner } from "@/components/piyasa/FundingAlertBanner";
import { OiVelocityCard } from "@/components/piyasa/OiVelocityCard";
import { PriceTable } from "@/components/piyasa/PriceTable";
import { TopMoversCard } from "@/components/piyasa/TopMoversCard";
import { VolatilityRankCard } from "@/components/piyasa/VolatilityRankCard";
import { MarketSessionsCard } from "@/components/piyasa/MarketSessionsCard";
import { MarketBreadthCard } from "@/components/piyasa/MarketBreadthCard";
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

  // Granular candle subscription — only re-renders when 1h/4h/1d last candle
  // timestamps or confirm flags change (not on 15m polls or live price ticks).
  const allCandles = useCandleStore(
    (s) => s.candles,
    (prev, next) => {
      for (const pair of PAIRS) {
        for (const tf of ["1h", "4h", "1d"] as const) {
          const key = `${pair}_${tf}` as const;
          const p = prev[key];
          const n = next[key];
          if (p === n) continue;
          if (!p || !n || p.length !== n.length) return false;
          const pLast = p[p.length - 1];
          const nLast = n[n.length - 1];
          if (!pLast || !nLast) return false;
          if (pLast.ts !== nLast.ts || pLast.confirm !== nLast.confirm) return false;
        }
      }
      return true; // no MTF candle closed → skip re-render
    },
  );

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
      <PriceTable />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TopMoversCard />
        <VolatilityRankCard />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MarketBreadthCard />
        <MarketSessionsCard />
      </div>
      <FundingAlertBanner funding={funding} />
      <MarketSummaryBanner summary={marketSummary} />
      <FearGreedGauge info={fgInfo} loading={fgLoading} />
      <DominanceCard info={dominance} loading={domLoading} />
      <MtfTrendGrid results={mtfResults} />
      <FundingRateRow funding={funding} loading={fundingLoading} />
      <OiVelocityCard velocity={oiVelocity} loading={oiLoading} />
    </div>
  );
}
