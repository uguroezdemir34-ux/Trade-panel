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

export default function AyarlarPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <AccountBalanceCard />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OkxCredsCard />
        <TelegramTestCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GoAlertsCard />
        <PriceAlarmsCard />
      </div>

      <TvWebhookCard />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TradingLimitsCard />
        <DrawdownToggleCard />
      </div>

      <ModeToggleCard />

      <DangerZoneCard />
    </div>
  );
}
