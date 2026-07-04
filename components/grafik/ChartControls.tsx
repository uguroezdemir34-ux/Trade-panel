"use client";

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
  clickMode: ChartClickMode;
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
  onSetClickMode: (mode: ChartClickMode) => void;
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
  clickMode,
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
  onSetClickMode,
}: Props): React.ReactElement {
  const t = useT();

  return (
    <div className="border-border bg-bg-card rounded-lg border">
      {/* Row 1 — Timeframe */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border/40">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={[
              "rounded px-2.5 py-1 font-mono text-2xs font-bold tracking-widest uppercase transition-colors",
              timeframe === tf
                ? "bg-text-t1 text-bg-page"
                : "text-text-t3 hover:text-text-t1 hover:bg-surface-2",
            ].join(" ")}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Row 2 — Overlays + Tools */}
      <div className="flex items-center gap-1 px-3 py-2">
        {/* Left: no overflow — absolute dropdown not clipped */}
        <IndicatorDropdown
          showEma20={showEma20}
          showEma50={showEma50}
          showEma200={showEma200}
          showRsi={showRsi}
          showMacd={showMacd}
          showBb={showBb}
          showTrades={showTrades}
          onToggleEma20={onToggleEma20}
          onToggleEma50={onToggleEma50}
          onToggleEma200={onToggleEma200}
          onToggleRsi={onToggleRsi}
          onToggleMacd={onToggleMacd}
          onToggleBb={onToggleBb}
          onToggleTrades={onToggleTrades}
          label={t("grafik.indicators")}
        />
        {/* Center: scrollable toggles only — overflow confined here */}
        <div className="flex flex-nowrap items-center gap-1 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <Toggle active={showVolume} onClick={onToggleVolume} accent="#6366f1">
            {t("grafik.showVolume")}
          </Toggle>
          <Toggle active={showVwap} onClick={onToggleVwap} accent="#f97316">
            {t("grafik.showVwap")}
          </Toggle>
          <Toggle active={showSr} onClick={onToggleSr} accent="#a3e635">
            {t("grafik.showSr")}
          </Toggle>
          <Toggle active={showSplit} onClick={onToggleSplit} accent="#6366f1">
            {t("grafik.split")}
          </Toggle>
        </div>
        {/* Right: no overflow — absolute dropdown not clipped */}
        <ToolsDropdown
          showFlow={showFlow}
          clickMode={clickMode}
          onToggleFlow={onToggleFlow}
          onSetClickMode={onSetClickMode}
        />
      </div>
    </div>
  );
}

function IndicatorDropdown({
  showEma20, showEma50, showEma200, showRsi, showMacd, showBb, showTrades,
  onToggleEma20, onToggleEma50, onToggleEma200, onToggleRsi, onToggleMacd, onToggleBb, onToggleTrades,
  label,
}: {
  showEma20: boolean; showEma50: boolean; showEma200: boolean;
  showRsi: boolean; showMacd: boolean; showBb: boolean; showTrades: boolean;
  onToggleEma20: () => void; onToggleEma50: () => void; onToggleEma200: () => void;
  onToggleRsi: () => void; onToggleMacd: () => void; onToggleBb: () => void; onToggleTrades: () => void;
  label: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = [showEma20, showEma50, showEma200, showRsi, showMacd, showBb, showTrades].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const items = [
    { label: "EMA 20",    active: showEma20,   toggle: onToggleEma20,   accent: "#3b82f6" },
    { label: "EMA 50",    active: showEma50,   toggle: onToggleEma50,   accent: "#f59e0b" },
    { label: "EMA 200",   active: showEma200,  toggle: onToggleEma200,  accent: "#a855f7" },
    { label: "RSI 14",    active: showRsi,     toggle: onToggleRsi,     accent: "#ec4899" },
    { label: "MACD",      active: showMacd,    toggle: onToggleMacd,    accent: "#f59e0b" },
    { label: "BB 20",     active: showBb,      toggle: onToggleBb,      accent: "#06b6d4" },
    { label: t("grafik.trades"),  active: showTrades,  toggle: onToggleTrades,  accent: "#22c55e" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-1.5 rounded border px-1.5 py-2.5 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap shrink-0 transition-colors",
          activeCount > 0
            ? "border-brand/50 bg-brand/10 text-brand"
            : "border-border text-text-t3 hover:bg-surface-2",
        ].join(" ")}
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
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[140px]">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.toggle}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-surface-2 transition-colors text-left"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 border"
                style={
                  item.active
                    ? { backgroundColor: item.accent, borderColor: item.accent }
                    : { borderColor: "#374151", backgroundColor: "transparent" }
                }
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

function ToolsDropdown({
  showFlow, clickMode, onToggleFlow, onSetClickMode,
}: {
  showFlow: boolean; clickMode: ChartClickMode;
  onToggleFlow: () => void; onSetClickMode: (mode: ChartClickMode) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = [showFlow, clickMode === "hline", clickMode === "price"].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const items = [
    { label: t("grafik.flow"),      active: showFlow,              toggle: onToggleFlow,                                                    accent: "#8b5cf6" },
    { label: t("grafik.hline"),     active: clickMode === "hline", toggle: () => onSetClickMode(clickMode === "hline" ? "none" : "hline"), accent: "#f59e0b" },
    { label: t("grafik.priceMode"), active: clickMode === "price", toggle: () => onSetClickMode(clickMode === "price" ? "none" : "price"), accent: "#22c55e" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-1.5 rounded border px-1.5 py-2.5 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap shrink-0 transition-colors",
          activeCount > 0
            ? "border-brand/50 bg-brand/10 text-brand"
            : "border-border text-text-t3 hover:bg-surface-2",
        ].join(" ")}
      >
        ⚙
        {activeCount > 0 && (
          <span className="rounded-full bg-brand text-bg-page text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center shrink-0">
            {activeCount}
          </span>
        )}
        <span className="text-text-t4 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[120px]">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.toggle}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-surface-2 transition-colors text-left"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 border"
                style={
                  item.active
                    ? { backgroundColor: item.accent, borderColor: item.accent }
                    : { borderColor: "#374151", backgroundColor: "transparent" }
                }
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
      className={[
        "rounded border px-1.5 py-2.5 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap shrink-0 transition-colors",
        active && !accent ? "border-text-t1 bg-text-t1 text-bg-page" : "",
        !active ? "border-border text-text-t3 hover:bg-surface-2" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
