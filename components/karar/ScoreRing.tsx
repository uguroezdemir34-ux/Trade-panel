"use client";

/**
 * SCORE RING — tam 360° progress ring (Apple Watch activity ring tekniği).
 *
 * stroke-dasharray = TAM ÇEVRE → tam daire arka plan
 * stroke-dashoffset = circumference - progress → skor kadar dolu
 * rotate(-90) → saat 12'den başlar
 */

interface Props {
  score: number;
  goThreshold: number;
  size?: number;
}

export function ScoreRing({ score, goThreshold, size = 60 }: Props): React.ReactElement {
  const strokeWidth  = 6;
  const radius       = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;   // TAM ÇEVRE, 360°
  const progress     = (score / 100) * circumference;
  const offset       = circumference - progress;

  const color =
    score >= goThreshold ? "#4ade80" :
    score >= 65          ? "#fb923c" :
                           "#f87171";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 block"
      aria-label={`Skor: ${score}`}
    >
      {/* Arka plan halkası — tam daire, görünür gri */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth={strokeWidth}
      />
      {/* Progress halkası — skor kadar dolu, saat 12'den başlar */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.3s ease-out, stroke 0.2s" }}
      />
      {/* Ortadaki rakam */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize={size * 0.32}
      >
        {score}
      </text>
    </svg>
  );
}
