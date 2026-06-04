"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { OkxCredsCard } from "@/components/ayarlar/OkxCredsCard";
import { TelegramTestCard } from "@/components/ayarlar/TelegramTestCard";
import { TradingLimitsCard } from "@/components/ayarlar/TradingLimitsCard";
import { DrawdownToggleCard } from "@/components/ayarlar/DrawdownToggleCard";
import { AccountBalanceCard } from "@/components/ayarlar/AccountBalanceCard";
import { ModeToggleCard } from "@/components/ayarlar/ModeToggleCard";
import { DangerZoneCard } from "@/components/ayarlar/DangerZoneCard";
import { GoAlertsCard } from "@/components/ayarlar/GoAlertsCard";
import { PriceAlarmsCard } from "@/components/ayarlar/PriceAlarmsCard";
import { TvWebhookCard } from "@/components/ayarlar/TvWebhookCard";
import { ScorerWeightsCard } from "@/components/ayarlar/ScorerWeightsCard";
import { BotModeCard } from "@/components/ayarlar/BotModeCard";
import { BinanceCredsCard } from "@/components/ayarlar/BinanceCredsCard";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { PlanStatusCard } from "@/components/ayarlar/PlanStatusCard";
import BacktestPage from "@/app/backtest/page";

type SubTab = "genel" | "backtest";

export default function AyarlarPage() {
  const t = useT();
  const [active, setActive] = useState<SubTab>("genel");

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActive("genel")}
            className={[
              "flex-1 py-3 font-mono text-xs tracking-wider transition-colors",
              active === "genel"
                ? "text-brand border-b-2 border-brand"
                : "text-text-t3 hover:text-text-t2",
            ].join(" ")}
          >
            {t("nav.settings")}
          </button>
          <button
            type="button"
            onClick={() => setActive("backtest")}
            className={[
              "flex-1 py-3 font-mono text-xs tracking-wider transition-colors",
              active === "backtest"
                ? "text-brand border-b-2 border-brand"
                : "text-text-t3 hover:text-text-t2",
            ].join(" ")}
          >
            {t("nav.backtest")}
          </button>
        </div>
      </div>

      {/* Sub-tab content */}
      {active === "genel" && (
        <div className="flex flex-col gap-3 p-4">
          <PlanStatusCard />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AccountBalanceCard />
            <ModeToggleCard />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <OkxCredsCard />
            <BinanceCredsCard />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TelegramTestCard />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SubscriptionGate feature="telegramSignals">
              <GoAlertsCard />
            </SubscriptionGate>
            <PriceAlarmsCard />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TvWebhookCard />
            <TradingLimitsCard />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DrawdownToggleCard />
            <DangerZoneCard />
          </div>
          <SubscriptionGate feature="scorerWeights">
            <ScorerWeightsCard />
          </SubscriptionGate>
          <SubscriptionGate feature="botMode">
            <BotModeCard />
          </SubscriptionGate>
        </div>
      )}

      {active === "backtest" && <BacktestPage />}
    </div>
  );
}
