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
const CY = 112;
const R  = 68;
const SW = 7;

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

  const [nx, ny]     = pt(v, R - 10);
  const [tt1x, tt1y] = pt(threshold, R - SW / 2 - 3);
  const [tt2x, tt2y] = pt(threshold, R + SW / 2 + 10);

  const hasClassic = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 2);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 7);

  return (
    <svg
      viewBox="0 0 220 200"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      <defs>
        {/* Bronze / gold metallic ring */}
        <linearGradient id="sg-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#1e1508" />
          <stop offset="18%"  stopColor="#7a5518" />
          <stop offset="40%"  stopColor="#c49028" />
          <stop offset="50%"  stopColor="#e8b83a" />
          <stop offset="62%"  stopColor="#c09030" />
          <stop offset="82%"  stopColor="#7a5518" />
          <stop offset="100%" stopColor="#1e1508" />
        </linearGradient>

        {/* Dark glass face */}
        <radialGradient id="sg-glass" cx="42%" cy="30%" r="68%">
          <stop offset="0%"   stopColor="#22262e" stopOpacity="0.9" />
          <stop offset="55%"  stopColor="#0c0e12" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#080a0d" />
        </radialGradient>

        {/* Metallic center hub */}
        <radialGradient id="sg-hub" cx="35%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#b0b0b0" />
          <stop offset="50%"  stopColor="#606060" />
          <stop offset="100%" stopColor="#1e1e1e" />
        </radialGradient>

        {/* Glow for progress arc + score number + needle tint */}
        <filter id="sg-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Drop shadow for needle */}
        <filter id="sg-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.7" />
        </filter>
      </defs>

      {/* ── Outer dark disk */}
      <circle cx={CX} cy={CY} r={108} fill="#080a0c" />

      {/* ── Bronze metallic ring (thick gradient stroke) */}
      <circle cx={CX} cy={CY} r={97} fill="none" stroke="url(#sg-metal)" strokeWidth="10" />

      {/* ── Inner bezel hairline (dark edge, creates depth) */}
      <circle cx={CX} cy={CY} r={91} fill="none" stroke="#0a0c10" strokeWidth="1.5" />

      {/* ── Glass gauge face */}
      <circle cx={CX} cy={CY} r={90} fill="url(#sg-glass)" />

      {/* ── Track background (full 270° shadow arc) */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#1a1e26" strokeWidth={SW + 2} />

      {/* ── Zone 0 → threshold (dim green — normal region) */}
      <path
        d={arcPath(0, Math.min(threshold, 80), R)}
        fill="none" stroke="#0d3320" strokeWidth={SW - 3} strokeLinecap="butt"
      />

      {/* ── Zone threshold → 80 (dim amber — only when threshold < 80) */}
      {threshold < 80 && (
        <path
          d={arcPath(threshold, 80, R)}
          fill="none" stroke="#3d2000" strokeWidth={SW - 3} strokeLinecap="butt"
        />
      )}

      {/* ── Zone 80 → 100 (dim red — danger) */}
      <path
        d={arcPath(80, 100, R)}
        fill="none" stroke="#3a0808" strokeWidth={SW - 3} strokeLinecap="butt"
      />

      {/* ── Active progress arc (0 → score, score color + glow) */}
      {v >= 1 && (
        <path
          d={arcPath(0, v, R)}
          fill="none"
          stroke={color}
          strokeWidth={SW - 3}
          strokeLinecap="butt"
          filter="url(#sg-glow)"
        />
      )}

      {/* ── Minor tick marks (every 2 units, skip multiples of 10) */}
      {Array.from({ length: 50 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 10 === 0) return null;
        const [xa, ya] = pt(n, R + 6);
        const [xb, yb] = pt(n, R + 10);
        return (
          <line key={`mt${n}`}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#4a5260" strokeWidth="0.8"
          />
        );
      })}

      {/* ── Major tick marks + labels (every 10 units) */}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 5);
        const [xb, yb] = pt(n, R + 13);
        const [lx, ly] = pt(n, R + 20);
        const isRed = n >= 80;
        return (
          <g key={`tk${n}`}>
            <line
              x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke={isRed ? "#ef4444" : "#7a8090"}
              strokeWidth="1.5"
            />
            <text
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill={isRed ? "#b03030" : "#566070"}
              fontSize="7"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {n}
            </text>
          </g>
        );
      })}

      {/* ── Threshold tick (GO marker — slim white line) */}
      <line
        x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)}
        x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        stroke="#fff" strokeWidth="1.5" opacity="0.65"
      />

      {/* ── Classic threshold (pullback mode — dashed, dimmer) */}
      {hasClassic && (
        <line
          x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#fff" strokeWidth="1" opacity="0.28" strokeDasharray="2 2"
        />
      )}

      {/* ── Glass top highlight (subtle dome reflection) */}
      <path
        d={`M ${CX - 52} ${CY - 48} Q ${CX} ${CY - 76} ${CX + 52} ${CY - 48}`}
        fill="none" stroke="#fff" strokeWidth="4"
        strokeLinecap="round" opacity="0.04"
      />

      {/* ── Needle — metallic grey + score-color tint */}
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke="#c8c8c8" strokeWidth="2.2" strokeLinecap="round"
        filter="url(#sg-drop)"
      />
      <line
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke={color} strokeWidth="0.7" strokeLinecap="round"
        opacity="0.4" filter="url(#sg-glow)"
      />

      {/* ── Center hub */}
      <circle cx={CX} cy={CY} r="7"   fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r="3.5" fill="#111" stroke="#888" strokeWidth="0.8" />

      {/* ── Score number */}
      <text
        x={CX} y={CY + 32}
        textAnchor="middle"
        fill={color}
        stroke="#080a0d" strokeWidth="5"
        paintOrder="stroke fill"
        fontSize="40" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        filter="url(#sg-glow)"
      >
        {v}
      </text>
    </svg>
  );
}
