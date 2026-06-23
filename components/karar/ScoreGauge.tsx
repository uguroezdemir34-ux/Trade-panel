"use client";

/**
 * SCORE GAUGE — 270° professional financial instrument gauge.
 * Prop interface unchanged: { score, threshold, goThreshold }
 *
 * Geometry: viewBox 220×196, centre (110,108), track radius R=66.
 * Sweep: s=0 → 7-o'clock (bottom-left), s=50 → 12-o'clock (top),
 *        s=100 → 5-o'clock (bottom-right). Total 270°.
 * DO NOT edit pt() / arcPath() / needle angle — score binding is correct.
 */

interface Props {
  score: number;
  threshold: number;
  goThreshold: number;
}

const CX = 110;
const CY = 108;
const R  = 66;
const SW = 8;

function pt(s: number, r: number): [number, number] {
  const deg = -135 + 2.7 * s;
  const rad = (deg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(from: number, to: number, r: number): string {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to,   r);
  const large = (to - from) * 2.7 > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function ScoreGauge({ score, threshold, goThreshold }: Props): React.ReactElement {
  const v = Math.max(0, Math.min(100, score));

  /* Active arc color: green if above goThreshold, red below */
  const progressColor = v >= goThreshold ? "#16a34a" : "#dc2626";

  /* Score text + needle color based on threshold */
  const scoreColor = v >= threshold ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

  /* Needle geometry — DO NOT CHANGE */
  const [nx, ny]     = pt(v, R - 6);
  const needleRad    = ((-135 + 2.7 * v) - 90) * Math.PI / 180;
  const perpRad      = needleRad + Math.PI / 2;
  const bw = 2.8;
  const blx = (CX + bw * Math.cos(perpRad)).toFixed(1);
  const bly = (CY + bw * Math.sin(perpRad)).toFixed(1);
  const brx = (CX - bw * Math.cos(perpRad)).toFixed(1);
  const bry = (CY - bw * Math.sin(perpRad)).toFixed(1);
  const needlePoly  = `M ${blx} ${bly} L ${nx.toFixed(1)} ${ny.toFixed(1)} L ${brx} ${bry} Z`;

  /* Threshold ticks */
  const [tt1x, tt1y] = pt(threshold, R - SW / 2 - 4);
  const [tt2x, tt2y] = pt(threshold, R + SW / 2 + 11);
  const hasClassic   = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 3);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 8);

  return (
    <svg
      viewBox="0 0 220 232"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      <defs>
        {/* Steel bezel — cool blue-grey metallic */}
        <linearGradient id="sg-bezel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#6b7a8d" />
          <stop offset="20%"  stopColor="#8a9ab0" />
          <stop offset="42%"  stopColor="#4a5568" />
          <stop offset="62%"  stopColor="#2d3748" />
          <stop offset="82%"  stopColor="#1a2030" />
          <stop offset="100%" stopColor="#111828" />
        </linearGradient>

        {/* Outer collar — near-black */}
        <linearGradient id="sg-collar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#0d1117" />
          <stop offset="100%" stopColor="#060a0f" />
        </linearGradient>

        {/* Face — deep navy dome */}
        <radialGradient id="sg-face" cx="40%" cy="32%" r="70%">
          <stop offset="0%"   stopColor="#0f1623" />
          <stop offset="50%"  stopColor="#090e18" />
          <stop offset="100%" stopColor="#060810" />
        </radialGradient>

        {/* Vignette */}
        <radialGradient id="sg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.60" />
        </radialGradient>

        {/* Hub — polished steel */}
        <radialGradient id="sg-hub" cx="28%" cy="22%" r="78%">
          <stop offset="0%"   stopColor="#c8cdd6" />
          <stop offset="35%"  stopColor="#8090a8" />
          <stop offset="100%" stopColor="#2a3340" />
        </radialGradient>

        {/* Needle glow filter */}
        <filter id="sg-needle-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="0" stdDeviation="2"
            floodColor={scoreColor} floodOpacity="0.55" />
        </filter>

        {/* Active arc glow */}
        <filter id="sg-arc-glow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="0" stdDeviation="3"
            floodColor={progressColor} floodOpacity="0.50" />
        </filter>

        {/* Score text shadow */}
        <filter id="sg-score-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2"
            floodColor="#000" floodOpacity="0.90" />
        </filter>

        {/* Bezel highlight arc — top-left catch-light */}
        {/* (210° → 315° CW, r=95) 27.7,60.5 → 177.2,40.8 */}
      </defs>

      {/* ── Outermost dark disk */}
      <circle cx={CX} cy={CY} r={107} fill="#04060c" />

      {/* ── Dark collar */}
      <circle cx={CX} cy={CY} r={101} fill="none" stroke="url(#sg-collar)" strokeWidth="5" />

      {/* ── Steel bezel ring */}
      <circle cx={CX} cy={CY} r={95} fill="none" stroke="url(#sg-bezel)" strokeWidth="12" />

      {/* ── Bezel catch-light — top-left */}
      <path
        d="M 27.7 60.5 A 95 95 0 0 1 177.2 40.8"
        fill="none" stroke="#a0b4cc" strokeWidth="1.2"
        strokeLinecap="round" opacity="0.28"
      />

      {/* ── Bezel shadow — bottom-right */}
      <path
        d="M 192.3 155.5 A 95 95 0 0 1 157.5 190.3"
        fill="none" stroke="#020408" strokeWidth="2"
        strokeLinecap="round" opacity="0.60"
      />

      {/* ── Inner groove */}
      <circle cx={CX} cy={CY} r={88}   fill="none" stroke="#080c14" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={86.5} fill="none" stroke="#1e2a3a" strokeWidth="0.7" />

      {/* ── Deep navy face */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-face)" />

      {/* ── Subtle dome highlight — upper glass sheen */}
      <ellipse
        cx={CX} cy={CY - 30}
        rx={46} ry={16}
        fill="none"
        stroke="#ffffff" strokeWidth="10"
        opacity="0.04"
        strokeLinecap="round"
      />

      {/* ── Vignette */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-vignette)" />

      {/* ── Track channel background */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#050810" strokeWidth={SW + 6} />
      <path d={arcPath(0, 100, R)} fill="none" stroke="#0a0f1c" strokeWidth={SW + 3} />

      {/* ── Zone 0 → goThreshold: dim red band */}
      <path
        d={arcPath(0, goThreshold, R)}
        fill="none" stroke="#3b0e0e" strokeWidth={SW}
        strokeLinecap="butt"
      />

      {/* ── Zone goThreshold → 100: dim green band */}
      <path
        d={arcPath(goThreshold, 100, R)}
        fill="none" stroke="#0a2e14" strokeWidth={SW}
        strokeLinecap="butt"
      />

      {/* ── Zone border line */}
      {(() => {
        const [zx1, zy1] = pt(goThreshold, R - SW / 2 - 1);
        const [zx2, zy2] = pt(goThreshold, R + SW / 2 + 1);
        return (
          <line
            x1={zx1.toFixed(1)} y1={zy1.toFixed(1)}
            x2={zx2.toFixed(1)} y2={zy2.toFixed(1)}
            stroke="#1e2a3a" strokeWidth="1.5"
          />
        );
      })()}

      {/* ── Active progress arc — colored, with glow */}
      {v >= 1 && (
        <path
          d={arcPath(0, v, R)}
          fill="none"
          stroke={progressColor}
          strokeWidth={SW - 2}
          strokeLinecap="butt"
          filter="url(#sg-arc-glow)"
          opacity="0.92"
        />
      )}

      {/* ── Sub-minor ticks (every 2 units) */}
      {Array.from({ length: 49 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 5 === 0) return null;
        const [xa, ya] = pt(n, R + 10);
        const [xb, yb] = pt(n, R + 12);
        return (
          <line key={`smt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#2a3548" strokeWidth="0.6"
          />
        );
      })}

      {/* ── Minor ticks (every 5 units) */}
      {Array.from({ length: 19 }, (_, i) => {
        const n = (i + 1) * 5;
        if (n % 10 === 0) return null;
        const [xa, ya] = pt(n, R + 9);
        const [xb, yb] = pt(n, R + 14);
        return (
          <line key={`mt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#4a5a72" strokeWidth="1"
          />
        );
      })}

      {/* ── Major ticks + labels */}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 8);
        const [xb, yb] = pt(n, R + 17);
        const [lx, ly] = pt(n, R + 26);
        return (
          <g key={`tk${n}`}>
            <line
              x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke="#6b7e96" strokeWidth="1.8"
            />
            <text
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#7a8fa8"
              fontSize="7"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              letterSpacing="0"
            >
              {n}
            </text>
          </g>
        );
      })}

      {/* ── Threshold tick (effective threshold — solid white line) */}
      <line
        x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)}
        x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        stroke="#e2e8f0" strokeWidth="1.6" opacity="0.55"
      />

      {/* ── Classic / GO threshold (dashed) */}
      {hasClassic && (
        <line
          x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#e2e8f0" strokeWidth="1" opacity="0.25" strokeDasharray="2 2"
        />
      )}

      {/* ── NEEDLE — thin precision blade with color glow */}
      {/* Shadow */}
      <path d={needlePoly} fill="#000" opacity="0.45"
        style={{ filter: "drop-shadow(0 2px 2px #000)" }} />
      {/* Body: dark steel */}
      <path d={needlePoly} fill="#4a5568" />
      {/* Top surface: lighter steel */}
      <path d={needlePoly} fill="#94a3b8" opacity="0.55" />
      {/* Spine highlight */}
      {(() => {
        const hw = 0.7;
        const hlx = (CX + hw * Math.cos(perpRad)).toFixed(1);
        const hly = (CY + hw * Math.sin(perpRad)).toFixed(1);
        const hrx = (CX - hw * Math.cos(perpRad)).toFixed(1);
        const hry = (CY - hw * Math.sin(perpRad)).toFixed(1);
        return (
          <path
            d={`M ${hlx} ${hly} L ${nx.toFixed(1)} ${ny.toFixed(1)} L ${hrx} ${hry} Z`}
            fill="#cbd5e1" opacity="0.65"
            filter="url(#sg-needle-glow)"
          />
        );
      })()}
      {/* Edge bevel */}
      <path d={needlePoly} fill="none" stroke="#1e2535" strokeWidth="0.6" />

      {/* ── CENTER HUB — polished steel dome */}
      <circle cx={CX} cy={CY} r="10"  fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r="5.5" fill="#0c1018" />
      <circle cx={CX} cy={CY} r="5.5" fill="none" stroke="#4a5a72" strokeWidth="0.8" />
      {/* Hub specular */}
      <circle cx={CX - 2.8} cy={CY - 2.8} r="1.6" fill="#fff" opacity="0.35" />

      {/* ── SCORE NUMBER — bottom-left, outside disk */}
      <text
        x={28} y={222}
        textAnchor="start"
        fill={scoreColor}
        stroke="#04060c" strokeWidth="5"
        paintOrder="stroke fill"
        fontSize="44" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        filter="url(#sg-score-shadow)"
      >
        {v}
      </text>
    </svg>
  );
}
