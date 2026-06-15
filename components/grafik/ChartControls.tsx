"use client";

/**
 * CHART CONTROLS — Timeframe + Overlay + Tool seçici.
 * Pair seçimi sağ WatchlistPanel'e taşındı.
 */

import { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/context";
import type { Timeframe } from "@/lib/okx/candles";

export type ChartClickMode = "none" | "hline" | "price" | "trendline" | "fibonacci" | "ray" | "extline" | "channel" | "fibext" | "vline" | "crossline" | "fibtimezone";

interface Props {
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
  showSplit: boolean;
  showFlow: boolean;
  showQuick: boolean;
  showLiqMagnet: boolean;
  clickMode: ChartClickMode;
  hasDrawnLines: boolean;
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
  onToggleSplit: () => void;
  onToggleFlow: () => void;
  onToggleQuick: () => void;
  onToggleLiqMagnet: () => void;
  onSetClickMode: (mode: ChartClickMode) => void;
  onClearDrawnLines: () => void;
}

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export function ChartControls({
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
  showSplit,
  showFlow,
  showQuick,
  showLiqMagnet,
  clickMode,
  hasDrawnLines,
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
  onToggleSplit,
  onToggleFlow,
  onToggleQuick,
  onToggleLiqMagnet,
  onSetClickMode,
  onClearDrawnLines,
}: Props): React.ReactElement {
  const t = useT();

  return (
    <div className="border-border bg-bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3">
      {/* Timeframe */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase shrink-0">
          {t("grafik.timeframeLabel")}
        </span>
        <div className="flex flex-wrap gap-1">
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
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase shrink-0">
          {t("grafik.overlays")}
        </span>
        <div className="flex flex-wrap gap-1">
          <IndicatorDropdown
            showEma20={showEma20} showEma50={showEma50} showEma200={showEma200}
            showRsi={showRsi} showMacd={showMacd} showBb={showBb}
            onToggleEma20={onToggleEma20} onToggleEma50={onToggleEma50} onToggleEma200={onToggleEma200}
            onToggleRsi={onToggleRsi} onToggleMacd={onToggleMacd} onToggleBb={onToggleBb}
            label={t("grafik.indicators")}
          />
          <Toggle active={showTrades} onClick={onToggleTrades}>
            {t("grafik.showTrades")}
          </Toggle>
          <Toggle active={showVolume} onClick={onToggleVolume} accent="#6366f1">
            {t("grafik.showVolume")}
          </Toggle>
          <Toggle active={showVwap} onClick={onToggleVwap} accent="#f97316">
            {t("grafik.showVwap")}
          </Toggle>
          <Toggle active={showSr} onClick={onToggleSr} accent="#a3e635">
            {t("grafik.showSr")}
          </Toggle>
        </div>
      </div>

      {/* Tools */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("grafik.tools")}
        </span>
        <div className="flex flex-wrap gap-1">
          {/* Split view */}
          <Toggle active={showSplit} onClick={onToggleSplit} accent="#6366f1">
            {t("grafik.split")}
          </Toggle>

          {/* Order flow panel */}
          <Toggle active={showFlow} onClick={onToggleFlow} accent="#8b5cf6">
            {t("grafik.flow")}
          </Toggle>

          {/* Draw horizontal line */}
          <Toggle
            active={clickMode === "hline"}
            onClick={() => onSetClickMode(clickMode === "hline" ? "none" : "hline")}
            accent="#f59e0b"
          >
            {t("grafik.hline")}
          </Toggle>
          {hasDrawnLines && (
            <button
              onClick={onClearDrawnLines}
              className="rounded border border-border px-2 py-1 font-mono text-2xs text-text-t4 hover:text-red-400 hover:border-red-400 transition-colors shrink-0"
              title={t("grafik.clearLines")}
            >
              ✕
            </button>
          )}

          {/* Price capture mode */}
          <Toggle
            active={clickMode === "price"}
            onClick={() => onSetClickMode(clickMode === "price" ? "none" : "price")}
            accent="#22c55e"
          >
            {t("grafik.priceMode")}
          </Toggle>

          {/* Liq Magnet bands */}
          <Toggle active={showLiqMagnet} onClick={onToggleLiqMagnet} accent="#f97316">
            Liq
          </Toggle>

          {/* Quick trade panel */}
          <Toggle active={showQuick} onClick={onToggleQuick} accent="#ec4899">
            {t("grafik.quickTrade")}
          </Toggle>
        </div>
      </div>
    </div>
  );
}

function IndicatorDropdown({
  showEma20, showEma50, showEma200, showRsi, showMacd, showBb,
  onToggleEma20, onToggleEma50, onToggleEma200, onToggleRsi, onToggleMacd, onToggleBb,
  label,
}: {
  showEma20: boolean; showEma50: boolean; showEma200: boolean;
  showRsi: boolean; showMacd: boolean; showBb: boolean;
  onToggleEma20: () => void; onToggleEma50: () => void; onToggleEma200: () => void;
  onToggleRsi: () => void; onToggleMacd: () => void; onToggleBb: () => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = [showEma20, showEma50, showEma200, showRsi, showMacd, showBb].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const items = [
    { label: "EMA 20",  active: showEma20,  toggle: onToggleEma20,  accent: "#6b7280" },
    { label: "EMA 50",  active: showEma50,  toggle: onToggleEma50,  accent: "#6b7280" },
    { label: "EMA 200", active: showEma200, toggle: onToggleEma200, accent: "#a855f7" },
    { label: "RSI",     active: showRsi,    toggle: onToggleRsi,    accent: "#ec4899" },
    { label: "MACD",    active: showMacd,   toggle: onToggleMacd,   accent: "#f59e0b" },
    { label: "BB 20",   active: showBb,     toggle: onToggleBb,     accent: "#06b6d4" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap shrink-0 transition-colors ${
          activeCount > 0
            ? "border-brand/50 bg-brand/10 text-brand"
            : "border-border text-text-t3 hover:bg-bg-page"
        }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="rounded-full bg-brand text-bg-page text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center shrink-0">
            {activeCount}
          </span>
        )}
        <span className="text-text-t4 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[130px]">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.toggle}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-bg-hover transition-colors text-left"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 border"
                style={item.active
                  ? { backgroundColor: item.accent, borderColor: item.accent }
                  : { borderColor: "#374151", backgroundColor: "transparent" }}
              />
              <span className={`font-mono text-2xs tracking-wider ${item.active ? "text-text-t1" : "text-text-t3"}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
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
