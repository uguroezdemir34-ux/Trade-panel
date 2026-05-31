"use client";

/**
 * EQUITY CURVE — Kümülatif P&L grafiği.
 *
 * Pure SVG, sıfır dış bağımlılık.
 * - Yeşil/kırmızı çizgi: kümülatif PnL yönüne göre
 * - Kırmızı gölge: drawdown bölgesi (peak - current)
 * - Sıfır bazeline noktalı çizgi
 * - Son değer etiketi
 */

import { useMemo } from "react";
import type { EquityPoint } from "@/lib/pnl/equity";

interface Props {
  points: EquityPoint[];
}

const W = 400;  // viewBox genişliği
const H = 100;  // viewBox yüksekliği
const PAD = { top: 8, right: 48, bottom: 18, left: 8 };

const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

export function EquityCurve({ points }: Props): React.ReactElement {
  const isEmpty = points.length < 2;

  const { linePath, drawdownPath, zeroY, lastX, lastY, isProfit, minPnl, maxPnl } =
    useMemo(() => {
      if (points.length < 2) {
        return {
          linePath: "",
          drawdownPath: "",
          zeroY: PAD.top + CHART_H / 2,
          lastX: 0,
          lastY: 0,
          isProfit: true,
          minPnl: 0,
          maxPnl: 0,
        };
      }

      const vals = points.map((p) => p.cumPnlUsd);
      const rawMin = Math.min(0, ...vals);
      const rawMax = Math.max(0, ...vals);
      // Tambuffer so the line doesn't hug the edges
      const range = rawMax - rawMin || 1;
      const minVal = rawMin - range * 0.05;
      const maxVal = rawMax + range * 0.05;
      const totalRange = maxVal - minVal;

      const xOf = (i: number) =>
        PAD.left + (i / (points.length - 1)) * CHART_W;
      const yOf = (v: number) =>
        PAD.top + ((maxVal - v) / totalRange) * CHART_H;

      const zeroY = yOf(0);

      // Equity line
      const lineCoords = points.map((p, i) => `${xOf(i)},${yOf(p.cumPnlUsd)}`);
      const linePath = `M ${lineCoords.join(" L ")}`;

      // Drawdown fill: from peak line down to equity line, filled red
      // Build path: go forward along peak, back along equity
      const peakCoords = points.map((p, i) => `${xOf(i)},${yOf(p.peak)}`);
      const equityReverse = points
        .map((p, i) => `${xOf(i)},${yOf(p.cumPnlUsd)}`)
        .reverse();
      const drawdownPath =
        points.some((p) => p.drawdownUsd > 0)
          ? `M ${peakCoords.join(" L ")} L ${equityReverse.join(" L ")} Z`
          : "";

      const lastPt = points[points.length - 1];
      const lastIdx = points.length - 1;

      return {
        linePath,
        drawdownPath,
        zeroY,
        lastX: xOf(lastIdx),
        lastY: yOf(lastPt.cumPnlUsd),
        isProfit: lastPt.cumPnlUsd >= 0,
        minPnl: rawMin,
        maxPnl: rawMax,
      };
    }, [points]);

  const lineColor = isProfit ? "#22C55E" : "#EF4444";
  const lastVal = points.length > 0 ? points[points.length - 1].cumPnlUsd : 0;
  const lastSign = lastVal >= 0 ? "+" : "";
  const lastLabel = `${lastSign}$${Math.abs(lastVal).toFixed(0)}`;

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          Equity Curve
        </span>
        {!isEmpty && (
          <span
            className="font-mono text-xs font-bold tabular-nums"
            style={{ color: lineColor }}
          >
            {lastLabel} USDT
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex h-[100px] items-center justify-center">
          <span className="text-text-t4 font-mono text-2xs tracking-wider">
            No closed trades yet
          </span>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: 100 }}
          aria-label="Equity curve chart"
        >
          {/* Zero baseline */}
          {zeroY >= PAD.top && zeroY <= PAD.top + CHART_H && (
            <line
              x1={PAD.left}
              y1={zeroY}
              x2={PAD.left + CHART_W}
              y2={zeroY}
              stroke="rgb(var(--border))"
              strokeWidth="0.8"
              strokeDasharray="3,3"
            />
          )}

          {/* Drawdown shading */}
          {drawdownPath && (
            <path
              d={drawdownPath}
              fill="rgba(239,68,68,0.12)"
              stroke="none"
            />
          )}

          {/* Equity line fill (under curve) */}
          <path
            d={`${linePath} L ${PAD.left + CHART_W},${zeroY} L ${PAD.left},${zeroY} Z`}
            fill={isProfit ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)"}
            stroke="none"
          />

          {/* Equity line */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Last point dot */}
          <circle
            cx={lastX}
            cy={lastY}
            r="2.5"
            fill={lineColor}
          />

          {/* Min/max Y labels */}
          {maxPnl !== minPnl && (
            <>
              <text
                x={PAD.left + CHART_W + 3}
                y={PAD.top + 6}
                fontSize="8"
                fill="rgb(var(--text-t3))"
                fontFamily="monospace"
              >
                {maxPnl >= 0 ? "+" : ""}{maxPnl.toFixed(0)}
              </text>
              <text
                x={PAD.left + CHART_W + 3}
                y={PAD.top + CHART_H}
                fontSize="8"
                fill="rgb(var(--text-t3))"
                fontFamily="monospace"
              >
                {minPnl >= 0 ? "+" : ""}{minPnl.toFixed(0)}
              </text>
            </>
          )}
        </svg>
      )}
    </div>
  );
}
