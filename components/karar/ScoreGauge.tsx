"use client";

/**
 * SCORE GAUGE — Semi-circular speedometer for 0-100 score.
 *
 * Three-zone neon track (red 0-65 / amber 65-threshold / green threshold-100)
 * with a bright progress arc, needle, and glowing score number.
 * Visually equivalent to the Fear & Greed gauge on Coinglass / TradingView.
 */

interface Props {
  score: number;
  threshold: number;
  goThreshold: number;
}

// Score s → (x, y) on the semi-circle arc
// s=0 → leftmost, s=50 → top, s=100 → rightmost
function pt(s: number, cx: number, cy: number, r: number): [number, number] {
  const a = Math.PI * (1 - s / 100);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

// SVG arc path from score `from` to score `to` (upper semi-circle)
function arc(from: number, to: number, cx: number, cy: number, r: number): string {
  const [x1, y1] = pt(from, cx, cy, r);
  const [x2, y2] = pt(to,   cx, cy, r);
  // sweep=0 → CCW in SVG (draws through top of circle)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function ScoreGauge({ score, threshold, goThreshold }: Props): React.ReactElement {
  const v = Math.max(0, Math.min(100, score));

  const cx = 100, cy = 112, R = 76, SW = 14;

  const color =
    v >= threshold ? "#22c55e"
    : v >= 65      ? "#f59e0b"
    :                "#ef4444";

  // Threshold tick + label
  const [tx1, ty1] = pt(threshold, cx, cy, R - SW / 2 - 4);
  const [tx2, ty2] = pt(threshold, cx, cy, R + SW / 2 + 4);
  const [tlx, tly] = pt(threshold, cx, cy, R + SW / 2 + 14);

  // Classic (pullback) threshold tick — dashed, dimmer
  const hasClassic = goThreshold !== threshold;
  const [cx1, cy1] = pt(goThreshold, cx, cy, R - SW / 2 - 4);
  const [cx2, cy2] = pt(goThreshold, cx, cy, R + SW / 2 + 4);

  // Needle tip
  const [nx, ny] = pt(v, cx, cy, R - 6);

  return (
    <svg
      viewBox="0 0 200 120"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      <defs>
        <filter id="sg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Track background (dark) */}
      <path d={arc(0, 100, cx, cy, R)} fill="none" stroke="#1e293b" strokeWidth={SW + 2} strokeLinecap="round" />

      {/* ── Zone 1: 0–65 dim red */}
      <path d={arc(0, 65, cx, cy, R)} fill="none" stroke="#7f1d1d" strokeWidth={SW - 4} strokeLinecap="butt" opacity="0.7" />

      {/* ── Zone 2: 65–threshold dim amber */}
      {threshold > 65 && (
        <path d={arc(65, threshold, cx, cy, R)} fill="none" stroke="#78350f" strokeWidth={SW - 4} strokeLinecap="butt" opacity="0.7" />
      )}

      {/* ── Zone 3: threshold–100 dim green */}
      <path d={arc(threshold, 100, cx, cy, R)} fill="none" stroke="#14532d" strokeWidth={SW - 4} strokeLinecap="butt" opacity="0.7" />

      {/* ── Neon progress arc (0 → current score) */}
      {v >= 1 && (
        <path
          d={arc(0, v, cx, cy, R)}
          fill="none"
          stroke={color}
          strokeWidth={SW - 4}
          strokeLinecap="butt"
          filter="url(#sg-glow)"
        />
      )}

      {/* ── Minor tick marks at 25 / 50 / 75 */}
      {[25, 50, 75].map((n) => {
        const [xa, ya] = pt(n, cx, cy, R - SW / 2 - 2);
        const [xb, yb] = pt(n, cx, cy, R + SW / 2 + 2);
        return (
          <line key={n}
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            stroke="#374151" strokeWidth="1.5"
          />
        );
      })}

      {/* ── Effective threshold tick (white) */}
      <line
        x1={tx1.toFixed(1)} y1={ty1.toFixed(1)}
        x2={tx2.toFixed(1)} y2={ty2.toFixed(1)}
        stroke="#ffffff" strokeWidth="2" opacity="0.85"
      />
      <text
        x={tlx.toFixed(1)} y={tly.toFixed(1)}
        textAnchor="middle" dominantBaseline="middle"
        fill="#94a3b8" fontSize="8"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {threshold}
      </text>

      {/* ── Classic threshold tick (pullback mode — dashed) */}
      {hasClassic && (
        <line
          x1={cx1.toFixed(1)} y1={cy1.toFixed(1)}
          x2={cx2.toFixed(1)} y2={cy2.toFixed(1)}
          stroke="#ffffff" strokeWidth="1.5" opacity="0.35" strokeDasharray="2 2"
        />
      )}

      {/* ── Needle */}
      <line
        x1={cx} y1={cy}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        filter="url(#sg-glow)"
      />

      {/* ── Center hub */}
      <circle cx={cx} cy={cy} r="5" fill="#0f172a" stroke={color} strokeWidth="1.5" />

      {/* ── Score number (neon) */}
      <text
        x={cx} y={cy - 14}
        textAnchor="middle"
        fill={color}
        fontSize="32" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        filter="url(#sg-glow)"
      >
        {v}
      </text>
    </svg>
  );
}
