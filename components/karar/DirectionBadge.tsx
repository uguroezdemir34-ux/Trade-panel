"use client";

/**
 * DIRECTION BADGE — LONG / SHORT / NEUTRAL rozeti.
 * 3D glossy gradient — mockup'taki gunmetal/metalik buton hissi.
 */

import { useT } from "@/lib/i18n/context";
import type { Direction } from "@/lib/score/orchestrator";

const KEYS: Record<Direction, string> = {
  LONG:    "direction.long",
  SHORT:   "direction.short",
  NEUTRAL: "direction.neutral",
};

const ICONS: Record<Direction, string> = {
  LONG:    "▲",
  SHORT:   "▼",
  NEUTRAL: "◆",
};

const DIR_STYLES: Record<Direction, React.CSSProperties> = {
  LONG: {
    background: "linear-gradient(180deg, #2a6848 0%, #1a4a30 45%, #0e2e1c 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(160,255,190,0.28), inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.35)",
    border: "1px solid #0a2016",
    color: "#6ee89a",
  },
  SHORT: {
    background: "linear-gradient(180deg, #6a2828 0%, #4a1414 45%, #2c0808 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,160,160,0.22), inset 0 -2px 0 rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.40)",
    border: "1px solid #200606",
    color: "#f08080",
  },
  NEUTRAL: {
    background: "linear-gradient(180deg, #4a5060 0%, #30363e 45%, #1a1e26 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(200,210,230,0.22), inset 0 -2px 0 rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.45)",
    border: "1px solid #0e1018",
    color: "#a8b0bc",
  },
};

export function DirectionBadge({
  direction,
  confidence,
}: {
  direction: Direction;
  confidence: number;
}): React.ReactElement {
  const t = useT();

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wider select-none"
      style={DIR_STYLES[direction]}
    >
      <span className="leading-none">{ICONS[direction]}</span>
      <span>{t(KEYS[direction])}</span>
      {confidence > 0 && (
        <span className="opacity-60">· {confidence}/3 {t("direction.alignment")}</span>
      )}
    </div>
  );
}
