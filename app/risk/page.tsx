"use client";

import { DrawdownMeter } from "@/components/risk/DrawdownMeter";
import { DailyStatsCard } from "@/components/risk/DailyStatsCard";
import { AdherenceScore } from "@/components/risk/AdherenceScore";
import { LocksList } from "@/components/risk/LocksList";
import { DisciplineLogList } from "@/components/risk/DisciplineLogList";

export default function RiskPage() {
  return (
    <div className="flex flex-col gap-4">
      <DrawdownMeter />
      <DailyStatsCard />
      <AdherenceScore />
      <LocksList />
      <DisciplineLogList />
    </div>
  );
}
