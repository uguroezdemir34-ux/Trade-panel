"use client";

/**
 * PRICE CHART — TradingView lightweight-charts v4 wrapper.
 *
 * Paneller (yukarıdan aşağı):
 *   1. Candlestick + EMA overlays  (ana panel)
 *   2. Volume histogram             (opsiyonel, altta ~20%)
 *   3. RSI(14) line + 30/70 bands  (opsiyonel, en altta ~18%)
 *
 * Pane layout: tek chart instance, ayrı priceScaleId + scaleMargins.
 */

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { ChartSeries } from "@/lib/chart/types";

interface Props {
  series: ChartSeries;
  height?: number;
  theme?: "dark" | "light";
}

const COLOR_UP       = "#22c55e";
const COLOR_DOWN     = "#ef4444";
const COLOR_EMA20    = "#3b82f6";
const COLOR_EMA50    = "#f59e0b";
const COLOR_EMA200   = "#a855f7";
const COLOR_RSI      = "#ec4899";
const COLOR_BB       = "#06b6d4"; // cyan-500
const COLOR_VWAP     = "#f97316"; // orange-500
const COLOR_MACD     = "#3b82f6";
const COLOR_SIGNAL   = "#f59e0b";
const COLOR_LIVE     = "#3b82f6"; // blue-500

const THEME_COLORS = {
  dark:  { grid: "#2d2d2d", text: "#a3a3a3", border: "#2d2d2d" },
  light: { grid: "#e5e5e5", text: "#525252",  border: "#e5e5e5" },
} as const;

// Dynamic pane layout — each sub-panel gets PANEL_H of chart height
const PANEL_H = 0.20;
const BOT_PAD = 0.01;

function panelMargins(slotFromBottom: number) {
  return {
    top: 1.0 - (slotFromBottom + 1) * PANEL_H - BOT_PAD,
    bottom: slotFromBottom * PANEL_H + BOT_PAD,
  };
}

function candleMargins(panelCount: number) {
  return { top: 0.03, bottom: panelCount * PANEL_H + BOT_PAD };
}

// Assign slots bottom→top: MACD=0, RSI=1, Vol=2
function computeSlots(hasVol: boolean, hasRsi: boolean, hasMacd: boolean) {
  const slots: { name: string; slot: number }[] = [];
  let next = 0;
  if (hasMacd) slots.push({ name: "macd", slot: next++ });
  if (hasRsi)  slots.push({ name: "rsi",  slot: next++ });
  if (hasVol)  slots.push({ name: "volume", slot: next++ });
  return slots;
}

export function PriceChart({ series, height = 400, theme = "dark" }: Props): React.ReactElement {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema20Ref      = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref      = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref     = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiRef        = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef   = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const alarmLinesRef = useRef<IPriceLine[]>([]);
  const srLinesRef = useRef<IPriceLine[]>([]);
  const tradeLinesRef = useRef<IPriceLine[]>([]);
  const currentPriceLineRef = useRef<IPriceLine | null>(null);
  const bbUpperRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef       = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapUpperRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapLowerRef  = useRef<ISeriesApi<"Line"> | null>(null);

  // ─── Mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tc = THEME_COLORS[theme];
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: tc.text,
        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
      },
      grid: {
        vertLines: { color: tc.grid },
        horzLines: { color: tc.grid },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: tc.border,
      },
      rightPriceScale: { borderColor: tc.border },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: COLOR_UP,
      downColor: COLOR_DOWN,
      wickUpColor: COLOR_UP,
      wickDownColor: COLOR_DOWN,
      borderVisible: false,
    });
    candleRef.current = candle;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      candleRef.current = null;
      ema20Ref.current  = null;
      ema50Ref.current  = null;
      ema200Ref.current = null;
      volumeRef.current    = null;
      rsiRef.current       = null;
      macdHistRef.current  = null;
      macdLineRef.current  = null;
      macdSignalRef.current = null;
      bbUpperRef.current   = null;
      bbMiddleRef.current  = null;
      bbLowerRef.current   = null;
      vwapRef.current         = null;
      vwapUpperRef.current    = null;
      vwapLowerRef.current    = null;
      currentPriceLineRef.current = null;
    };
  }, [height]);

  // ─── Theme color update (no chart recreation) ───────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const tc = THEME_COLORS[theme];
    chart.applyOptions({
      layout: { textColor: tc.text },
      grid: { vertLines: { color: tc.grid }, horzLines: { color: tc.grid } },
      timeScale: { borderColor: tc.border },
      rightPriceScale: { borderColor: tc.border },
    });
  }, [theme]);

  // ─── Data / visibility update ────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    // Determine what's active this render
    const hasVol  = !!(series.volume?.length);
    const hasRsi  = !!(series.rsi?.length);
    const hasMacd = !!(series.macdData?.length);

    const slots = computeSlots(hasVol, hasRsi, hasMacd);
    const panelCount = slots.length;

    // 1. Update candle price scale margins
    chart.priceScale("right").applyOptions({
      scaleMargins: candleMargins(panelCount),
    });

    // 2. Candle data
    candle.setData(series.candles as CandlestickData<Time>[]);

    // 3. EMA20
    if (series.ema20?.length) {
      if (!ema20Ref.current) {
        ema20Ref.current = chart.addLineSeries({
          color: COLOR_EMA20, lineWidth: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
      }
      ema20Ref.current.setData(series.ema20 as LineData<Time>[]);
    } else if (ema20Ref.current) {
      chart.removeSeries(ema20Ref.current);
      ema20Ref.current = null;
    }

    // 4. EMA50
    if (series.ema50?.length) {
      if (!ema50Ref.current) {
        ema50Ref.current = chart.addLineSeries({
          color: COLOR_EMA50, lineWidth: 2,
          priceLineVisible: false, lastValueVisible: false,
        });
      }
      ema50Ref.current.setData(series.ema50 as LineData<Time>[]);
    } else if (ema50Ref.current) {
      chart.removeSeries(ema50Ref.current);
      ema50Ref.current = null;
    }

    // 5. EMA200
    if (series.ema200?.length) {
      if (!ema200Ref.current) {
        ema200Ref.current = chart.addLineSeries({
          color: COLOR_EMA200, lineWidth: 2, lineStyle: 1,
          priceLineVisible: false, lastValueVisible: false,
        });
      }
      ema200Ref.current.setData(series.ema200 as LineData<Time>[]);
    } else if (ema200Ref.current) {
      chart.removeSeries(ema200Ref.current);
      ema200Ref.current = null;
    }

    // 5b. Bollinger Bands (overlay on main pane)
    if (series.bb?.upper.length) {
      const bbOpts = {
        color: COLOR_BB,
        lineWidth: 1 as const,
        lineStyle: 0 as const,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      if (!bbUpperRef.current)  bbUpperRef.current  = chart.addLineSeries({ ...bbOpts, lineStyle: 2 });
      if (!bbMiddleRef.current) bbMiddleRef.current = chart.addLineSeries({ ...bbOpts, lineWidth: 1 });
      if (!bbLowerRef.current)  bbLowerRef.current  = chart.addLineSeries({ ...bbOpts, lineStyle: 2 });
      bbUpperRef.current.setData(series.bb.upper as LineData<Time>[]);
      bbMiddleRef.current.setData(series.bb.middle as LineData<Time>[]);
      bbLowerRef.current.setData(series.bb.lower as LineData<Time>[]);
    } else {
      if (bbUpperRef.current)  { chart.removeSeries(bbUpperRef.current);  bbUpperRef.current  = null; }
      if (bbMiddleRef.current) { chart.removeSeries(bbMiddleRef.current); bbMiddleRef.current = null; }
      if (bbLowerRef.current)  { chart.removeSeries(bbLowerRef.current);  bbLowerRef.current  = null; }
    }

    // 5c. VWAP overlay
    if (series.vwap?.vwap.length) {
      const vwapOpts = {
        priceLineVisible: false,
        lastValueVisible: true,
      };
      if (!vwapRef.current) {
        vwapRef.current = chart.addLineSeries({
          ...vwapOpts, color: COLOR_VWAP, lineWidth: 2,
        });
      }
      if (!vwapUpperRef.current) {
        vwapUpperRef.current = chart.addLineSeries({
          ...vwapOpts, color: COLOR_VWAP, lineWidth: 1, lineStyle: 2, lastValueVisible: false,
        });
      }
      if (!vwapLowerRef.current) {
        vwapLowerRef.current = chart.addLineSeries({
          ...vwapOpts, color: COLOR_VWAP, lineWidth: 1, lineStyle: 2, lastValueVisible: false,
        });
      }
      vwapRef.current.setData(series.vwap.vwap as LineData<Time>[]);
      vwapUpperRef.current.setData(series.vwap.upper as LineData<Time>[]);
      vwapLowerRef.current.setData(series.vwap.lower as LineData<Time>[]);
    } else {
      if (vwapRef.current)      { chart.removeSeries(vwapRef.current);      vwapRef.current      = null; }
      if (vwapUpperRef.current) { chart.removeSeries(vwapUpperRef.current); vwapUpperRef.current = null; }
      if (vwapLowerRef.current) { chart.removeSeries(vwapLowerRef.current); vwapLowerRef.current = null; }
    }

    // 6. Volume histogram
    if (hasVol) {
      const volSlot = slots.find((s) => s.name === "volume")!.slot;
      if (!volumeRef.current) {
        volumeRef.current = chart.addHistogramSeries({
          priceScaleId: "volume",
          priceLineVisible: false,
          lastValueVisible: false,
        });
        chart.priceScale("volume").applyOptions({ drawTicks: false, borderVisible: false });
      }
      chart.priceScale("volume").applyOptions({ scaleMargins: panelMargins(volSlot) });
      volumeRef.current.setData(series.volume as HistogramData<Time>[]);
    } else if (volumeRef.current) {
      chart.removeSeries(volumeRef.current);
      volumeRef.current = null;
    }

    // 7. RSI panel
    if (hasRsi) {
      const rsiSlot = slots.find((s) => s.name === "rsi")!.slot;
      if (!rsiRef.current) {
        const rsiLine = chart.addLineSeries({
          priceScaleId: "rsi",
          color: COLOR_RSI,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        rsiLine.createPriceLine({ price: 70, color: "#ef444466", lineWidth: 1, lineStyle: 2 });
        rsiLine.createPriceLine({ price: 50, color: "#52525244", lineWidth: 1, lineStyle: 2 });
        rsiLine.createPriceLine({ price: 30, color: "#22c55e66", lineWidth: 1, lineStyle: 2 });
        chart.priceScale("rsi").applyOptions({ drawTicks: false, borderVisible: false });
        rsiRef.current = rsiLine;
      }
      chart.priceScale("rsi").applyOptions({ scaleMargins: panelMargins(rsiSlot) });
      rsiRef.current.setData(series.rsi as LineData<Time>[]);
    } else if (rsiRef.current) {
      chart.removeSeries(rsiRef.current);
      rsiRef.current = null;
    }

    // 7b. MACD panel
    if (hasMacd) {
      const macdSlot = slots.find((s) => s.name === "macd")!.slot;
      const histData = series.macdData!.map((p) => ({
        time: p.time as Time,
        value: p.hist,
        color: p.hist >= 0 ? "#22c55e88" : "#ef444488",
      }));
      const macdLineData = series.macdData!.map((p) => ({
        time: p.time as Time,
        value: p.macd,
      }));
      const signalData = series.macdData!.map((p) => ({
        time: p.time as Time,
        value: p.signal,
      }));

      if (!macdHistRef.current) {
        macdHistRef.current = chart.addHistogramSeries({
          priceScaleId: "macd",
          priceLineVisible: false,
          lastValueVisible: false,
        });
        chart.priceScale("macd").applyOptions({ drawTicks: false, borderVisible: false });
      }
      if (!macdLineRef.current) {
        macdLineRef.current = chart.addLineSeries({
          priceScaleId: "macd",
          color: COLOR_MACD,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      if (!macdSignalRef.current) {
        macdSignalRef.current = chart.addLineSeries({
          priceScaleId: "macd",
          color: COLOR_SIGNAL,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      chart.priceScale("macd").applyOptions({ scaleMargins: panelMargins(macdSlot) });
      macdHistRef.current.setData(histData);
      macdLineRef.current.setData(macdLineData as LineData<Time>[]);
      macdSignalRef.current.setData(signalData as LineData<Time>[]);
    } else {
      if (macdHistRef.current) { chart.removeSeries(macdHistRef.current); macdHistRef.current = null; }
      if (macdLineRef.current) { chart.removeSeries(macdLineRef.current); macdLineRef.current = null; }
      if (macdSignalRef.current) { chart.removeSeries(macdSignalRef.current); macdSignalRef.current = null; }
    }

    // 8. Alarm price lines
    for (const line of alarmLinesRef.current) {
      try { candle.removePriceLine(line); } catch { /* ignore */ }
    }
    alarmLinesRef.current = [];
    if (series.alarmLevels?.length) {
      for (const alarm of series.alarmLevels) {
        const line = candle.createPriceLine({
          price: alarm.price,
          color: alarm.condition === "above" ? "#f59e0b" : "#a78bfa",
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: alarm.label ? `⏰ ${alarm.label}` : "⏰",
        });
        alarmLinesRef.current.push(line);
      }
    }

    // 9. Swing S/R level lines
    for (const line of srLinesRef.current) {
      try { candle.removePriceLine(line); } catch { /* ignore */ }
    }
    srLinesRef.current = [];
    if (series.srLevels?.length) {
      for (const sr of series.srLevels) {
        const line = candle.createPriceLine({
          price: sr.price,
          color: sr.type === "support" ? "#22c55e88" : "#ef444488",
          lineWidth: 1,
          lineStyle: 1, // dotted
          axisLabelVisible: true,
          title: sr.type === "support" ? "S" : "R",
        });
        srLinesRef.current.push(line);
      }
    }

    // 10. Open trade level lines (entry/SL/TP)
    for (const line of tradeLinesRef.current) {
      try { candle.removePriceLine(line); } catch { /* ignore */ }
    }
    tradeLinesRef.current = [];
    if (series.tradeLevels?.length) {
      const TRADE_LINE_COLORS: Record<string, string> = {
        entry: "#3b82f6",
        sl: "#ef4444",
        tp1: "#22c55e",
        tp2: "#86efac",
      };
      const TRADE_LINE_TITLES: Record<string, string> = {
        entry: "Entry",
        sl: "SL",
        tp1: "TP1",
        tp2: "TP2",
      };
      for (const tl of series.tradeLevels) {
        const color = TRADE_LINE_COLORS[tl.kind] ?? "#ffffff";
        const line = candle.createPriceLine({
          price: tl.price,
          color,
          lineWidth: 1,
          lineStyle: tl.kind === "entry" ? 0 : 2, // solid for entry, dashed for SL/TP
          axisLabelVisible: true,
          title: TRADE_LINE_TITLES[tl.kind] ?? tl.kind,
        });
        tradeLinesRef.current.push(line);
      }
    }

    // 10b. Current live price line
    if (currentPriceLineRef.current) {
      try { candle.removePriceLine(currentPriceLineRef.current); } catch { /* ignore */ }
      currentPriceLineRef.current = null;
    }
    if (series.currentPrice && series.currentPrice > 0) {
      currentPriceLineRef.current = candle.createPriceLine({
        price: series.currentPrice,
        color: COLOR_LIVE,
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: true,
        title: "LIVE",
      });
    }

    // 11. Trade markers
    if (series.markers?.length) {
      const markers: SeriesMarker<Time>[] = series.markers.map((m) => ({
        time: m.time as Time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      }));
      candle.setMarkers(markers);
    } else {
      candle.setMarkers([]);
    }

    chart.timeScale().fitContent();
  }, [series]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
