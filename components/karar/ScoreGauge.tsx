"use client";

/**
 * SCORE GAUGE — 270° metallic speedometer.
 * Prop interface unchanged: { score, threshold, goThreshold }
 *
 * Geometry: viewBox 220×200, centre (110,112), track radius R=68.
 * Sweep: s=0 → 7-o'clock (bottom-left), s=50 → 12-o'clock (top),
 *        s=100 → 5-o'clock (bottom-right). Total 270°.
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

  const [nx, ny]     = pt(v, R - 8);
  const [tt1x, tt1y] = pt(threshold, R - SW / 2 - 3);
  const [tt2x, tt2y] = pt(threshold, R + SW / 2 + 10);

  const hasClassic = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 2);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 7);

  return (
    <svg
      viewBox="0 0 220 196"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      <defs>
        {/* Rich bronze / gold metallic ring — 3-D banded look */}
        <linearGradient id="sg-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#0e0900" />
          <stop offset="8%"   stopColor="#4a3008" />
          <stop offset="20%"  stopColor="#9a6820" />
          <stop offset="32%"  stopColor="#d4a030" />
          <stop offset="42%"  stopColor="#f0c848" />
          <stop offset="50%"  stopColor="#ffd84e" />
          <stop offset="58%"  stopColor="#e8b83a" />
          <stop offset="70%"  stopColor="#c08828" />
          <stop offset="82%"  stopColor="#7a5018" />
          <stop offset="92%"  stopColor="#3a2008" />
          <stop offset="100%" stopColor="#0e0900" />
        </linearGradient>

        {/* Outer edge — very dark ring behind bronze */}
        <linearGradient id="sg-outer-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#1a1200" />
          <stop offset="50%"  stopColor="#2e2000" />
          <stop offset="100%" stopColor="#0a0800" />
        </linearGradient>

        {/* Dark glass face */}
        <radialGradient id="sg-glass" cx="40%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#252830" stopOpacity="0.95" />
          <stop offset="40%"  stopColor="#0e1016" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#060709" />
        </radialGradient>

        {/* Subtle inner-face vignette — deepens edges */}
        <radialGradient id="sg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>

        {/* Metallic center hub */}
        <radialGradient id="sg-hub" cx="35%" cy="28%" r="68%">
          <stop offset="0%"   stopColor="#d0d0d0" />
          <stop offset="40%"  stopColor="#808080" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>

        {/* Glow for progress arc + score + needle tint */}
        <filter id="sg-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Softer glow for score text */}
        <filter id="sg-glow-text" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Drop shadow for needle */}
        <filter id="sg-drop" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="1" dy="1.5" stdDeviation="1.8" floodColor="#000" floodOpacity="0.75" />
        </filter>

        {/* Ring inner bevel — bright highlight arc */}
        <filter id="sg-ring-shine" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Outermost dark disk */}
      <circle cx={CX} cy={CY} r={107} fill="#050608" />

      {/* ── Bronze metallic ring — darker outer edge */}
      <circle cx={CX} cy={CY} r={100} fill="none" stroke="url(#sg-outer-ring)" strokeWidth="6" />

      {/* ── Main bronze ring (thick, bright gradient) */}
      <circle cx={CX} cy={CY} r={95} fill="none" stroke="url(#sg-metal)" strokeWidth="12" />

      {/* ── Ring highlight — top-left arc glint */}
      <path
        d={`M ${(CX - 65).toFixed(1)} ${(CY - 55).toFixed(1)} A 88 88 0 0 1 ${(CX + 20).toFixed(1)} ${(CY - 87).toFixed(1)}`}
        fill="none" stroke="#ffe87a" strokeWidth="2.5"
        strokeLinecap="round" opacity="0.22"
        filter="url(#sg-ring-shine)"
      />

      {/* ── Inner bezel — dark groove (depth illusion) */}
      <circle cx={CX} cy={CY} r={88} fill="none" stroke="#040506" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={86} fill="none" stroke="#1a1c22" strokeWidth="1" />

      {/* ── Glass gauge face */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-glass)" />

      {/* ── Vignette over face for edge depth */}
      <circle cx={CX} cy={CY} r={85} fill="url(#sg-vignette)" />

      {/* ── Track background (full 270° shadow arc) */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#12151c" strokeWidth={SW + 4} />
      <path d={arcPath(0, 100, R)} fill="none" stroke="#0a0c12" strokeWidth={SW + 1} />

      {/* ── Zone 0 → threshold (dim green — normal region) */}
      <path
        d={arcPath(0, Math.min(threshold, 80), R)}
        fill="none" stroke="#0d3820" strokeWidth={SW - 2} strokeLinecap="butt"
      />

      {/* ── Zone threshold → 80 (dim amber — only when threshold < 80) */}
      {threshold < 80 && (
        <path
          d={arcPath(threshold, 80, R)}
          fill="none" stroke="#3d2200" strokeWidth={SW - 2} strokeLinecap="butt"
        />
      )}

      {/* ── Zone 80 → 100 (dim red — danger) */}
      <path
        d={arcPath(80, 100, R)}
        fill="none" stroke="#3a0a0a" strokeWidth={SW - 2} strokeLinecap="butt"
      />

      {/* ── Active progress arc (0 → score, score color + glow) */}
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
            stroke="#3e4456" strokeWidth="1"
          />
        );
      })}

      {/* ── Sub-minor tick marks (every 2 units, skip 5 & 10 multiples) */}
      {Array.from({ length: 49 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 5 === 0) return null;
        const [xa, ya] = pt(n, R + 9);
        const [xb, yb] = pt(n, R + 11);
        return (
          <line key={`smt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#2a2e3a" strokeWidth="0.7"
          />
        );
      })}

      {/* ── Major tick marks + labels (every 10 units) */}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 7);
        const [xb, yb] = pt(n, R + 15);
        const [lx, ly] = pt(n, R + 23);
        const isRed = n >= 80;
        const isGreen = n < threshold;
        const labelColor = isRed ? "#b03030" : isGreen ? "#2a6040" : "#566070";
        const tickColor  = isRed ? "#cc4444" : "#6a7280";
        return (
          <g key={`tk${n}`}>
            <line
              x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke={tickColor}
              strokeWidth="1.8"
            />
            <text
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill={labelColor}
              fontSize="7.5"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {n}
            </text>
          </g>
        );
      })}

      {/* ── Threshold tick (GO marker — white line) */}
      <line
        x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)}
        x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        stroke="#ffffff" strokeWidth="1.8" opacity="0.7"
      />

      {/* ── Classic threshold (pullback mode — dashed, dimmer) */}
      {hasClassic && (
        <line
          x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#ffffff" strokeWidth="1" opacity="0.30" strokeDasharray="2 2"
        />
      )}

      {/* ── Concentric ring lines inside track — depth detail */}
      <circle cx={CX} cy={CY} r={R + 4} fill="none" stroke="#ffffff" strokeWidth="0.3" opacity="0.04" />
      <circle cx={CX} cy={CY} r={R - 5} fill="none" stroke="#ffffff" strokeWidth="0.3" opacity="0.03" />

      {/* ── Glass top highlight (dome reflection) */}
      <path
        d={`M ${CX - 48} ${CY - 44} Q ${CX} ${CY - 72} ${CX + 48} ${CY - 44}`}
        fill="none" stroke="#ffffff" strokeWidth="5"
        strokeLinecap="round" opacity="0.055"
      />
      {/* Secondary softer dome glow */}
      <path
        d={`M ${CX - 30} ${CY - 50} Q ${CX} ${CY - 68} ${CX + 30} ${CY - 50}`}
        fill="none" stroke="#ffffff" strokeWidth="2"
        strokeLinecap="round" opacity="0.035"
      />

      {/* ── Needle — tapered: full line + thin overlay */}
      {/* Shadow underneath */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke="#000" strokeWidth="3" strokeLinecap="round"
        opacity="0.5" filter="url(#sg-drop)"
      />
      {/* Main silver needle */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke="#d8d8d8" strokeWidth="1.8" strokeLinecap="round"
      />
      {/* Color tint overlay */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke={color} strokeWidth="0.9" strokeLinecap="round"
        opacity="0.5" filter="url(#sg-glow)"
      />
      {/* Bright needle spine */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke="#ffffff" strokeWidth="0.5" strokeLinecap="round"
        opacity="0.35"
      />

      {/* ── Center hub */}
      <circle cx={CX} cy={CY} r="8"   fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r="4.5" fill="#0a0a0a" />
      <circle cx={CX} cy={CY} r="4.5" fill="none" stroke="#999" strokeWidth="0.7" />
      {/* Hub shine dot */}
      <circle cx={CX - 2} cy={CY - 2} r="1.2" fill="#fff" opacity="0.4" />

      {/* ── Score number — large, centered lower face */}
      <text
        x={CX} y={CY + 36}
        textAnchor="middle"
        fill={color}
        stroke="#060709" strokeWidth="6"
        paintOrder="stroke fill"
        fontSize="44" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        filter="url(#sg-glow-text)"
      >
        {v}
      </text>

      {/* ── Score label underneath — tiny "/100" */}
      <text
        x={CX} y={CY + 50}
        textAnchor="middle"
        fill={color}
        fontSize="7"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        opacity="0.5"
      >
        /100
      </text>
    </svg>
  );
}
