"use client";

interface Props {
  score: number;
  goThreshold: number;
  snaps?: number[];
  size?: number;
  id?: string;
}

function bandColors(score: number): [string, string, string] {
  if (score >= 80) return ["#D4AF37", "#F0CC55", "#D4AF37"]; // gold
  if (score >= 60) return ["#3F9C93", "#5CBAB0", "#3F9C93"]; // sapphire
  if (score >= 40) return ["#C08A3E", "#DCA65A", "#C08A3E"]; // bronze
  if (score >= 30) return ["#B25C74", "#CE7890", "#B25C74"]; // wine
  return ["#C0455A", "#DC6176", "#C0455A"];                   // crimson
}

function buildSparkPath(snaps: number[], cx: number, cy: number, innerR: number): string {
  if (snaps.length < 2) return "";
  const w = innerR * 1.3;
  const h = innerR * 0.7;
  const x0 = cx - w / 2;
  const y0 = cy + h / 2;
  const min = Math.min(...snaps);
  const max = Math.max(...snaps);
  const range = max - min || 1;
  const pts = snaps.map((v, i) => {
    const x = x0 + (i / (snaps.length - 1)) * w;
    const y = y0 - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join("L")}`;
}

export function ScoreRingV2({
  score,
  goThreshold: _goThreshold,
  snaps = [],
  size = 60,
  id = "ring2",
}: Props): React.ReactElement {
  const strokeWidth   = 6;
  const radius        = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset        = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;
  const [gradFrom, gradTo, glowColor] = bandColors(score);
  const gradientId    = `sgv2-${id}`;
  const sparkPath     = buildSparkPath(snaps, size / 2, size / 2, radius - strokeWidth - 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 block"
      aria-label={`AI Score: ${score}`}
    >
      <defs>
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

      {/* Sparkline — ring'in arkasında, band rengiyle */}
      {sparkPath && (
        <path
          d={sparkPath}
          fill="none"
          stroke={gradFrom}
          strokeWidth={1}
          strokeOpacity={0.40}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Arka plan halkası */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#374151" strokeWidth={strokeWidth}
      />

      {/* Progress halkası */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
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

      {/* Skor rakamı — band rengiyle */}
      <text
        x="50%" y="45%"
        textAnchor="middle" dominantBaseline="central"
        fill={gradFrom} fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize={size * 0.32}
      >
        {score}
      </text>

      {/* "AI Score:" etiketi — rakamın altında, ring içinde */}
      <text
        x="50%" y="68%"
        textAnchor="middle" dominantBaseline="central"
        fill="rgb(var(--text-t3))"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize={size * 0.13}
        letterSpacing="0.04em"
      >
        AI Score:
      </text>
    </svg>
  );
}
