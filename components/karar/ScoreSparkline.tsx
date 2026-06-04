"use client";

import type { ScoreSnapshot } from "@/lib/store/scoreHistoryStore";

interface Props {
  snapshots: ScoreSnapshot[];
  width?: number;
  height?: number;
}

const VERDICT_COLOR: Record<string, string> = {
  go: "#22c55e",
  wait: "#f59e0b",
  no: "#ef4444",
};

export function ScoreSparkline({
  snapshots,
  width = 48,
  height = 10,
}: Props): React.ReactElement | null {
  // Need at least 2 points to draw a line
  const pts = snapshots.slice(-24);
  if (pts.length < 2) return null;

  const n = pts.length;
  const xStep = width / (n - 1);
  const padV = 1;

  function xOf(i: number) {
    return i * xStep;
  }
  function yOf(score: number) {
    // score 0–100, y inverted (SVG y=0 is top)
    return height - padV - ((score / 100) * (height - padV * 2));
  }

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.score).toFixed(1)}`)
    .join(" ");

  const latest = pts[pts.length - 1];
  const color = VERDICT_COLOR[latest.verdict] ?? "#6b7280";
  const dotX = xOf(n - 1);
  const dotY = yOf(latest.score);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" strokeOpacity="0.7" />
      <circle cx={dotX} cy={dotY} r="1.5" fill={color} />
    </svg>
  );
}
