"use client";

/**
 * CHART CONTROLS — Pair + Timeframe + Overlay seçici.
 */

import { useT } from "@/lib/i18n/context";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { Timeframe } from "@/lib/okx/candles";

interface Props {
  pair: Pair;
  timeframe: Timeframe;
  showEma20: boolean;
  showEma50: boolean;
  showEma200: boolean;
  showTrades: boolean;
  showVolume: boolean;
  showRsi: boolean;
  showMacd: boolean;
  showBb: boolean;
  showVwap: boolean;
  showSr: boolean;
  onPairChange: (p: Pair) => void;
  onTimeframeChange: (tf: Timeframe) => void;
  onToggleEma20: () => void;
  onToggleEma50: () => void;
  onToggleEma200: () => void;
  onToggleTrades: () => void;
  onToggleVolume: () => void;
  onToggleRsi: () => void;
  onToggleMacd: () => void;
  onToggleBb: () => void;
  onToggleVwap: () => void;
  onToggleSr: () => void;
}

const TIMEFRAMES: Timeframe[] = ["5m", "15m", "1h", "4h", "1d"];

export function ChartControls({
  pair,
  timeframe,
  showEma20,
  showEma50,
  showEma200,
  showTrades,
  showVolume,
  showRsi,
  showMacd,
  showBb,
  showVwap,
  showSr,
  onPairChange,
  onTimeframeChange,
  onToggleEma20,
  onToggleEma50,
  onToggleEma200,
  onToggleTrades,
  onToggleVolume,
  onToggleRsi,
  onToggleMacd,
  onToggleBb,
  onToggleVwap,
  onToggleSr,
}: Props): React.ReactElement {
  const t = useT();

  return (
    <div className="border-border bg-bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3">
      {/* Pair — scrollable row */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="text-text-t3 shrink-0 font-mono text-2xs tracking-widest uppercase">
          {t("grafik.pairLabel")}
        </span>
        <div className="flex gap-0.5 overflow-x-auto">
          {PAIRS.map((p) => (
            <button
              key={p}
              onClick={() => onPairChange(p)}
              className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-2xs font-bold tracking-widest uppercase ${
                pair === p
                  ? "border-text-t1 bg-text-t1 text-bg-page"
                  : "border-border text-text-t2 hover:bg-bg-page"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Timeframe */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("grafik.timeframeLabel")}
        </span>
        <div className="flex gap-1 overflow-x-auto">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`rounded border px-2 py-1 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap shrink-0 ${
                timeframe === tf
                  ? "border-text-t1 bg-text-t1 text-bg-page"
                  : "border-border text-text-t2 hover:bg-bg-page"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Overlays */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("grafik.overlays")}
        </span>
        <div className="flex gap-1 overflow-x-auto">
          <Toggle active={showEma20} onClick={onToggleEma20}>
            {t("grafik.ema20")}
          </Toggle>
          <Toggle active={showEma50} onClick={onToggleEma50}>
            {t("grafik.ema50")}
          </Toggle>
          <Toggle active={showEma200} onClick={onToggleEma200} accent="#a855f7">
            {t("grafik.ema200")}
          </Toggle>
          <Toggle active={showTrades} onClick={onToggleTrades}>
            {t("grafik.showTrades")}
          </Toggle>
          <Toggle active={showVolume} onClick={onToggleVolume} accent="#6366f1">
            {t("grafik.showVolume")}
          </Toggle>
          <Toggle active={showRsi} onClick={onToggleRsi} accent="#ec4899">
            {t("grafik.showRsi")}
          </Toggle>
          <Toggle active={showMacd} onClick={onToggleMacd} accent="#f59e0b">
            {t("grafik.showMacd")}
          </Toggle>
          <Toggle active={showBb} onClick={onToggleBb} accent="#06b6d4">
            {t("grafik.showBb")}
          </Toggle>
          <Toggle active={showVwap} onClick={onToggleVwap} accent="#f97316">
            {t("grafik.showVwap")}
          </Toggle>
          <Toggle active={showSr} onClick={onToggleSr} accent="#a3e635">
            {t("grafik.showSr")}
          </Toggle>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  accent,
  children,
}: React.PropsWithChildren<{
  active: boolean;
  onClick: () => void;
  accent?: string;
}>) {
  const activeStyle = accent
    ? { borderColor: accent, backgroundColor: accent + "20", color: accent }
    : undefined;

  return (
    <button
      onClick={onClick}
      style={active && accent ? activeStyle : undefined}
      className={`rounded border px-2 py-1 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap shrink-0 ${
        active && !accent
          ? "border-text-t1 bg-text-t1 text-bg-page"
          : !active
          ? "border-border text-text-t3 hover:bg-bg-page"
          : ""
      }`}
    >
      {children}
    </button>
  );
}
