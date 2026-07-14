"use client";

/**
 * SCORE RING — tam 360° progress ring (Apple Watch activity ring tekniği).
 *
 * stroke-dasharray = TAM ÇEVRE → tam daire arka plan
 * stroke-dashoffset = circumference - progress → skor kadar dolu
 * rotate(-90) → saat 12'den başlar
 *
 * id prop: SVG gradient ID'si için unique suffix — aynı sayfada birden
 * fazla ring varsa her biri kendi gradient'ını kullanır (ID çakışması önlenir).
 */

interface Props {
  score: number;
  goThreshold: number;
  size?: number;
  id?: string;
}

export function ScoreRing({ score, goThreshold, size = 60, id = "ring" }: Props): React.ReactElement {
  const strokeWidth   = 6;
  const radius        = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress      = (score / 100) * circumference;
  const offset        = circumference - progress;

  // Zone → gradient stops + glow color
  const [gradFrom, gradTo, glowColor] =
    score >= goThreshold ? ["#2dd4bf", "#4ade80", "#4ade80"] :
    score >= 65          ? ["#60a5fa", "#fbbf24", "#fbbf24"] :
                           ["#f87171", "#a78bfa", "#f87171"];

  const gradientId = `score-gradient-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 block"
      aria-label={`Skor: ${score}`}
    >
      <defs>
        {/* Diagonal gradient TL→BR: arc başlangıcı gradFrom, sonu gradTo'ya kayar */}
        <linearGradient
          id={gradientId}
          x1="0" y1="0"
          x2={size} y2={size}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor={gradFrom} />
          <stop offset="100%" stopColor={gradTo}   />
        </linearGradient>
      </defs>

      {/* Arka plan halkası — tam daire, görünür gri */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth={strokeWidth}
      />

      {/* Progress halkası — gradient stroke + hafif glow, saat 12'den başlar */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: "stroke-dashoffset 0.3s ease-out",
          filter: `drop-shadow(0 0 4px ${glowColor}99)`,
        }}
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
