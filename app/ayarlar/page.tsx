"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { OkxCredsCard } from "@/components/ayarlar/OkxCredsCard";
import { TelegramTestCard } from "@/components/ayarlar/TelegramTestCard";
import { TradingLimitsCard } from "@/components/ayarlar/TradingLimitsCard";
import { DrawdownToggleCard } from "@/components/ayarlar/DrawdownToggleCard";
import { AccountBalanceCard } from "@/components/ayarlar/AccountBalanceCard";
import { ModeToggleCard } from "@/components/ayarlar/ModeToggleCard";
import { DangerZoneCard } from "@/components/ayarlar/DangerZoneCard";
import { AuthStatusCard } from "@/components/ayarlar/AuthStatusCard";
import { AdminPanelCard } from "@/components/ayarlar/AdminPanelCard";
import { NotificationConfigCard } from "@/components/ayarlar/NotificationConfigCard";
import { GoAlertsCard } from "@/components/ayarlar/GoAlertsCard";
import { PriceAlarmsCard } from "@/components/ayarlar/PriceAlarmsCard";
import { ScorerWeightsCard } from "@/components/ayarlar/ScorerWeightsCard";
import { BinanceCredsCard } from "@/components/ayarlar/BinanceCredsCard";
import { BybitCredsCard } from "@/components/ayarlar/BybitCredsCard";
import { GateioCredsCard } from "@/components/ayarlar/GateioCredsCard";
import { KucoinCredsCard } from "@/components/ayarlar/KucoinCredsCard";
import { MexcCredsCard } from "@/components/ayarlar/MexcCredsCard";
import { KrakenCredsCard } from "@/components/ayarlar/KrakenCredsCard";
import { PwaCard } from "@/components/ayarlar/PwaCard";
import { DiscordWebhookCard } from "@/components/ayarlar/DiscordWebhookCard";
import { ChannelConnectionCard } from "@/components/ayarlar/ChannelConnectionCard";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import loadDynamic from "next/dynamic";
const PlanStatusCard = loadDynamic(
  () => import("@/components/ayarlar/PlanStatusCard").then((m) => ({ default: m.PlanStatusCard })),
  { ssr: false }
);
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
          <BybitCredsCard />
          <GateioCredsCard />
          <KucoinCredsCard />
          <MexcCredsCard />
          <KrakenCredsCard />
          <ChannelConnectionCard />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TelegramTestCard />
            <DiscordWebhookCard />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SubscriptionGate feature="telegramSignals">
              <GoAlertsCard />
            </SubscriptionGate>
            <PriceAlarmsCard />
          </div>
          <TradingLimitsCard />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DrawdownToggleCard />
            <DangerZoneCard />
          </div>
          <SubscriptionGate feature="scorerWeights">
            <ScorerWeightsCard />
          </SubscriptionGate>
          <PwaCard />
          <AuthStatusCard />
          <AdminPanelCard />
          <NotificationConfigCard />
        </div>
      )}

      {active === "backtest" && <BacktestPage />}
    </div>
  );
}
