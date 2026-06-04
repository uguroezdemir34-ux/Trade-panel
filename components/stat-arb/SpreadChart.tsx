"use client";

import { useMemo } from "react";

interface ZScorePoint {
  timestamp: number;
  zScore: number;
  spread: number;
}

interface SpreadChartProps {
  data: ZScorePoint[];
  entryThreshold: number;
  exitThreshold: number;
  emergencyThreshold: number;
  height?: number;
}

export function SpreadChart({
  data,
  entryThreshold,
  exitThreshold,
  emergencyThreshold,
  height = 160,
}: SpreadChartProps) {
  const { points, yMin, yMax, viewBox } = useMemo(() => {
    if (data.length < 2) return { points: "", yMin: -3, yMax: 3, viewBox: "0 0 400 160" };

    const W = 400;
    const H = height;
    const PAD_V = 12;

    const zValues = data.map((d) => d.zScore);
    const rawMin = Math.min(...zValues, -entryThreshold - 0.5);
    const rawMax = Math.max(...zValues, entryThreshold + 0.5);
    const yMin = rawMin - 0.3;
    const yMax = rawMax + 0.3;
    const yRange = yMax - yMin || 1;

    const toX = (i: number) => (i / (data.length - 1)) * W;
    const toY = (z: number) => PAD_V + ((yMax - z) / yRange) * (H - PAD_V * 2);

    const pts = data
      .map((d, i) => `${toX(i).toFixed(1)},${toY(d.zScore).toFixed(1)}`)
      .join(" ");

    return { points: pts, yMin, yMax, viewBox: `0 0 ${W} ${H}` };
  }, [data, entryThreshold, height]);

  const W = 400;
  const H = height;
  const PAD_V = 12;
  const yRange = yMax - yMin || 1;

  const toY = (z: number) => PAD_V + ((yMax - z) / yRange) * (H - PAD_V * 2);

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm font-mono"
        style={{ height }}
      >
        Veri yükleniyor…
      </div>
    );
  }

  const entryPosY = toY(entryThreshold).toFixed(1);
  const entryNegY = toY(-entryThreshold).toFixed(1);
  const emergPosY = toY(emergencyThreshold).toFixed(1);
  const emergNegY = toY(-emergencyThreshold).toFixed(1);
  const exitPosY = toY(exitThreshold).toFixed(1);
  const exitNegY = toY(-exitThreshold).toFixed(1);
  const zeroY = toY(0).toFixed(1);

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Emergency zone fill */}
        <rect x="0" y="0" width={W} height={emergPosY} fill="rgba(239,68,68,0.06)" />
        <rect x="0" y={emergNegY} width={W} height={H} fill="rgba(239,68,68,0.06)" />

        {/* Entry zone fill */}
        <rect x="0" y={emergPosY} width={W} height={parseFloat(entryPosY) - parseFloat(emergPosY)} fill="rgba(34,197,94,0.08)" />
        <rect x="0" y={entryNegY} width={W} height={parseFloat(emergNegY) - parseFloat(entryNegY)} fill="rgba(34,197,94,0.08)" />

        {/* Threshold lines */}
        <line x1="0" y1={emergPosY} x2={W} y2={emergPosY} stroke="rgba(239,68,68,0.5)" strokeWidth="1" strokeDasharray="4,4" />
        <line x1="0" y1={emergNegY} x2={W} y2={emergNegY} stroke="rgba(239,68,68,0.5)" strokeWidth="1" strokeDasharray="4,4" />
        <line x1="0" y1={entryPosY} x2={W} y2={entryPosY} stroke="rgba(34,197,94,0.6)" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1={entryNegY} x2={W} y2={entryNegY} stroke="rgba(34,197,94,0.6)" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1={exitPosY} x2={W} y2={exitPosY} stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
        <line x1="0" y1={exitNegY} x2={W} y2={exitNegY} stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
        <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(148,163,184,0.5)" strokeWidth="1" />

        {/* Z-score line */}
        <polyline
          points={points}
          fill="none"
          stroke="rgb(99,102,241)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Latest dot */}
        {data.length > 0 && (() => {
          const last = data[data.length - 1];
          const lx = W;
          const ly = toY(last.zScore);
          const isEntry = Math.abs(last.zScore) >= entryThreshold;
          return (
            <circle
              cx={lx}
              cy={ly}
              r="3"
              fill={isEntry ? "rgb(34,197,94)" : "rgb(99,102,241)"}
            />
          );
        })()}
      </svg>

      {/* X-axis labels */}
      {data.length >= 2 && (
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1 px-0.5">
          <span>{new Date(data[0].timestamp).toLocaleDateString("tr", { month: "short", day: "numeric" })}</span>
          <span>{new Date(data[Math.floor(data.length / 2)].timestamp).toLocaleDateString("tr", { month: "short", day: "numeric" })}</span>
          <span>{new Date(data[data.length - 1].timestamp).toLocaleDateString("tr", { month: "short", day: "numeric" })}</span>
        </div>
      )}
    </div>
  );
}
