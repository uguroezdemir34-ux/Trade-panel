"use client";

/**
 * SCORE GAUGE — 270° metallic speedometer.
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
  /* color: used for needle, hub shine, score text — threshold-based (per original logic) */
  const color = v >= threshold ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";
  /* progressColor: used only for progress arc — must match 2-zone layout (goThreshold boundary) */
  const progressColor = v >= goThreshold ? "#22c55e" : "#ef4444";

  /* Needle tip — DO NOT CHANGE */
  const [nx, ny]     = pt(v, R - 8);

  /* Threshold ticks */
  const [tt1x, tt1y] = pt(threshold, R - SW / 2 - 3);
  const [tt2x, tt2y] = pt(threshold, R + SW / 2 + 10);
  const hasClassic   = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 2);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 7);

  /* Tapered needle polygon — wider at hub, tapers to tip */
  const needleRad = ((-135 + 2.7 * v) - 90) * Math.PI / 180;
  const perpRad   = needleRad + Math.PI / 2;
  const bw = 4.2;
  const blx = (CX + bw * Math.cos(perpRad)).toFixed(1);
  const bly = (CY + bw * Math.sin(perpRad)).toFixed(1);
  const brx = (CX - bw * Math.cos(perpRad)).toFixed(1);
  const bry = (CY - bw * Math.sin(perpRad)).toFixed(1);
  const needlePoly = `M ${blx} ${bly} L ${nx.toFixed(1)} ${ny.toFixed(1)} L ${brx} ${bry} Z`;

  /* Highlight strip along needle spine (narrow center polygon) */
  const hw = 0.9;
  const hlx = (CX + hw * Math.cos(perpRad)).toFixed(1);
  const hly = (CY + hw * Math.sin(perpRad)).toFixed(1);
  const hrx = (CX - hw * Math.cos(perpRad)).toFixed(1);
  const hry = (CY - hw * Math.sin(perpRad)).toFixed(1);
  const needleSpine = `M ${hlx} ${hly} L ${nx.toFixed(1)} ${ny.toFixed(1)} L ${hrx} ${hry} Z`;

  /*
   * Bezel ring highlight arc — at r=95, from 210° to 315° (SVG convention,
   * y-down), clockwise. This spans the top-left to top-right quadrant of the
   * ring where a light source from above-left would create a catch-light.
   * 210°: x=27.7  y=60.5   315°: x=177.2  y=40.8
   */
  const ringHiPath = "M 27.7 60.5 A 95 95 0 0 1 177.2 40.8";

  /*
   * Shadow arc — lower-right, from 30° to 60°.
   * 30°: x=192.3 y=155.5   60°: x=157.5 y=190.3
   */
  const ringShadowPath = "M 192.3 155.5 A 95 95 0 0 1 157.5 190.3";

  return (
    <svg
      viewBox="0 0 220 232"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      <defs>
        {/*
          Ring gradient: 135° (top-left → bottom-right).
          x1="0%" y1="0%" x2="100%" y2="100%" maps to TL→BR in SVG space.
          Highlight: #9a8a68  Mid: #5a4e3a  Shadow: #26201a
        */}
        <linearGradient id="sg-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#9a8a68" />
          <stop offset="18%"  stopColor="#7a6a50" />
          <stop offset="35%"  stopColor="#5a4e3a" />
          <stop offset="55%"  stopColor="#3e3428" />
          <stop offset="75%"  stopColor="#2e261e" />
          <stop offset="90%"  stopColor="#26201a" />
          <stop offset="100%" stopColor="#1c1610" />
        </linearGradient>

        {/* Outer dark collar behind ring */}
        <linearGradient id="sg-outer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#18120a" />
          <stop offset="50%"  stopColor="#0e0a06" />
          <stop offset="100%" stopColor="#060402" />
        </linearGradient>

        {/*
          Glass face — dome radialGradient.
          Centre slightly bright (#1b1e23) → darkens toward edge (#0a0b0d).
          cx/cy offset gives the impression of curvature catching light from upper-left.
        */}
        <radialGradient id="sg-glass" cx="42%" cy="33%" r="68%">
          <stop offset="0%"   stopColor="#1b1e23" />
          <stop offset="48%"  stopColor="#131519" />
          <stop offset="100%" stopColor="#0a0b0d" />
        </radialGradient>

        {/* Edge vignette — deepens perimeter */}
        <radialGradient id="sg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="48%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>

        {/* Chrome hub — bright top-left, dark bottom-right */}
        <radialGradient id="sg-hub" cx="30%" cy="25%" r="75%">
          <stop offset="0%"   stopColor="#dcdde0" />
          <stop offset="38%"  stopColor="#989aa0" />
          <stop offset="100%" stopColor="#3a3d42" />
        </radialGradient>

        {/* Needle drop-shadow only — no color spread */}
        <filter id="sg-drop" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5"
            floodColor="#000" floodOpacity="0.72" />
        </filter>

        {/* Score text: depth shadow only, zero glow spread */}
        <filter id="sg-text-depth" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.8"
            floodColor="#000" floodOpacity="0.85" />
        </filter>

        {/* Progress arc: very subtle shadow (NOT a blur glow) */}
        <filter id="sg-arc-shadow" x="-8%" y="-8%" width="116%" height="116%">
          <feDropShadow dx="0" dy="0" stdDeviation="1"
            floodColor="#000" floodOpacity="0.40" />
        </filter>
      </defs>

      {/* ── Outermost dark disk */}
      <circle cx={CX} cy={CY} r={107} fill="#030404" />

      {/* ── Dark outer collar */}
      <circle cx={CX} cy={CY} r={101} fill="none" stroke="url(#sg-outer)" strokeWidth="5" />

      {/* ── Main bezel ring — smoky grey-bronze */}
      <circle cx={CX} cy={CY} r={95} fill="none" stroke="url(#sg-metal)" strokeWidth="13" />

      {/* ── Highlight arc: top-left catch-light on ring (210°→315°, CW) */}
      <path
        d={ringHiPath}
        fill="none" stroke="#c8b890" strokeWidth="1.4"
        strokeLinecap="round" opacity="0.32"
      />

      {/* ── Shadow arc: bottom-right of ring (30°→60°, CW) */}
      <path
        d={ringShadowPath}
        fill="none" stroke="#0a0806" strokeWidth="2"
        strokeLinecap="round" opacity="0.55"
      />

      {/* ── Groove: dark inset channel between ring and face */}
      <circle cx={CX} cy={CY} r={88}   fill="none" stroke="#09090c" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={86.5} fill="none" stroke="#242630" strokeWidth="0.6" />

      {/* ── Glass dome face */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-glass)" />

      {/* ── Vignette */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-vignette)" />

      {/* ── Glass dome highlight — white ellipse stroke, upper third of face */}
      <ellipse
        cx={CX} cy={CY - 32}
        rx={50} ry={18}
        fill="none"
        stroke="#ffffff" strokeWidth="11"
        opacity="0.10"
        strokeLinecap="round"
      />

      {/* ── Track background (270° channel) */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#07080e" strokeWidth={SW + 5} />
      <path d={arcPath(0, 100, R)} fill="none" stroke="#05060a" strokeWidth={SW + 2} />

      {/* ── Zone 0 → goThreshold: RED — below classic GO level, no signal */}
      {/* Split = goThreshold prop (the baseline 80; separate from pullback-adjusted threshold) */}
      <path
        d={arcPath(0, goThreshold, R)}
        fill="none" stroke="#7a1f1f" strokeWidth={4} strokeLinecap="butt"
      />
      <path
        d={arcPath(0, goThreshold, R)}
        fill="none" stroke="#b02a2a" strokeWidth={2} strokeLinecap="butt"
      />

      {/* ── Zone goThreshold → 100: GREEN — at/above classic GO level, signal confirmed */}
      <path
        d={arcPath(goThreshold, 100, R)}
        fill="none" stroke="#1f5a2a" strokeWidth={4} strokeLinecap="butt"
      />
      <path
        d={arcPath(goThreshold, 100, R)}
        fill="none" stroke="#2a8040" strokeWidth={2} strokeLinecap="butt"
      />

      {/* ── Active progress arc — uses progressColor (goThreshold-based) not color */}
      {v >= 1 && (
        <path
          d={arcPath(0, v, R)}
          fill="none"
          stroke={progressColor}
          strokeWidth={3}
          strokeLinecap="butt"
          filter="url(#sg-arc-shadow)"
        />
      )}

      {/* ── Minor ticks (every 5 units) */}
      {Array.from({ length: 19 }, (_, i) => {
        const n = (i + 1) * 5;
        if (n % 10 === 0) return null;
        const [xa, ya] = pt(n, R + 8);
        const [xb, yb] = pt(n, R + 13);
        return (
          <line key={`mt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#6b7280" strokeWidth="1"
          />
        );
      })}

      {/* ── Sub-minor ticks (every 2 units) */}
      {Array.from({ length: 49 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 5 === 0) return null;
        const [xa, ya] = pt(n, R + 9);
        const [xb, yb] = pt(n, R + 11);
        return (
          <line key={`smt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#38404e" strokeWidth="0.6"
          />
        );
      })}

      {/* ── Major ticks + labels — ALL soft white #c2c7cd, NO red ever */}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 7);
        const [xb, yb] = pt(n, R + 16);
        const [lx, ly] = pt(n, R + 24);
        return (
          <g key={`tk${n}`}>
            <line
              x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke="#cbd0d6" strokeWidth="2"
            />
            <text
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#c2c7cd"
              fontSize="7.5"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {n}
            </text>
          </g>
        );
      })}

      {/* ── Threshold tick (GO marker) */}
      <line
        x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)}
        x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        stroke="#ffffff" strokeWidth="1.8" opacity="0.62"
      />

      {/* ── Classic threshold (pullback — dashed) */}
      {hasClassic && (
        <line
          x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#ffffff" strokeWidth="1" opacity="0.28" strokeDasharray="2 2"
        />
      )}

      {/* ── NEEDLE — metallic tapered blade */}
      {/* Drop shadow lifts needle off face surface */}
      <path d={needlePoly} fill="#000" opacity="0.52" filter="url(#sg-drop)" />
      {/* Dark grey base — flat mid-tone body */}
      <path d={needlePoly} fill="#585c62" />
      {/* Mid-tone layer adds volume */}
      <path d={needlePoly} fill="#8a8e96" opacity="0.65" />
      {/* Bright center spine — simulates concave grind, catchlight from above */}
      <path d={needleSpine} fill="#e0e2e8" opacity="0.78" />
      {/* Thin dark bevel edge — separates needle from face */}
      <path d={needlePoly} fill="none" stroke="#1c1e24" strokeWidth="0.7" />

      {/* ── CENTER HUB — chrome dome */}
      <circle cx={CX} cy={CY} r="9.5"  fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r="5.5"  fill="#121416" />
      <circle cx={CX} cy={CY} r="5.5"  fill="none" stroke="#72747a" strokeWidth="0.9" />
      <circle cx={CX - 2.5} cy={CY - 2.5} r="1.4" fill="#fff" opacity="0.42" />

      {/*
        ── SCORE NUMBER — sits BELOW the gauge disc, bottom-left corner.
        At y=222 the outer disk (r=107, cy=108) does not cover x<56, so this
        area is transparent SVG — the card background shows through.
        Proof: (28-110)²+(222-108)²=6724+12996=19720 > 107²=11449.
      */}
      <text
        x={28} y={222}
        textAnchor="start"
        fill={color}
        stroke="#08090c" strokeWidth="5"
        paintOrder="stroke fill"
        fontSize="44" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        filter="url(#sg-text-depth)"
      >
        {v}
      </text>
    </svg>
  );
}
