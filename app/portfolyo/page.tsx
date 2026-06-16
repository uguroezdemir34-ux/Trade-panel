"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import RiskPage from "@/app/risk/page";
import PnlPage from "@/app/pnl/page";
import { PortfolioOverviewCard } from "@/components/portfolio/PortfolioOverviewCard";
import { GoSignalLog } from "@/components/karar/GoSignalLog";
import { CopyTradingCard } from "@/components/copy-trading/CopyTradingCard";

type SubTab = "risk" | "pnl" | "sinyaller" | "takip";

const SUB_TABS: { id: SubTab; labelKey: string }[] = [
  { id: "risk", labelKey: "nav.risk" },
  { id: "pnl", labelKey: "nav.pnl" },
  { id: "sinyaller", labelKey: "portfolio.signalsTab" },
  { id: "takip", labelKey: "portfolio.copyTab" },
];

export default function PortfolyoPage() {
  const t = useT();
  const [active, setActive] = useState<SubTab>("risk");

  return (
    <div className="flex flex-col">
      {/* Portfolio equity overview — always visible above tabs */}
      <PortfolioOverviewCard />

      {/* Sub-tab bar */}
      <div className="border-b border-border bg-bg-card sticky top-0 z-10 overflow-x-auto scrollbar-none">
        <div className="flex min-w-max">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={[
                "shrink-0 px-4 py-3 font-mono text-xs tracking-wider transition-colors whitespace-nowrap",
                active === tab.id
                  ? "text-brand border-b-2 border-brand"
                  : "text-text-t3 hover:text-text-t2",
              ].join(" ")}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab content */}
      <div>
        {active === "risk" && <RiskPage />}
        {active === "pnl" && <PnlPage />}
        {active === "sinyaller" && (
          <div className="flex flex-col gap-4 p-4">
            <GoSignalLog emptyFallback={
              <div className="border border-border bg-bg-card rounded-lg px-4 py-8 text-center font-mono text-2xs text-text-t4">
                {t("karar.goSignalEmptyNote")}
              </div>
            } />
          </div>
        )}
        {active === "takip" && (
          <div className="p-4">
            <CopyTradingCard />
          </div>
        )}
      </div>
    </div>
  );
}
