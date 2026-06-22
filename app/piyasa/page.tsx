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
import { MarketOverviewTable } from "@/components/piyasa/MarketOverviewTable";
import { TopMoversCard } from "@/components/piyasa/TopMoversCard";
import { VolatilityRankCard } from "@/components/piyasa/VolatilityRankCard";
import { MarketSessionsCard } from "@/components/piyasa/MarketSessionsCard";
import { MarketBreadthCard } from "@/components/piyasa/MarketBreadthCard";
import { CorrelationCard } from "@/components/piyasa/CorrelationCard";
import { PerformanceHeatmap } from "@/components/piyasa/PerformanceHeatmap";
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
      return true;
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
    <div className="flex flex-col gap-3 p-4">
      {/* Compact banners */}
      <FundingAlertBanner funding={funding} />
      <MarketSummaryBanner summary={marketSummary} />

      {/* Main layout: PriceTable sol | Göstergeler sağ */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]">
        {/* Sol: Market Overview tablosu */}
        <MarketOverviewTable />

        {/* Sağ: Göstergeler 2×2 grid */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MarketBreadthCard />
            <MarketSessionsCard />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FearGreedGauge info={fgInfo} loading={fgLoading} />
            <DominanceCard info={dominance} loading={domLoading} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TopMoversCard />
            <VolatilityRankCard />
          </div>
        </div>
      </div>

      {/* Çok-periyot performans karşılaştırması */}
      <PerformanceHeatmap />

      {/* Alt: MTF trend + OI yan yana (masaüstü) / Funding */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MtfTrendGrid results={mtfResults} />
        <OiVelocityCard velocity={oiVelocity} loading={oiLoading} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FundingRateRow funding={funding} loading={fundingLoading} />
        <CorrelationCard />
      </div>
    </div>
  );
}
