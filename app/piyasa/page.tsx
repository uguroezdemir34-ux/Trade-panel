"use client";

import { useMacroStore } from "@/lib/store/macroStore";
import { MarketSummaryBanner } from "@/components/piyasa/MarketSummaryBanner";
import { FearGreedGauge } from "@/components/piyasa/FearGreedGauge";
import { DominanceCard } from "@/components/piyasa/DominanceCard";
import { FundingRateRow } from "@/components/piyasa/FundingRateRow";
import { FundingAlertBanner } from "@/components/piyasa/FundingAlertBanner";
import { OiVelocityCard } from "@/components/piyasa/OiVelocityCard";
import { MarketOverviewTable } from "@/components/piyasa/MarketOverviewTable";
import { TopMoversCard } from "@/components/piyasa/TopMoversCard";
import { VolatilityRankCard } from "@/components/piyasa/VolatilityRankCard";
import { MarketSessionsCard } from "@/components/piyasa/MarketSessionsCard";
import { MarketBreadthCard } from "@/components/piyasa/MarketBreadthCard";
import { CorrelationCard } from "@/components/piyasa/CorrelationCard";

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

      {/* Alt: OI + Funding */}
      <OiVelocityCard velocity={oiVelocity} loading={oiLoading} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FundingRateRow funding={funding} loading={fundingLoading} />
        <CorrelationCard />
      </div>
    </div>
  );
}
