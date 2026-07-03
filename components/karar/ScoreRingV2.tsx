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

  const pts = snaps.map((v, i) => ({
    x: x0 + (i / (snaps.length - 1)) * w,
    y: y0 - ((v - min) / range) * h,
  }));

  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C${cpx},${prev.y.toFixed(1)} ${cpx},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
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
  const trackColor    = `${gradFrom}1f`; // band rengi %12 — hafif parlayan yiv
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

      {/* Sparkline — smooth cubic bezier */}
      {sparkPath && (
        <path
          d={sparkPath}
          fill="none"
          stroke={gradFrom}
          strokeWidth={1}
          strokeOpacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Track halkası — band rengiyle tonlanmış yiv */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />

      {/* Progress halkası — güçlü çift glow */}
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
          filter: `drop-shadow(0 0 4px ${glowColor}dd) drop-shadow(0 0 10px ${glowColor}55)`,
        }}
      />

      {/* Skor rakamı — tam orta, band rengi + subtle glow */}
      <text
        x="50%" y="50%"
        textAnchor="middle" dominantBaseline="central"
        fill={gradFrom}
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize={size * 0.36}
        style={{ filter: `drop-shadow(0 0 4px ${gradFrom}88)` }}
      >
        {score}
      </text>
    </svg>
  );
}
