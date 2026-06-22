"use client";

/**
 * SCORE GAUGE — 270° flat-premium arc.
 * Flat/minimal aesthetic: no gradients, glows, bevels, or skeuomorphic elements.
 * Theme-aware via CSS class selectors that cascade from [data-theme] on <html>.
 *
 * DO NOT edit pt() / arcPath() / needle tip — score binding is correct.
 * Geometry: viewBox 220×220, centre (110,104), track radius R=68, SW=10.
 * Sweep: s=0 → 7-o'clock, s=50 → 12-o'clock, s=100 → 5-o'clock. 270°.
 */

interface Props {
  score: number;
  threshold: number;
  goThreshold: number;
}

const CX = 110;
const CY = 104;
const R  = 68;
const SW = 10;

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

  /* Muted, desaturated tones — work on both dark and light themes */
  const progColor =
    v >= threshold ? "#3d8a55" :
    v >= 65        ? "#a07535" :
                     "#b84c48";

  /* Needle tip — DO NOT CHANGE */
  const [nx, ny] = pt(v, R - 6);

  /* Threshold tick positions */
  const [tt1x, tt1y] = pt(threshold, R - SW / 2 - 2);
  const [tt2x, tt2y] = pt(threshold, R + SW / 2 + 7);
  const hasClassic   = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 2);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 5);

  return (
    <svg
      viewBox="0 0 220 220"
      className="w-full select-none"
      aria-label={`Skor: ${v}/100`}
    >
      {/*
        Theme-aware CSS classes.
        [data-theme="light"] is on <html> — cascades into inline SVG in HTML docs.
        sg-trk / sg-ndl etc. are set as stroke/fill via CSS, not SVG attributes,
        so var() and cascade work correctly.
      */}
      <style>{`
        .sg-trk   { stroke: #252b38; }
        .sg-ndl   { stroke: #c0c6d0; }
        .sg-hub   { fill: #c0c6d0; }
        .sg-hubc  { fill: #111724; }
        .sg-tmaj  { stroke: #6b7280; }
        .sg-tmin  { stroke: #333a4a; }
        .sg-lbl   { fill: #6b7280; }
        .sg-th    { stroke: rgba(255,255,255,0.50); }
        .sg-thp   { stroke: rgba(255,255,255,0.24); }
        [data-theme="light"] .sg-trk  { stroke: #dde3ef; }
        [data-theme="light"] .sg-ndl  { stroke: #2d3748; }
        [data-theme="light"] .sg-hub  { fill: #2d3748; }
        [data-theme="light"] .sg-hubc { fill: #f1f5f9; }
        [data-theme="light"] .sg-tmaj { stroke: #94a3b8; }
        [data-theme="light"] .sg-tmin { stroke: #c8d5e4; }
        [data-theme="light"] .sg-lbl  { fill: #64748b; }
        [data-theme="light"] .sg-th   { stroke: rgba(30,40,60,0.44); }
        [data-theme="light"] .sg-thp  { stroke: rgba(30,40,60,0.22); }
      `}</style>

      {/* ── Track — full 270° neutral arc */}
      <path
        className="sg-trk"
        d={arcPath(0, 100, R)}
        fill="none" strokeWidth={SW} strokeLinecap="butt"
      />

      {/* ── Progress arc — 0 → score, muted color */}
      {v >= 1 && (
        <path
          d={arcPath(0, v, R)}
          fill="none"
          stroke={progColor}
          strokeWidth={SW}
          strokeLinecap="butt"
        />
      )}

      {/* ── Minor ticks — at 10, 30, 50, 70, 90 (between majors) */}
      {[10, 30, 50, 70, 90].map((n) => {
        const [xa, ya] = pt(n, R + SW / 2 + 2);
        const [xb, yb] = pt(n, R + SW / 2 + 8);
        return (
          <line key={`mt${n}`}
            className="sg-tmin"
            x1={xa.toFixed(1)} y1={ya.toFixed(1)}
            x2={xb.toFixed(1)} y2={yb.toFixed(1)}
            strokeWidth="0.9"
          />
        );
      })}

      {/* ── Major ticks + labels — every 20 units */}
      {[0, 20, 40, 60, 80, 100].map((n) => {
        const [xa, ya] = pt(n, R + SW / 2 + 1);
        const [xb, yb] = pt(n, R + SW / 2 + 11);
        const [lx, ly] = pt(n, R + SW / 2 + 21);
        return (
          <g key={`tk${n}`}>
            <line
              className="sg-tmaj"
              x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              strokeWidth="1.6"
            />
            <text
              className="sg-lbl"
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
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
        className="sg-th"
        x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)}
        x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        strokeWidth="2"
      />

      {/* ── Classic threshold (pullback mode — dashed) */}
      {hasClassic && (
        <line
          className="sg-thp"
          x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          strokeWidth="1" strokeDasharray="2.5 2"
        />
      )}

      {/* ── Needle — single flat line, no polygon, no gradient */}
      <line
        className="sg-ndl"
        x1={CX} y1={CY}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* ── Center hub — flat circle, no bevel */}
      <circle className="sg-hub"  cx={CX} cy={CY} r="5.5" />
      <circle className="sg-hubc" cx={CX} cy={CY} r="2.8" />

      {/*
        ── Score number — below the arc, in the transparent area.
        At y=208 the outer arc (bottom corners at y≈156) is well above.
        This area is outside all drawn shapes — card background shows through.
        x=22 left-aligns the number near the left edge, outside the arc sweep.
      */}
      <text
        x={22} y={208}
        textAnchor="start"
        fill={progColor}
        fontSize="52" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {v}
      </text>
    </svg>
  );
}
