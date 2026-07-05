"use client";

interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ points, color = "#22c55e", width = 54, height = 26 }: SparklineProps) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;
  if (range === 0) return null;

  const PAD = 1.5;
  const W = width - PAD * 2;
  const H = height - PAD * 2;

  const pts = points
    .map((p, i) => {
      const x = PAD + (i / (points.length - 1)) * W;
      const y = PAD + H - ((p - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ display: "block" }}
    >
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="0.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.45}
      />
    </svg>
  );
}
