"use client";

interface Props {
  score: number;
  goThreshold: number;
  snaps?: number[];
  size?: number;
  id?: string;
}

function bandColors(score: number): [string, string, string] {
  if (score >= 80) return ["#2dd4bf", "#4ade80", "#4ade80"];
  if (score >= 60) return ["#60a5fa", "#818cf8", "#818cf8"];
  if (score >= 40) return ["#f59e0b", "#fbbf24", "#fbbf24"];
  if (score >= 30) return ["#a78bfa", "#c084fc", "#c084fc"];
  return ["#f87171", "#ef4444", "#f87171"];
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
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: gradFrom }}>
        AI Score:
      </span>
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
            strokeOpacity={0.25}
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

        {/* Ortadaki skor rakamı */}
        <text
          x="50%" y="50%"
          textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fontSize={size * 0.32}
        >
          {score}
        </text>
      </svg>
    </div>
  );
}
