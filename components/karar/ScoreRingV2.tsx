"use client";
import { memo } from "react";
import { useSettingsStore } from "@/lib/store/settingsStore";

interface Props {
  score: number;
  goThreshold: number;
  snaps?: number[];
  size?: number;
  id?: string;
}

// isDark is injected by the public ScoreRingV2 wrapper so the comparator can see it
interface InternalProps extends Props {
  isDark: boolean;
}

function blendColor(base: string, tint: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [br, bg, bb] = parse(base);
  const [tr, tg, tb] = parse(tint);
  const r = Math.round(br + (tr - br) * t);
  const g = Math.round(bg + (tg - bg) * t);
  const b = Math.round(bb + (tb - bb) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function bandColors(score: number): [string, string, string, boolean] {
  if (score >= 80) return ["#D4AF37", "#F0CC55", "#D4AF37", false]; // gold
  if (score >= 60) return ["#3F9C93", "#5CBAB0", "#3F9C93", false]; // sapphire
  if (score >= 40) return ["#C08A3E", "#DCA65A", "#C08A3E", false]; // bronze
  if (score >= 30) return ["#C4607E", "#E08AA8", "#C4607E", true];  // wine  (glow boost)
  return ["#D44E65", "#F0708A", "#D44E65", true];                   // crimson (glow boost)
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

function ScoreRingV2Impl({
  score,
  goThreshold: _goThreshold,
  snaps = [],
  size = 60,
  id = "ring2",
  isDark,
}: InternalProps): React.ReactElement {
  const strokeWidth   = 6;
  const bezelStroke   = 4.5;                                    // defined before radius (TDZ-safe)
  const bezelR        = size / 2 - bezelStroke / 2 - 0.5;      // outer edge = 29.5, inside viewBox
  const radius        = (size - strokeWidth) / 2 - bezelStroke - 1; // inset to clear bezel gap
  const circumference = 2 * Math.PI * radius;
  const offset        = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;
  const [gradFrom, gradTo, glowColor, glowBoost] = bandColors(score);
  const gradientId    = `sgv2-${id}`;
  const bezelGradId   = `sgv2-bezel-${id}`;
  const faceGradId    = `sgv2-face-${id}`;
  const specGradId    = `sgv2-spec-${id}`;
  const trackColor    = `${gradFrom}1f`;
  const sparkPath     = buildSparkPath(snaps, size / 2, size / 2, radius - strokeWidth - 1);

  // Bezel gradient stops — base metal + 12% band-color tint for subtle tone shift
  const bezelBase0 = isDark ? "#dde2e8" : "#f4e890";
  const bezelBase1 = isDark ? "#8a9298" : "#c8a838";
  const bezelBase2 = isDark ? "#2e3440" : "#6a5018";
  const bezelStop0 = blendColor(bezelBase0, gradFrom, 0.12);
  const bezelStop1 = blendColor(bezelBase1, gradFrom, 0.12);
  const bezelStop2 = blendColor(bezelBase2, gradFrom, 0.12);
  const bezelStop3 = isDark ? "#14181e" : "#281e04"; // darkest stop — band tint not visible here

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

        {/* Metallic bezel gradient — dark: silver/gunmetal, light: gold/bronze */}
        <linearGradient
          id={bezelGradId}
          x1="0" y1="0"
          x2="0" y2={size}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor={bezelStop0} />
          <stop offset="35%"  stopColor={bezelStop1} />
          <stop offset="70%"  stopColor={bezelStop2} />
          <stop offset="100%" stopColor={bezelStop3} />
        </linearGradient>

        {/* Radial face gradient — dark: cool dark steel, light: warm ivory */}
        <radialGradient
          id={faceGradId}
          cx="50%" cy="42%" r="55%"
          fx="50%" fy="35%"
        >
          <stop offset="0%"   stopColor={isDark ? "#2a2e36" : "#ede8d8"} />
          <stop offset="55%"  stopColor={isDark ? "#1a1e24" : "#d8d0b8"} />
          <stop offset="82%"  stopColor={isDark ? "#07080c" : "#a89060"} />
          <stop offset="100%" stopColor={isDark ? "#030406" : "#8a7040"} />
        </radialGradient>

        {/* Specular radial gradient — white fade, top-left highlight */}
        <radialGradient
          id={specGradId}
          cx={size * 0.40} cy={size * 0.34} r={size * 0.17}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#ffffff" stopOpacity={isDark ? 0.50 : 0.38} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Face — radial gradient metallic inner surface */}
      <circle
        cx={size / 2} cy={size / 2} r={radius - strokeWidth / 2}
        fill={`url(#${faceGradId})`}
      />

      {/* Metallic bezel ring — geometrically outside track/progress gap */}
      <circle
        cx={size / 2} cy={size / 2} r={bezelR}
        fill="none"
        stroke={`url(#${bezelGradId})`}
        strokeWidth={bezelStroke}
        opacity={0.9}
      />

      {/* Sparkline — smooth cubic bezier, auto-scales with radius */}
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

      {/* Track ring — band-tinted groove */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />

      {/* Progress ring — dual glow */}
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
          filter: `drop-shadow(0 0 4px ${glowColor}${glowBoost ? "ff" : "dd"}) drop-shadow(0 0 10px ${glowColor}${glowBoost ? "77" : "55"})`,
        }}
      />

      {/* Specular highlight — top-left metallic reflection, 0.6px inside face edge */}
      <ellipse
        cx={size * 0.40} cy={size * 0.34}
        rx={size * 0.11} ry={size * 0.06}
        fill={`url(#${specGradId})`}
        transform={`rotate(-30 ${size * 0.40} ${size * 0.34})`}
      />

      {/* Emboss highlight — 1.5px offset layer behind main score text */}
      <text
        x={size / 2 - 1.5} y={size / 2 - 1.5}
        textAnchor="middle" dominantBaseline="central"
        fill={isDark ? "#ffffff" : "#fffbe8"}
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize={size * 0.36}
        opacity={0.30}
        aria-hidden
      >
        {score}
      </text>

      {/* Score number — centered, band color + subtle glow */}
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

const ScoreRingV2Memo = memo(ScoreRingV2Impl, (prev, next) =>
  prev.score === next.score &&
  prev.goThreshold === next.goThreshold &&
  prev.size === next.size &&
  prev.id === next.id &&
  prev.snaps === next.snaps &&
  prev.isDark === next.isDark
);

export function ScoreRingV2(props: Props): React.ReactElement {
  const isDark = useSettingsStore((s) => s.theme) === "dark";
  return <ScoreRingV2Memo {...props} isDark={isDark} />;
}
