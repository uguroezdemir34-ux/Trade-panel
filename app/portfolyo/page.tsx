"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import PozisyonPage from "@/app/pozisyon/page";
import RiskPage from "@/app/risk/page";
import PnlPage from "@/app/pnl/page";
import { VaRCard } from "@/components/portfolio/VaRCard";
import { CorrelationMatrix } from "@/components/portfolio/CorrelationMatrix";

type SubTab = "pozisyon" | "risk" | "pnl" | "analitik";

const SUB_TABS: { id: SubTab; labelKey: string }[] = [
  { id: "pozisyon", labelKey: "nav.position" },
  { id: "risk", labelKey: "nav.risk" },
  { id: "pnl", labelKey: "nav.pnl" },
  { id: "analitik", labelKey: "portfolio.analyticsTab" },
];

export default function PortfolyoPage() {
  const t = useT();
  const [active, setActive] = useState<SubTab>("pozisyon");

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="flex">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={[
                "flex-1 py-3 font-mono text-xs tracking-wider transition-colors",
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
        {active === "pozisyon" && <PozisyonPage />}
        {active === "risk" && <RiskPage />}
        {active === "pnl" && <PnlPage />}
        {active === "analitik" && (
          <div className="flex flex-col gap-4 p-4">
            <VaRCard />
            <CorrelationMatrix />
          </div>
        )}
      </div>
    </div>
  );
}
