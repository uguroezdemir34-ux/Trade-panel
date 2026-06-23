"use client";

/**
 * SCORE GAUGE — Luxury instrument cluster, premium dark-face / warm-gold bezel.
 * DO NOT edit pt() / arcPath() / needle angle — score binding is correct.
 */

interface Props {
  score: number;
  threshold: number;
  goThreshold: number;
}

const CX = 110;
const CY = 108;
const R  = 64;
const SW = 11;

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

  const progressColor = v >= goThreshold ? "#22c55e" : "#f97316";
  const scoreColor    = v >= threshold   ? "#22c55e" : v >= 65 ? "#f97316" : "#ef4444";

  /* Needle — DO NOT CHANGE math */
  const needleRad = ((-135 + 2.7 * v) - 90) * Math.PI / 180;
  const perpRad   = needleRad + Math.PI / 2;
  const [nx, ny]  = pt(v, R + 2);   /* tip — longer, reaches arc */

  /* Tapered needle polygon — wider base, razor tip */
  const bw = 5.0, tw = 0.18;
  const blx  = (CX + bw * Math.cos(perpRad)).toFixed(1);
  const bly  = (CY + bw * Math.sin(perpRad)).toFixed(1);
  const brx  = (CX - bw * Math.cos(perpRad)).toFixed(1);
  const bry  = (CY - bw * Math.sin(perpRad)).toFixed(1);
  const ntlx = (nx + tw * Math.cos(perpRad)).toFixed(1);
  const ntly = (ny + tw * Math.sin(perpRad)).toFixed(1);
  const ntrx = (nx - tw * Math.cos(perpRad)).toFixed(1);
  const ntry = (ny - tw * Math.sin(perpRad)).toFixed(1);
  const needlePoly  = `M ${blx} ${bly} L ${ntlx} ${ntly} L ${ntrx} ${ntry} L ${brx} ${bry} Z`;

  /* Spine highlight strip */
  const hw = 0.9;
  const hlx = (CX + hw * Math.cos(perpRad)).toFixed(1);
  const hly = (CY + hw * Math.sin(perpRad)).toFixed(1);
  const hrx = (CX - hw * Math.cos(perpRad)).toFixed(1);
  const hry = (CY - hw * Math.sin(perpRad)).toFixed(1);
  const needleSpine = `M ${hlx} ${hly} L ${ntlx} ${ntly} L ${ntrx} ${ntry} L ${hrx} ${hry} Z`;

  /* Counterweight — shorter so hub covers it */
  const cwTipX = (CX + 16 * Math.cos(needleRad + Math.PI)).toFixed(1);
  const cwTipY = (CY + 16 * Math.sin(needleRad + Math.PI)).toFixed(1);
  const cbw = 3.2;
  const cblx = (CX + cbw * Math.cos(perpRad)).toFixed(1);
  const cbly = (CY + cbw * Math.sin(perpRad)).toFixed(1);
  const cbrx = (CX - cbw * Math.cos(perpRad)).toFixed(1);
  const cbry = (CY - cbw * Math.sin(perpRad)).toFixed(1);
  const counterPoly = `M ${cblx} ${cbly} L ${cwTipX} ${cwTipY} L ${cbrx} ${cbry} Z`;

  /* Threshold ticks */
  const [tt1x, tt1y] = pt(threshold,   R - SW / 2 - 5);
  const [tt2x, tt2y] = pt(threshold,   R + SW / 2 + 12);
  const hasClassic   = goThreshold !== threshold;
  const [ct1x, ct1y] = pt(goThreshold, R - SW / 2 - 4);
  const [ct2x, ct2y] = pt(goThreshold, R + SW / 2 + 9);

  /* Zone separator */
  const [zx1, zy1] = pt(goThreshold, R - SW / 2 - 1);
  const [zx2, zy2] = pt(goThreshold, R + SW / 2 + 1);

  return (
    <svg viewBox="0 0 220 218" className="w-full select-none" aria-label={`Skor: ${v}/100`}>
      <defs>
        {/* ── WARM GOLD / CHAMPAGNE BEZEL ── */}
        <linearGradient id="sg-bezel-outer" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%"   stopColor="#e8d49a" />
          <stop offset="8%"   stopColor="#c8a860" />
          <stop offset="18%"  stopColor="#a07838" />
          <stop offset="32%"  stopColor="#6a4e20" />
          <stop offset="48%"  stopColor="#3e2e10" />
          <stop offset="64%"  stopColor="#241a08" />
          <stop offset="80%"  stopColor="#1a1206" />
          <stop offset="100%" stopColor="#0e0a04" />
        </linearGradient>

        <linearGradient id="sg-bezel-mid" x1="20%" y1="5%" x2="80%" y2="95%">
          <stop offset="0%"   stopColor="#d4b870" />
          <stop offset="30%"  stopColor="#7a5a28" />
          <stop offset="65%"  stopColor="#2e2010" />
          <stop offset="100%" stopColor="#120e06" />
        </linearGradient>

        <linearGradient id="sg-bezel-inner" x1="25%" y1="5%" x2="75%" y2="95%">
          <stop offset="0%"   stopColor="#b09050" />
          <stop offset="40%"  stopColor="#5a4018" />
          <stop offset="80%"  stopColor="#201608" />
          <stop offset="100%" stopColor="#0e0a04" />
        </linearGradient>

        {/* ── PURE BLACK FACE ── */}
        <radialGradient id="sg-face" cx="50%" cy="46%" r="72%">
          <stop offset="0%"   stopColor="#12161e" />
          <stop offset="40%"  stopColor="#080a10" />
          <stop offset="100%" stopColor="#020304" />
        </radialGradient>

        {/* Vignette */}
        <radialGradient id="sg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.80" />
        </radialGradient>

        {/* ── HUB ── */}
        <radialGradient id="sg-hub" cx="22%" cy="18%" r="85%">
          <stop offset="0%"   stopColor="#e8d49a" />
          <stop offset="20%"  stopColor="#c0a060" />
          <stop offset="48%"  stopColor="#7a5a28" />
          <stop offset="78%"  stopColor="#3a2a0e" />
          <stop offset="100%" stopColor="#14100a" />
        </radialGradient>

        <radialGradient id="sg-hub-face" cx="40%" cy="35%" r="72%">
          <stop offset="0%"   stopColor="#1a1612" />
          <stop offset="60%"  stopColor="#0a0806" />
          <stop offset="100%" stopColor="#040302" />
        </radialGradient>

        {/* ── NEEDLE chrome gradient ── */}
        <linearGradient id="sg-needle-chrome" gradientUnits="userSpaceOnUse"
          x1={CX} y1={CY} x2={nx.toFixed(1)} y2={ny.toFixed(1)}>
          <stop offset="0%"   stopColor="#606060" stopOpacity="0.3" />
          <stop offset="60%"  stopColor="#909090" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#c0c0c0" stopOpacity="0.5" />
        </linearGradient>

        {/* ── FILTERS ── */}
        <filter id="sg-halo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
        </filter>
        <filter id="sg-bloom" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sg-spine-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sg-tip-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sg-score-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sg-drop" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.95" />
        </filter>
      </defs>

      {/* ── VOID ── */}
      <circle cx={CX} cy={CY} r={109} fill="#010102" />

      {/* ── WARM GOLD BEZEL — 3 concentric rings ── */}
      <circle cx={CX} cy={CY} r={106} fill="none" stroke="#080602" strokeWidth="6" />
      <circle cx={CX} cy={CY} r={100} fill="none" stroke="url(#sg-bezel-outer)" strokeWidth="12" />
      <path d="M 198 164 A 100 100 0 0 1 146 202"
        fill="none" stroke="#050300" strokeWidth="7" strokeLinecap="round" opacity="0.92" />
      <circle cx={CX} cy={CY} r={92.5} fill="none" stroke="url(#sg-bezel-mid)" strokeWidth="5" />
      <circle cx={CX} cy={CY} r={88} fill="none" stroke="url(#sg-bezel-inner)" strokeWidth="3" />
      <circle cx={CX} cy={CY} r={85.5} fill="none" stroke="#040302" strokeWidth="3.5" />
      <circle cx={CX} cy={CY} r={84} fill="none" stroke="#1e1808" strokeWidth="0.8" />

      {/* ── FACE — pure black ── */}
      <circle cx={CX} cy={CY} r={83} fill="url(#sg-face)" />
      <circle cx={CX} cy={CY} r={81} fill="none"
        stroke={progressColor} strokeWidth="1.8" opacity="0.12" />
      <circle cx={CX} cy={CY} r={83} fill="url(#sg-vignette)" />
      <ellipse cx={CX} cy={CY - 32} rx={44} ry={15}
        fill="none" stroke="#fff" strokeWidth="20" opacity="0.028" strokeLinecap="round" />

      {/* ── TRACK CHANNEL ── */}
      <path d={arcPath(0, 100, R)} fill="none" stroke="#010204" strokeWidth={SW + 11} />
      <path d={arcPath(0, 100, R)} fill="none" stroke="#040610" strokeWidth={SW + 7} />

      {/* Zone bands */}
      <path d={arcPath(0, goThreshold, R)} fill="none"
        stroke="#4e1200" strokeWidth={SW + 3} strokeLinecap="butt" />
      <path d={arcPath(goThreshold, 100, R)} fill="none"
        stroke="#0c3010" strokeWidth={SW + 3} strokeLinecap="butt" />

      {/* Zone separator */}
      <line
        x1={zx1.toFixed(1)} y1={zy1.toFixed(1)}
        x2={zx2.toFixed(1)} y2={zy2.toFixed(1)}
        stroke="#010308" strokeWidth="2.5" />

      {/* ── ACTIVE ARC — layered luxury glow ── */}
      {v >= 1 && (
        <>
          <path d={arcPath(0, v, R)} fill="none"
            stroke={progressColor} strokeWidth={SW + 10}
            strokeLinecap="butt" opacity="0.12"
            filter="url(#sg-halo)" />
          <path d={arcPath(0, v, R)} fill="none"
            stroke={progressColor} strokeWidth={SW + 4}
            strokeLinecap="butt" opacity="0.30"
            filter="url(#sg-bloom)" />
          <path d={arcPath(0, v, R)} fill="none"
            stroke={progressColor} strokeWidth={SW}
            strokeLinecap="butt" opacity="0.95" />
          <path d={arcPath(0, v, R)} fill="none"
            stroke="#ffffff" strokeWidth="2"
            strokeLinecap="butt" opacity="0.38" />
          <path d={arcPath(0, v, R - 3)} fill="none"
            stroke="#000" strokeWidth="1.5"
            strokeLinecap="butt" opacity="0.20" />
        </>
      )}

      {/* ── TICK MARKS ── */}
      {Array.from({ length: 49 }, (_, i) => {
        const n = (i + 1) * 2;
        if (n % 5 === 0) return null;
        const [xa, ya] = pt(n, R + 15);
        const [xb, yb] = pt(n, R + 17);
        return <line key={`smt${n}`}
          x1={xa.toFixed(1)} y1={ya.toFixed(1)}
          x2={xb.toFixed(1)} y2={yb.toFixed(1)}
          stroke="#2a2010" strokeWidth="0.7" />;
      })}
      {Array.from({ length: 19 }, (_, i) => {
        const n = (i + 1) * 5;
        if (n % 10 === 0) return null;
        const [xa, ya] = pt(n, R + 14);
        const [xb, yb] = pt(n, R + 19);
        return <line key={`mt${n}`}
          x1={xa.toFixed(1)} y1={ya.toFixed(1)}
          x2={xb.toFixed(1)} y2={yb.toFixed(1)}
          stroke="#5a4820" strokeWidth="1.1" />;
      })}
      {Array.from({ length: 11 }, (_, i) => {
        const n = i * 10;
        const [xa, ya] = pt(n, R + 12);
        const [xb, yb] = pt(n, R + 23);
        const [lx, ly] = pt(n, R + 33);
        return (
          <g key={`tk${n}`}>
            <line x1={xa.toFixed(1)} y1={ya.toFixed(1)}
              x2={xb.toFixed(1)} y2={yb.toFixed(1)}
              stroke="#a08040" strokeWidth="2.2" />
            <text x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#705830" fontSize="7"
              fontFamily="ui-monospace, SFMono-Regular, monospace">{n}</text>
          </g>
        );
      })}

      {/* Threshold tick */}
      <line x1={tt1x.toFixed(1)} y1={tt1y.toFixed(1)}
        x2={tt2x.toFixed(1)} y2={tt2y.toFixed(1)}
        stroke="#e8d49a" strokeWidth="1.8" opacity="0.55" />
      {hasClassic && (
        <line x1={ct1x.toFixed(1)} y1={ct1y.toFixed(1)}
          x2={ct2x.toFixed(1)} y2={ct2y.toFixed(1)}
          stroke="#e8d49a" strokeWidth="1" opacity="0.25" strokeDasharray="2 2" />
      )}

      {/* ── NEEDLE — premium chrome blade ── */}
      {/* Counterweight */}
      <path d={counterPoly} fill="#1a1410" />
      <path d={counterPoly} fill="#604820" opacity="0.45" />
      <path d={counterPoly} fill="none" stroke="#0a0804" strokeWidth="0.6" />

      {/* Drop shadow */}
      <path d={needlePoly} fill="#000" opacity="0.75" filter="url(#sg-drop)" />
      {/* Matte dark body */}
      <path d={needlePoly} fill="#0e0e0e" />
      {/* Chrome sheen overlay */}
      <path d={needlePoly} fill="url(#sg-needle-chrome)" />
      {/* Chrome edge bevel — right side highlight */}
      <path d={needlePoly} fill="none" stroke="#707070" strokeWidth="0.8" opacity="0.35" />

      {/* Colored spine glow */}
      <path d={needleSpine} fill={scoreColor} opacity="0.80" filter="url(#sg-spine-glow)" />
      {/* Bright chrome spine */}
      <path d={needleSpine} fill="#e8e8e8" opacity="0.55" />
      {/* Colored spine tint on top */}
      <path d={needleSpine} fill={scoreColor} opacity="0.20" />

      {/* Tip glow — plasma point */}
      <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="3.5"
        fill={progressColor} opacity="0.75" filter="url(#sg-tip-glow)" />
      <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="1.5"
        fill="#ffffff" opacity="0.95" />
      <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="0.6"
        fill={progressColor} opacity="1" />

      {/* ── HUB — warm gold dome with embedded score ── */}
      <circle cx={CX} cy={CY} r={22}   fill="url(#sg-hub)" />
      <circle cx={CX} cy={CY} r={22}   fill="none" stroke="#a08040" strokeWidth="1.0" />
      {/* Inner dark face — score window */}
      <circle cx={CX} cy={CY} r={15.5} fill="url(#sg-hub-face)" />
      <circle cx={CX} cy={CY} r={15.5} fill="none" stroke="#4a3010" strokeWidth="0.8" />

      {/* Score glow */}
      <text x={CX} y={CY + 2} textAnchor="middle" dominantBaseline="middle"
        fill={scoreColor} fontSize="15" fontWeight="800"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        opacity="0.55" filter="url(#sg-score-glow)">{v}</text>
      {/* Score solid */}
      <text x={CX} y={CY + 2} textAnchor="middle" dominantBaseline="middle"
        fill={scoreColor}
        stroke="#010101" strokeWidth="1.5" paintOrder="stroke fill"
        fontSize="15" fontWeight="800"
        fontFamily="ui-monospace, SFMono-Regular, monospace">{v}</text>

      {/* Specular — warm gold glint */}
      <circle cx={CX - 8} cy={CY - 8} r="3.2" fill="#ffe8a0" opacity="0.50" />
      <circle cx={CX - 5} cy={CY - 5} r="1.4" fill="#ffffff" opacity="0.75" />
    </svg>
  );
}
