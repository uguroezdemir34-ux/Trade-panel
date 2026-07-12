"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/context";
import type { Timeframe } from "@/lib/okx/candles";

export type ChartClickMode = "none" | "hline" | "price" | "trendline" | "fibonacci" | "ray" | "extline" | "channel" | "fibext" | "vline" | "crossline" | "fibtimezone";

interface ChartControlsProps {
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
}: ChartControlsProps): React.ReactElement {
  const t = useT();

  const indicatorActiveCount =
    [showEma20, showEma50, showEma200, showRsi, showMacd, showBb, showTrades].filter(Boolean).length;

  return (
    <div>
      {/* Row 1 — Timeframe */}
      <div className="flex items-center gap-0.5 px-1 py-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={[
              "flex-shrink-0 rounded px-2.5 py-1 font-mono text-2xs font-bold tracking-widest uppercase transition-colors",
              timeframe === tf
                ? "bg-text-t1 text-bg-page"
                : "text-text-t3 hover:text-text-t1 hover:bg-surface-2",
            ].join(" ")}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Row 2 — Overlays + Tools: tek scroll şeridi (Indicators + toggles + ⚙ birlikte) */}
      <div className="mt-2 flex flex-nowrap items-center gap-1 px-1 py-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <IndicatorDropdown
          label={t("grafik.indicators")}
          activeCount={indicatorActiveCount}
          items={[
            { label: "EMA 20",   active: showEma20,  toggle: onToggleEma20,  accent: "#3b82f6" },
            { label: "EMA 50",   active: showEma50,  toggle: onToggleEma50,  accent: "#f59e0b" },
            { label: "EMA 200",  active: showEma200, toggle: onToggleEma200, accent: "#a855f7" },
            { label: "RSI 14",   active: showRsi,    toggle: onToggleRsi,    accent: "#ec4899" },
            { label: "MACD",     active: showMacd,   toggle: onToggleMacd,   accent: "#f59e0b" },
            { label: "BB 20",    active: showBb,     toggle: onToggleBb,     accent: "#06b6d4" },
            { label: t("grafik.trades"), active: showTrades, toggle: onToggleTrades, accent: "#22c55e" },
          ]}
        />

        <Toggle label={t("grafik.showVolume")} active={showVolume} onClick={onToggleVolume} accent="#6366f1" />
        <Toggle label={t("grafik.showVwap")} active={showVwap} onClick={onToggleVwap} accent="#f97316" />
        <Toggle label={t("grafik.showSr")} active={showSr} onClick={onToggleSr} accent="#a3e635" />
        <Toggle label={t("grafik.split")} active={showSplit} onClick={onToggleSplit} accent="#6366f1" />

        <ToolsDropdown
          showFlow={showFlow}
          clickMode={clickMode}
          onToggleFlow={onToggleFlow}
          onSetClickMode={onSetClickMode}
          labels={{
            flow: t("grafik.flow"),
            hline: t("grafik.hline"),
            priceMode: t("grafik.priceMode"),
          }}
        />
      </div>
    </div>
  );
}

// ─── Portal konumlandırma — overflow-x-auto şeridin içindeki dropdown
// tetikleyicileri için, panel document.body'ye taşınıp fixed konumlandığında
// tetikleyicinin ekran koordinatını hesaplar. Açıkken scroll/resize'da
// pozisyonu yeniden hesaplayıp paneli tetikleyiciye "sabitlenmiş" tutar. ────
function useAnchoredPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
): { top: number; left: number; right: number } | null {
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return pos;
}

function Toggle({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={active && accent ? { color: accent, backgroundColor: `${accent}1a` } : undefined}
      className={[
        "flex-shrink-0 rounded px-2 py-1.5 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap transition-colors",
        active && !accent ? "text-orange-500 bg-orange-500/10" : "",
        !active ? "text-text-t3 hover:text-text-t1 hover:bg-surface-2" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function IndicatorDropdown({
  label,
  activeCount,
  items,
}: {
  label: string;
  activeCount: number;
  items: { label: string; active: boolean; toggle: () => void; accent?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(open, triggerRef);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex-shrink-0 flex items-center gap-1.5 rounded px-2 py-1.5 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap transition-colors",
          activeCount > 0
            ? "text-orange-500 bg-orange-500/10"
            : "text-text-t3 hover:text-text-t1 hover:bg-surface-2",
        ].join(" ")}
      >
        {label}
        {activeCount > 0 && (
          <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <span className="text-text-t4 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 bg-bg-card border border-border rounded-lg shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[140px]"
        >
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
        </div>,
        document.body,
      )}
    </>
  );
}

function ToolsDropdown({
  showFlow,
  clickMode,
  onToggleFlow,
  onSetClickMode,
  labels,
}: {
  showFlow: boolean;
  clickMode: ChartClickMode;
  onToggleFlow: () => void;
  onSetClickMode: (mode: ChartClickMode) => void;
  labels: { flow: string; hline: string; priceMode: string };
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(open, triggerRef);
  const activeCount = [showFlow, clickMode === "hline", clickMode === "price"].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const items = [
    { label: labels.flow,      active: showFlow,              toggle: onToggleFlow },
    { label: labels.hline,     active: clickMode === "hline", toggle: () => onSetClickMode(clickMode === "hline" ? "none" : "hline") },
    { label: labels.priceMode, active: clickMode === "price", toggle: () => onSetClickMode(clickMode === "price" ? "none" : "price") },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex-shrink-0 flex items-center gap-1.5 rounded px-2 py-1.5 font-mono text-2xs font-bold tracking-widest uppercase whitespace-nowrap transition-colors",
          activeCount > 0
            ? "text-orange-500 bg-orange-500/10"
            : "text-text-t3 hover:text-text-t1 hover:bg-surface-2",
        ].join(" ")}
      >
        ⚙
        {activeCount > 0 && (
          <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <span className="text-text-t4 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-bg-card border border-border rounded-lg shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[120px]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.toggle}
              className={[
                "text-left rounded px-2.5 py-1.5 font-mono text-2xs tracking-wider transition-colors",
                item.active ? "text-orange-500 bg-orange-500/10" : "text-text-t3 hover:bg-surface-2",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
