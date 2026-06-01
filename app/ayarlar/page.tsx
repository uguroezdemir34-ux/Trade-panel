import { OkxCredsCard } from "@/components/ayarlar/OkxCredsCard";
import { TelegramTestCard } from "@/components/ayarlar/TelegramTestCard";
import { TradingLimitsCard } from "@/components/ayarlar/TradingLimitsCard";
import { DrawdownToggleCard } from "@/components/ayarlar/DrawdownToggleCard";
import { AccountBalanceCard } from "@/components/ayarlar/AccountBalanceCard";
import { ModeToggleCard } from "@/components/ayarlar/ModeToggleCard";
import { LanguageCard } from "@/components/ayarlar/LanguageCard";
import { DangerZoneCard } from "@/components/ayarlar/DangerZoneCard";
import { GoAlertsCard } from "@/components/ayarlar/GoAlertsCard";
import { PriceAlarmsCard } from "@/components/ayarlar/PriceAlarmsCard";

export default function AyarlarPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <AccountBalanceCard />
      <ModeToggleCard />
      <OkxCredsCard />
      <TelegramTestCard />
      <GoAlertsCard />
      <PriceAlarmsCard />
      <TradingLimitsCard />
      <DrawdownToggleCard />
      <LanguageCard />
      <DangerZoneCard />
    </div>
  );
}
