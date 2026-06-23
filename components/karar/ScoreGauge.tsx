"use client";

/**
 * SCORE GAUGE — Ultra-premium 270° automotive instrument cluster.
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

  const progressColor = v >= goThreshold ? "#22c55e" : "#ef4444";
  const scoreColor    = v >= threshold   ? "#22c55e" : v >= 65 ? "#f97316" : "#ef4444";

  /* Needle geometry — DO NOT CHANGE */
  const needleRad = ((-135 + 2.7 * v) - 90) * Math.PI / 180;
  const perpRad   = needleRad + Math.PI / 2;
  const [nx, ny]  = pt(v, R - 5);

  /* Tapered needle: wide at hub, narrow at tip */
  const bw = 3.5, tw = 0.6;
  const blx  = (CX + bw * Math.cos(perpRad)).toFixed(1);
  const bly  = (CY + bw * Math.sin(perpRad)).toFixed(1);
  const brx  = (CX - bw * Math.cos(perpRad)).toFixed(1);
  const bry  = (CY - bw * Math.sin(perpRad)).toFixed(1);
  const ntlx = (nx + tw * Math.cos(perpRad)).toFixed(1);
  const ntly = (ny + tw * Math.sin(perpRad)).toFixed(1);
  const ntrx = (nx - tw * Math.cos(perpRad)).toFixed(1);
  const ntry = (ny - tw * Math.sin(perpRad)).toFixed(1);
  const needlePoly  = `M ${blx} ${bly} L ${ntlx} ${ntly} L ${ntrx} ${ntry} L ${brx} ${bry} Z`;

  /* Spine highlight */
  const hw = 0.7;
  const hlx = (CX + hw * Math.cos(perpRad)).toFixed(1);
  const hly = (CY + hw * Math.sin(perpRad)).toFixed(1);
  const hrx = (CX - hw * Math.cos(perpRad)).toFixed(1);
  const hry = (CY - hw * Math.sin(perpRad)).toFixed(1);
  const needleSpine = `M ${hlx} ${hly} L ${ntlx} ${ntly} L ${ntrx} ${ntry} L ${hrx} ${hry} Z`;

  /* Counterweight — opposite side of hub */
  const cwTipX = (CX + 20 * Math.cos(needleRad + Math.PI)).toFixed(1);
  const cwTipY = (CY + 20 * Math.sin(needleRad + Math.PI)).toFixed(1);
  const counterPoly = `M ${blx} ${bly} L ${cwTipX} ${cwTipY} L ${brx} ${bry} Z`;

  /* Threshold ticks */
  const [tt1x, tt1y] = pt(threshold,   R - SW / 2 - 5);
  const [tt2x, tt2y] = pt(threshold,   R + SW / 2 + 12);
  const hasClassic   = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 4);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 9);

  /* Zone separator */
  const [zx1, zy1] = pt(goThreshold, R - SW / 2 - 2);
  const [zx2, zy2] = pt(goThreshold, R + SW / 2 + 2);

  return (
    <svg viewBox="0 0 220 232" className="w-full select-none" aria-label={`Skor: ${v}/100`}>
      <defs>
        {/* Premium chrome bezel — bright highlight → deep shadow */}
        <linearGradient id="sg-chrome" x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%"   stopColor="#f4f8fc" />
          <stop offset="8%"   stopColor="#d0dce8" />
          <stop offset="20%"  stopColor="#90a4b8" />
          <stop offset="36%"  stopColor="#4a5a6e" />
          <stop offset="52%"  stopColor="#2c3848" />
          <stop offset="68%"  stopColor="#1a2030" />
          <stop offset="84%"  stopColor="#0e1420" />
          <stop offset="100%" stopColor="#060a10" />
        </linearGradient>

        {/* Inner accent ring chrome */}
        <linearGradient id="sg-chrome2" x1="28%" y1="0%" x2="72%" y2="100%">
          <stop offset="0%"   stopColor="#a0b8cc" />
          <stop offset="40%"  stopColor="#485870" />
          <stop offset="75%"  stopColor="#222c3c" />
          <stop offset="100%" stopColor="#101620" />
        </linearGradient>

        {/* Deep face — dark navy with inner warmth */}
        <radialGradient id="sg-face" cx="48%" cy="45%" r="70%">
          <stop offset="0%"   stopColor="#1a2030" />
          <stop offset="28%"  stopColor="#0e1428" />
          <stop offset="62%"  stopColor="#080b18" />
          <stop offset="100%" stopColor="#020408" />
        </radialGradient>

        {/* Vignette */}
        <radialGradient id="sg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="35%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
        </radialGradient>

        {/* Hub — polished chrome dome */}
        <radialGradient id="sg-hub" cx="24%" cy="19%" r="82%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="15%"  stopColor="#dce8f4" />
          <stop offset="38%"  stopColor="#7890a8" />
          <stop offset="68%"  stopColor="#2e3c50" />
          <stop offset="100%" stopColor="#101820" />
        </radialGradient>

        {/* Hub center jewel */}
        <radialGradient id="sg-hub-jewel" cx="32%" cy="25%" r="75%">
          <stop offset="0%"   stopColor="#2a3848" />
          <stop offset="100%" stopColor="#04080e" />
        </radialGradient>

        {/* Arc outer soft halo */}
        <filter id="sg-halo" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
        </filter>

        {/* Arc mid glow */}
        <filter id="sg-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Needle spine glow */}
        <filter id="sg-spine" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Score number glow */}
        <filter id="sg-num-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Needle drop shadow */}
        <filter id="sg-drop" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.90" />
        </filter>
      </defs>

      {/* ── Outermost void */}
      <circle cx={CX} cy={CY} r={109} fill="#010204" />

      {/* ── CHROME BEZEL ── */}
      {/* Deep outer collar */}
      <circle cx={CX} cy={CY} r={105} fill="none" stroke="#030608" strokeWidth="8" />
      {/* Wide chrome ring */}
      <circle cx={CX} cy={CY} r={97}  fill="none" stroke="url(#sg-chrome)" strokeWidth="16" />
      {/* Primary catch-light — top-left bright arc */}
      <path d="M 16 54 A 97 97 0 0 1 186 36"
        fill="none" stroke="#eef4fc" strokeWidth="3.5" strokeLinecap="round" opacity="0.46" />
      {/* Secondary soft catch-light */}
      <path d="M 30 67 A 84 84 0 0 1 175 50"
        fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.16" />
      {/* Bottom-right deep shadow arc */}
      <path d="M 197 162 A 97 97 0 0 1 148 200"
        fill="none" stroke="#000204" strokeWidth="6" strokeLinecap="round" opacity="0.88" />
      {/* Inner chrome accent ring */}
      <circle cx={CX} cy={CY} r={89.5} fill="none" stroke="url(#sg-chrome2)" strokeWidth="3.5" />
      {/* Inner ring top catch-light */}
      <path d="M 34 73 A 89 89 0 0 1 179 55"
        fill="none" stroke="#c0d4e8" strokeWidth="0.8" strokeLinecap="round" opacity="0.20" />
      {/* Deep groove */}
      <circle cx={CX} cy={CY} r={86.2} fill="none" stroke="#010306" strokeWidth="3.2" />
      {/* Groove inner lip */}
      <circle cx={CX} cy={CY} r={84.8} fill="none" stroke="#1a2438" strokeWidth="0.7" />

      {/* ── FACE ── */}
      <circle cx={CX} cy={CY} r={84} fill="url(#sg-face)" />

      {/* Ambient backlight ring (color matches arc) */}
      <circle cx={CX} cy={CY} r={82} fill="none"
        stroke={progressColor} strokeWidth="2" opacity="0.09" />

      {/* Vignette */}
      <circle cx={CX} cy={CY} r={84} fill="url(#sg-vignette)" />

      {/* Glass dome sheen */}
      <ellipse cx={CX} cy={CY - 33} rx={46} ry={16}
        fill="none" stroke="#fff" strokeWidth="18" opacity="0.030" strokeLinecap="round" />

      {/* ── TRACK CHANNEL ── */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#010308"  strokeWidth={SW + 10} />
      <path d={arcPath(0, 100, R)} fill="none" stroke="#04070f"  strokeWidth={SW + 6} />

      {/* Zone bands: dim red / dim green */}
      <path d={arcPath(0, goThreshold, R)} fill="none"
        stroke="#500a0a" strokeWidth={SW + 2} strokeLinecap="butt" />
      <path d={arcPath(goThreshold, 100, R)} fill="none"
        stroke="#0a3014" strokeWidth={SW + 2} strokeLinecap="butt" />

      {/* Zone separator line */}
      <line
        x1={zx1.toFixed(1)} y1={zy1.toFixed(1)}
        x2={zx2.toFixed(1)} y2={zy2.toFixed(1)}
        stroke="#010408" strokeWidth="2.5" />

      {/* ── ACTIVE ARC — layered LED glow ── */}
      {v >= 1 && (
        <>
          {/* Outer soft halo */}
          <path d={arcPath(0, v, R)} fill="none"
            stroke={progressColor} strokeWidth={SW + 8}
            strokeLinecap="butt" opacity="0.10"
            filter="url(#sg-halo)" />
          {/* Mid bloom */}
          <path d={arcPath(0, v, R)} fill="none"
            stroke={progressColor} strokeWidth={SW + 3}
            strokeLinecap="butt" opacity="0.28"
            filter="url(#sg-glow)" />
          {/* Core solid arc */}
          <path d={arcPath(0, v, R)} fill="none"
            stroke={progressColor} strokeWidth={SW - 1}
            strokeLinecap="butt" opacity="0.94" />
          {/* Surface highlight (LED lens gloss) */}
          <path d={arcPath(0, v, R)} fill="none"
            stroke="#ffffff" strokeWidth="1.6"
            strokeLinecap="butt" opacity="0.32" />
        </>
      )}

      {/* ── TICK MARKS ── */}
      {/* Sub-minor every 2 */}
      {Array.from({ length: 49 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 5 === 0) return null;
        const [xa, ya] = pt(n, R + 15);
        const [xb, yb] = pt(n, R + 17);
        return <line key={`smt${n}`}
          x1={xa.toFixed(1)} y1={ya.toFixed(1)} x2={xb.toFixed(1)} y2={yb.toFixed(1)}
          stroke="#263040" strokeWidth="0.7" />;
      })}

      {/* Minor every 5 */}
      {Array.from({ length: 19 }, (_, i) => {
        const n = (i + 1) * 5;
        if (n % 10 === 0) return null;
        const [xa, ya] = pt(n, R + 14);
        const [xb, yb] = pt(n, R + 19);
        return <line key={`mt${n}`}
          x1={xa.toFixed(1)} y1={ya.toFixed(1)} x2={xb.toFixed(1)} y2={yb.toFixed(1)}
          stroke="#485a70" strokeWidth="1.1" />;
      })}

      {/* Major every 10 + labels */}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 12);
        const [xb, yb] = pt(n, R + 22);
        const [lx, ly] = pt(n, R + 32);
        return (
          <g key={`tk${n}`}>
            <line x1={xa.toFixed(1)} y1={ya.toFixed(1)} x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke="#7890a8" strokeWidth="2.1" />
            <text x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#507090" fontSize="7"
              fontFamily="ui-monospace, SFMono-Regular, monospace">{n}</text>
          </g>
        );
      })}

      {/* Threshold tick (solid) */}
      <line x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)} x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        stroke="#d8e4f0" strokeWidth="1.8" opacity="0.58" />
      {hasClassic && (
        <line x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)} x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#d8e4f0" strokeWidth="1" opacity="0.26" strokeDasharray="2 2" />
      )}

      {/* ── NEEDLE ── */}
      {/* Counterweight */}
      <path d={counterPoly} fill="#1c2838" />
      <path d={counterPoly} fill="#5a6a80" opacity="0.52" />
      <path d={counterPoly} fill="none" stroke="#080f18" strokeWidth="0.7" />

      {/* Drop shadow */}
      <path d={needlePoly} fill="#000" opacity="0.65" filter="url(#sg-drop)" />
      {/* Dark body */}
      <path d={needlePoly} fill="#1a2432" />
      {/* Surface sheen */}
      <path d={needlePoly} fill="#8090a8" opacity="0.58" />
      {/* Colored glow spine */}
      <path d={needleSpine} fill={scoreColor} opacity="0.60" filter="url(#sg-spine)" />
      {/* Silver spine highlight */}
      <path d={needleSpine} fill="#ccdae8" opacity="0.55" />
      {/* Edge bevel */}
      <path d={needlePoly} fill="none" stroke="#060c18" strokeWidth="0.6" />

      {/* ── HUB — premium chrome dome ── */}
      <circle cx={CX} cy={CY} r="13"   fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r="13"   fill="none" stroke="#5878a0" strokeWidth="0.9" />
      <circle cx={CX} cy={CY} r="7.2"  fill="url(#sg-hub-jewel)" />
      <circle cx={CX} cy={CY} r="7.2"  fill="none" stroke="#2c4060" strokeWidth="0.9" />
      {/* Primary specular */}
      <circle cx={CX - 4} cy={CY - 4}   r="2.4" fill="#fff" opacity="0.58" />
      {/* Secondary specular */}
      <circle cx={CX - 2.6} cy={CY - 2.6} r="1.0" fill="#fff" opacity="0.82" />

      {/* ── SCORE NUMBER ── */}
      {/* Glow layer */}
      <text x={28} y={222} textAnchor="start"
        fill={scoreColor} fontSize="44" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        opacity="0.60" filter="url(#sg-num-glow)">{v}</text>
      {/* Solid number */}
      <text x={28} y={222} textAnchor="start"
        fill={scoreColor}
        stroke="#010204" strokeWidth="4" paintOrder="stroke fill"
        fontSize="44" fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace">{v}</text>
    </svg>
  );
}
