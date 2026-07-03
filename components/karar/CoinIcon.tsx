"use client";

import type { Pair } from "@/lib/constants/pairs";
import { PAIR_CATEGORY } from "@/lib/constants/pairMeta";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  L1:    { bg: "#3B82F6", text: "#fff" },
  DeFi:  { bg: "#8B5CF6", text: "#fff" },
  Meme:  { bg: "#F59E0B", text: "#fff" },
  Infra: { bg: "#10B981", text: "#fff" },
};

const FALLBACK = { bg: "#6B7280", text: "#fff" };

interface CoinIconProps {
  pair: Pair;
  size?: number;
}

export function CoinIcon({ pair, size = 32 }: CoinIconProps) {
  const cat = PAIR_CATEGORY[pair];
  const { bg, text } = (cat && CATEGORY_COLORS[cat]) ?? FALLBACK;
  const label = pair.length > 4 ? pair.slice(0, 4) : pair;
  const fontSize = size <= 24 ? size * 0.38 : size * 0.33;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={pair}
    >
      <circle cx="16" cy="16" r="16" fill={bg} />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fill={text}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        letterSpacing="-0.5"
      >
        {label}
      </text>
    </svg>
  );
}
