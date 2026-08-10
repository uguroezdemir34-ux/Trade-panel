"use client";

import { DrawdownMeter } from "@/components/risk/DrawdownMeter";
import { DrawdownProtocolCard } from "@/components/risk/DrawdownProtocolCard";
import { SessionRiskCard } from "@/components/risk/SessionRiskCard";
import { DailyStatsCard } from "@/components/risk/DailyStatsCard";
import { DailyGoalCard } from "@/components/risk/DailyGoalCard";
import { PositionSizeCalc } from "@/components/risk/PositionSizeCalc";
import { KellyAdvisorCard } from "@/components/risk/KellyAdvisorCard";
import { AdherenceScore } from "@/components/risk/AdherenceScore";
import { LocksList } from "@/components/risk/LocksList";
import { DisciplineLogList } from "@/components/risk/DisciplineLogList";
import { WeeklyPnlBar } from "@/components/risk/WeeklyPnlBar";
import { useNativeRedirectGuard } from "@/lib/hooks/useNativeRedirectGuard";

export default function RiskPage() {
  const isNative = useNativeRedirectGuard();
  if (isNative) return null;

  return (
    <div className="flex flex-col gap-4">
      <WeeklyPnlBar />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DrawdownMeter />
        <DailyStatsCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DrawdownProtocolCard />
        <SessionRiskCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyGoalCard />
        <AdherenceScore />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PositionSizeCalc />
        <KellyAdvisorCard />
      </div>

      <LocksList />
      <DisciplineLogList />
    </div>
  );
}
