"use client";

import { AiScenarioScoreBadge } from "./AiScenarioScoreBadge";
import type { AiScenarioRow } from "@/app/api/ai-scenario/route";

interface Props {
  row: AiScenarioRow | null;
  onClick: () => void;
}

/** Basit relative-time — kütüphane eklemeden, Math.floor farkını saat/dakikaya böler. */
function relativeTimeFromNow(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} dakika önce`;
  return `${Math.floor(totalMinutes / 60)} saat önce`;
}

/**
 * ActivePairMiniCard.tsx ile AYNI görsel dil (rounded-lg border
 * border-border/50 bg-surface-s1 px-3 py-2 font-mono). row null ise
 * (henüz hiç AI Senaryo verisi yoksa) hiçbir şey render edilmez —
 * sessizce boş göstermek yerine, kartın kendisi hiç yok.
 */
export function AiScenarioMiniCard({ row, onClick }: Props): React.ReactElement | null {
  if (!row) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border/50 bg-surface-s1 px-3 py-2 font-mono text-left"
    >
      <AiScenarioScoreBadge score={row.score.score} id="mini-card" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold text-text-t1">{row.symbol}</span>
        <span className="text-2xs text-text-t4">{relativeTimeFromNow(row.created_at)}</span>
      </div>
    </button>
  );
}
