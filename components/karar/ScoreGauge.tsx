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
  const color = v >= threshold ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

  /* Needle tip — DO NOT CHANGE */
  const [nx, ny]     = pt(v, R - 8);

  /* Threshold ticks */
  const [tt1x, tt1y] = pt(threshold, R - SW / 2 - 3);
  const [tt2x, tt2y] = pt(threshold, R + SW / 2 + 10);
  const hasClassic   = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 2);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 7);

  /* Tapered needle polygon (wider at hub, narrows to tip) */
  const needleRad = ((-135 + 2.7 * v) - 90) * Math.PI / 180;
  const perpRad   = needleRad + Math.PI / 2;
  const bw = 3.4;
  const blx = (CX + bw * Math.cos(perpRad)).toFixed(1);
  const bly = (CY + bw * Math.sin(perpRad)).toFixed(1);
  const brx = (CX - bw * Math.cos(perpRad)).toFixed(1);
  const bry = (CY - bw * Math.sin(perpRad)).toFixed(1);
  const needlePoly = `M ${blx} ${bly} L ${nx.toFixed(1)} ${ny.toFixed(1)} L ${brx} ${bry} Z`;

  return (
    <svg
      viewBox="0 0 220 196"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      <defs>
        {/* Dark bronze/gunmetal ring — sophisticated, NOT bright yellow */}
        <linearGradient id="sg-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#060402" />
          <stop offset="8%"   stopColor="#2c1a06" />
          <stop offset="20%"  stopColor="#5a3610" />
          <stop offset="32%"  stopColor="#7e5220" />
          <stop offset="43%"  stopColor="#9a6828" />
          <stop offset="50%"  stopColor="#a87830" />
          <stop offset="57%"  stopColor="#9a6828" />
          <stop offset="68%"  stopColor="#7a5020" />
          <stop offset="80%"  stopColor="#4e3010" />
          <stop offset="92%"  stopColor="#251606" />
          <stop offset="100%" stopColor="#060402" />
        </linearGradient>

        {/* Outer dark edge behind the ring */}
        <linearGradient id="sg-outer-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#100a02" />
          <stop offset="50%"  stopColor="#1e1206" />
          <stop offset="100%" stopColor="#080502" />
        </linearGradient>

        {/* Dark glass face */}
        <radialGradient id="sg-glass" cx="40%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#252830" stopOpacity="0.95" />
          <stop offset="40%"  stopColor="#0e1016" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#060709" />
        </radialGradient>

        {/* Edge vignette — deepens face perimeter */}
        <radialGradient id="sg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="52%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.50" />
        </radialGradient>

        {/* Metallic center hub */}
        <radialGradient id="sg-hub" cx="35%" cy="28%" r="68%">
          <stop offset="0%"   stopColor="#d0d0d0" />
          <stop offset="40%"  stopColor="#808080" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>

        {/* Glow for progress arc + needle */}
        <filter id="sg-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Glow for score text */}
        <filter id="sg-glow-text" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Red zone glow */}
        <filter id="sg-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Needle drop shadow */}
        <filter id="sg-drop" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
        </filter>

        {/* Ring shine filter */}
        <filter id="sg-ring-shine" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Outermost dark disk */}
      <circle cx={CX} cy={CY} r={107} fill="#040506" />

      {/* ── Dark outer edge before bronze ring */}
      <circle cx={CX} cy={CY} r={101} fill="none" stroke="url(#sg-outer-ring)" strokeWidth="6" />

      {/* ── Main dark-bronze ring (thick) */}
      <circle cx={CX} cy={CY} r={95} fill="none" stroke="url(#sg-metal)" strokeWidth="13" />

      {/* ── Subtle bronze glint arc (top-left catch-light, NOT yellow) */}
      <path
        d={`M ${(CX - 62).toFixed(1)} ${(CY - 52).toFixed(1)} A 88 88 0 0 1 ${(CX + 18).toFixed(1)} ${(CY - 86).toFixed(1)}`}
        fill="none" stroke="#c09050" strokeWidth="2"
        strokeLinecap="round" opacity="0.18"
        filter="url(#sg-ring-shine)"
      />

      {/* ── Inner bezel grooves */}
      <circle cx={CX} cy={CY} r={88} fill="none" stroke="#030406" strokeWidth="3.5" />
      <circle cx={CX} cy={CY} r={86} fill="none" stroke="#1c1e26" strokeWidth="0.8" />

      {/* ── Glass gauge face */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-glass)" />

      {/* ── Vignette overlay — edge depth */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-vignette)" />

      {/* ── Track shadow (full 270° background) */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#0c0e16" strokeWidth={SW + 5} />
      <path d={arcPath(0, 100, R)} fill="none" stroke="#080a10" strokeWidth={SW + 2} />

      {/* ── Zone 0 → threshold (dim green) */}
      <path
        d={arcPath(0, Math.min(threshold, 80), R)}
        fill="none" stroke="#0d3a1e" strokeWidth={SW - 2} strokeLinecap="butt"
      />

      {/* ── Zone threshold → 80 (dim amber) */}
      {threshold < 80 && (
        <path
          d={arcPath(threshold, 80, R)}
          fill="none" stroke="#3e2400" strokeWidth={SW - 2} strokeLinecap="butt"
        />
      )}

      {/* ── DANGER ZONE 80→100: PROMINENT thick red band */}
      {/* Outer dark-red base */}
      <path
        d={arcPath(80, 100, R)}
        fill="none" stroke="#6b0808" strokeWidth={SW} strokeLinecap="butt"
      />
      {/* Inner bright-red core */}
      <path
        d={arcPath(80, 100, R)}
        fill="none" stroke="#cc1414" strokeWidth={SW - 3} strokeLinecap="butt"
        filter="url(#sg-glow-red)"
      />

      {/* ── Active progress arc (0 → score, with glow) */}
      {v >= 1 && (
        <path
          d={arcPath(0, v, R)}
          fill="none"
          stroke={color}
          strokeWidth={SW - 2}
          strokeLinecap="butt"
          filter="url(#sg-glow)"
        />
      )}

      {/* ── Minor tick marks (every 5 units) */}
      {Array.from({ length: 19 }, (_, i) => {
        const n = (i + 1) * 5;
        if (n % 10 === 0) return null;
        const [xa, ya] = pt(n, R + 8);
        const [xb, yb] = pt(n, R + 13);
        return (
          <line key={`mt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#3a3e4e" strokeWidth="1"
          />
        );
      })}

      {/* ── Sub-minor tick marks (every 2 units) */}
      {Array.from({ length: 49 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 5 === 0) return null;
        const [xa, ya] = pt(n, R + 9);
        const [xb, yb] = pt(n, R + 11);
        return (
          <line key={`smt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#252834" strokeWidth="0.6"
          />
        );
      })}

      {/* ── Major ticks + labels — ALL neutral grey, no red numbers */}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 7);
        const [xb, yb] = pt(n, R + 15);
        const [lx, ly] = pt(n, R + 23);
        return (
          <g key={`tk${n}`}>
            <line
              x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke="#6a7080" strokeWidth="1.8"
            />
            <text
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#6a7484"
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
        stroke="#ffffff" strokeWidth="1.8" opacity="0.7"
      />

      {/* ── Classic threshold (pullback — dashed) */}
      {hasClassic && (
        <line
          x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#ffffff" strokeWidth="1" opacity="0.30" strokeDasharray="2 2"
        />
      )}

      {/* ── Glass dome highlights */}
      <path
        d={`M ${CX - 48} ${CY - 44} Q ${CX} ${CY - 72} ${CX + 48} ${CY - 44}`}
        fill="none" stroke="#ffffff" strokeWidth="5"
        strokeLinecap="round" opacity="0.05"
      />
      <path
        d={`M ${CX - 28} ${CY - 52} Q ${CX} ${CY - 66} ${CX + 28} ${CY - 52}`}
        fill="none" stroke="#ffffff" strokeWidth="2"
        strokeLinecap="round" opacity="0.03"
      />

      {/* ── NEEDLE — tapered metallic polygon */}
      {/* Drop shadow */}
      <path d={needlePoly} fill="#000" opacity="0.6" filter="url(#sg-drop)" />
      {/* Body: dark grey base */}
      <path d={needlePoly} fill="#707070" />
      {/* Body highlight: lighter stripe upper half */}
      <path d={needlePoly} fill="#a8a8a8" opacity="0.55" />
      {/* Dark edge bevel */}
      <path d={needlePoly} fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
      {/* Bright center spine */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke="#e8e8e8" strokeWidth="0.8" strokeLinecap="round"
        opacity="0.60"
      />
      {/* Score-color tip glow */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke={color} strokeWidth="1.5" strokeLinecap="round"
        opacity="0.35" filter="url(#sg-glow)"
      />

      {/* ── Center hub */}
      <circle cx={CX} cy={CY} r="8.5" fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r="5"   fill="#080808" />
      <circle cx={CX} cy={CY} r="5"   fill="none" stroke="#aaa" strokeWidth="0.8" />
      <circle cx={CX - 2} cy={CY - 2} r="1.2" fill="#fff" opacity="0.38" />

      {/* ── SCORE NUMBER — bottom-left position (not under needle) */}
      <text
        x={CX - 22} y={CY + 38}
        textAnchor="middle"
        fill={color}
        stroke="#060709" strokeWidth="7"
        paintOrder="stroke fill"
        fontSize="46" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        filter="url(#sg-glow-text)"
      >
        {v}
      </text>

      {/* ── "/100" sub-label, shifted to match score position */}
      <text
        x={CX - 22} y={CY + 52}
        textAnchor="middle"
        fill={color}
        fontSize="7"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        opacity="0.45"
      >
        /100
      </text>
    </svg>
  );
}
