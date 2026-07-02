"use client";

/**
 * SCORE RING — BTC kart prototipi için küçük dairesel gauge.
 *
 * Tam daire progress ring: stroke-dasharray/dashoffset tekniği.
 * Tick, ibre, bezel yok — sadece arka plan halkası + dolgu halkası + ortada rakam.
 * size prop: px cinsinden kare alan (varsayılan 60). w-full YASAK.
 */

interface Props {
  score: number;
  goThreshold: number;
  size?: number;
}

export function ScoreRing({ score, goThreshold, size = 60 }: Props): React.ReactElement {
  const v   = Math.max(0, Math.min(100, score));
  const sw  = Math.max(4, size / 12);           // stroke width scales with size
  const r   = size / 2 - sw / 2 - 1;            // radius: stays inside viewBox
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - v / 100);
  const cx  = size / 2;

  const color =
    v >= goThreshold ? "#22c55e" :
    v >= 65          ? "#f59e0b" :
                       "#ef4444";

  const fontSize = Math.round(size * 0.295);    // ~18px at 60px

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 block"
      aria-label={`Skor: ${v}`}
    >
      {/* Track ring */}
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="#1a1e26"
        strokeWidth={sw}
      />
      {/* Progress ring — 12 o'clock start */}
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dashoffset 0.3s ease-out, stroke 0.2s" }}
      />
      {/* Score number centered */}
      <text
        x={cx} y={cx}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {v}
      </text>
    </svg>
  );
}
