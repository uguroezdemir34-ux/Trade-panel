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
    <div className="flex flex-col gap-3 p-4">
      {/* Row 1: Bakiye + Mod */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AccountBalanceCard />
        <ModeToggleCard />
      </div>

      {/* Row 2: OKX + Telegram */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <OkxCredsCard />
        <TelegramTestCard />
      </div>

      {/* Row 3: GO Alerts + Fiyat Alarmları */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <GoAlertsCard />
        <PriceAlarmsCard />
      </div>

      {/* Row 4: TV Webhook + Trading Limitleri */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TvWebhookCard />
        <TradingLimitsCard />
      </div>

      {/* Row 5: Drawdown + Tehlikeli Bölge */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DrawdownToggleCard />
        <DangerZoneCard />
      </div>
    </div>
  );
}
