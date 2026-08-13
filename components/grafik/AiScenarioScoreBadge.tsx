"use client";

import { ScoreRingV2 } from "@/components/karar/ScoreRingV2";

interface Props {
  score: number; // 0-100
  /**
   * ScoreRingV2'nin SVG gradient ID'lerini benzersiz kılmak için — aynı
   * sayfada birden fazla AiScenarioScoreBadge render edilirse (örn. mini
   * kart + ileride başka bir yer) sabit bir id çakışmaya yol açardı.
   * Spesifikasyonda yoktu, teknik bir zorunluluk olarak eklendi (bkz.
   * commit mesajı/rapor notu).
   */
  id?: string;
}

type ScoreDirection = "bull" | "bear" | "neutral";

// lib/share/renderShareCard.ts'teki DIRECTION_ICON/DIRECTION_COLOR ile AYNI
// renk değerleri (▲ #6ee89a / ▼ #f08080 / ◆ #a8b0bc) — yerel kopya. AI
// Senaryo'nun bull/bear/neutral (>=60/<=40/arası) modeli LONG/SHORT/NEUTRAL
// ile birebir eşleşmediği için components/karar/DirectionBadge.tsx
// doğrudan kullanılamıyor — bu, projede zaten kabul edilmiş üçüncü bir
// kopya (ilk ikisi: DirectionBadge.tsx, app/api/cron/ai-scenario/route.ts
// → scoreDirection()).
const ICON: Record<ScoreDirection, string> = { bull: "▲", bear: "▼", neutral: "◆" };
const COLOR: Record<ScoreDirection, string> = {
  bull: "#6ee89a",
  bear: "#f08080",
  neutral: "#a8b0bc",
};

function scoreDirection(score: number): ScoreDirection {
  if (score >= 60) return "bull";
  if (score <= 40) return "bear";
  return "neutral";
}

export function AiScenarioScoreBadge({ score, id = "default" }: Props): React.ReactElement {
  const dir = scoreDirection(score);

  return (
    <div className="flex items-center gap-1.5">
      {/* goThreshold bu bağlamda kullanılmıyor (vestigial prop, ScoreRingV2
          kaynağında da böyle işaretli — components/karar/ScoreRingV2.tsx
          içinde `goThreshold: _goThreshold` olarak destructure edilip bir
          daha hiç referans edilmiyor). */}
      <ScoreRingV2 score={Math.round(score)} goThreshold={0} size={40} id={`ai-scenario-${id}`} />
      <span className="font-mono text-sm font-bold" style={{ color: COLOR[dir] }}>
        {ICON[dir]} {score}
      </span>
    </div>
  );
}
