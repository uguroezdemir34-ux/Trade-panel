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

import { useEffect, useRef, useState } from "react";
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
  type MouseEventParams,
} from "lightweight-charts";
import type { ChartSeries } from "@/lib/chart/types";

interface Props {
  series: ChartSeries;
  height?: number;
  theme?: "dark" | "light";
  /** Called when user clicks on the chart (y-coordinate → price) */
  onPriceClick?: (price: number) => void;
  /** Change when pair/TF changes to trigger a fitContent() reset */
  resetKey?: string;
}

const COLOR_UP       = "#22c55e";
const COLOR_DOWN     = "#ef4444";
const COLOR_EMA20    = "#3b82f6";
const COLOR_EMA50    = "#f59e0b";
const COLOR_EMA200   = "#a855f7";
const COLOR_RSI      = "#ec4899";
const COLOR_BB       = "#06b6d4";
const COLOR_VWAP     = "#f97316";
const COLOR_MACD     = "#3b82f6";
const COLOR_SIGNAL   = "#f59e0b";
const COLOR_LIVE     = "#3b82f6";

const THEME_COLORS = {
  dark:  { grid: "#2d2d2d", text: "#a3a3a3", border: "#2d2d2d" },
  light: { grid: "#e5e5e5", text: "#525252",  border: "#e5e5e5" },
} as const;

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

function computeSlots(hasVol: boolean, hasRsi: boolean, hasMacd: boolean) {
  const slots: { name: string; slot: number }[] = [];
  let next = 0;
  if (hasMacd) slots.push({ name: "macd", slot: next++ });
  if (hasRsi)  slots.push({ name: "rsi",  slot: next++ });
  if (hasVol)  slots.push({ name: "volume", slot: next++ });
  return slots;
}

interface CrosshairInfo {
  open: number; high: number; low: number; close: number; volume?: number;
}

function fmtVal(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

export function PriceChart({ series, height = 400, theme = "dark", onPriceClick, resetKey }: Props): React.ReactElement {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawnLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());
  const onPriceClickRef = useRef(onPriceClick);
  const ema20Ref      = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref      = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref     = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiRef        = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef   = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const alarmLinesRef = useRef<IPriceLine[]>([]);
  const srLinesRef    = useRef<IPriceLine[]>([]);
  const tradeLinesRef = useRef<IPriceLine[]>([]);
  const currentPriceLineRef = useRef<IPriceLine | null>(null);
  const bbUpperRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef       = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapUpperRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapLowerRef  = useRef<ISeriesApi<"Line"> | null>(null);
  // fitContent guard — resets when resetKey changes, preventing zoom reset on every tick
  const didFitRef    = useRef(false);
  const resetKeyRef  = useRef<string | undefined>(undefined);
  // Crosshair OHLCV overlay
  const [crosshairData, setCrosshairData] = useState<CrosshairInfo | null>(null);

  // ─── Mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // New chart instance always needs fitContent on first data load
    didFitRef.current = false;
    resetKeyRef.current = undefined;

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
        rightOffset: 8,
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

    // Wire click → price callback
    chart.subscribeClick((param) => {
      if (!param.point || !candleRef.current) return;
      const price = candleRef.current.coordinateToPrice(param.point.y);
      if (price !== null && price > 0) {
        onPriceClickRef.current?.(price);
      }
    });

    // Wire crosshair → OHLCV overlay
    const crosshairHandler = (param: MouseEventParams<Time>) => {
      if (!param.point) { setCrosshairData(null); return; }
      const cd = param.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined;
      if (!cd) { setCrosshairData(null); return; }
      const volSeries = volumeRef.current;
      const vd = volSeries ? (param.seriesData.get(volSeries) as { value?: number } | undefined) : undefined;
      setCrosshairData({ open: cd.open, high: cd.high, low: cd.low, close: cd.close, volume: vd?.value });
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler);
      ro.disconnect();
      chart.remove();
      drawnLinesMapRef.current.clear();
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

  // ─── Keep click callback ref fresh ─────────────────────────────────────
  useEffect(() => {
    onPriceClickRef.current = onPriceClick;
  }, [onPriceClick]);

  // ─── Sync drawn horizontal lines ────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.drawnLines ?? [];
    const incomingIds = new Set(incoming.map((l) => l.id));

    for (const [id, priceLine] of drawnLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { candle.removePriceLine(priceLine); } catch { /* ignore */ }
        drawnLinesMapRef.current.delete(id);
      }
    }
    for (const dl of incoming) {
      if (!drawnLinesMapRef.current.has(dl.id)) {
        const pl = candle.createPriceLine({
          price: dl.price,
          color: dl.color,
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: dl.label ?? "",
        });
        drawnLinesMapRef.current.set(dl.id, pl);
      }
    }
  }, [series.drawnLines]);

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

    const hasVol  = !!(series.volume?.length);
    const hasRsi  = !!(series.rsi?.length);
    const hasMacd = !!(series.macdData?.length);

    const slots = computeSlots(hasVol, hasRsi, hasMacd);
    const panelCount = slots.length;

    chart.priceScale("right").applyOptions({
      scaleMargins: candleMargins(panelCount),
    });

    candle.setData(series.candles as CandlestickData<Time>[]);

    // EMA20
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

    // EMA50
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

    // EMA200
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

    // Bollinger Bands
    if (series.bb?.upper.length) {
      const bbOpts = {
        color: COLOR_BB, lineWidth: 1 as const, lineStyle: 0 as const,
        priceLineVisible: false, lastValueVisible: false,
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

    // VWAP
    if (series.vwap?.vwap.length) {
      const vwapOpts = { priceLineVisible: false, lastValueVisible: true };
      if (!vwapRef.current) {
        vwapRef.current = chart.addLineSeries({ ...vwapOpts, color: COLOR_VWAP, lineWidth: 2 });
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

    // Volume histogram
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

    // RSI panel
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

    // MACD panel
    if (hasMacd) {
      const macdSlot = slots.find((s) => s.name === "macd")!.slot;
      const histData = series.macdData!.map((p) => ({
        time: p.time as Time,
        value: p.hist,
        color: p.hist >= 0 ? "#22c55e88" : "#ef444488",
      }));
      const macdLineData = series.macdData!.map((p) => ({ time: p.time as Time, value: p.macd }));
      const signalData   = series.macdData!.map((p) => ({ time: p.time as Time, value: p.signal }));

      if (!macdHistRef.current) {
        macdHistRef.current = chart.addHistogramSeries({
          priceScaleId: "macd", priceLineVisible: false, lastValueVisible: false,
        });
        chart.priceScale("macd").applyOptions({ drawTicks: false, borderVisible: false });
      }
      if (!macdLineRef.current) {
        macdLineRef.current = chart.addLineSeries({
          priceScaleId: "macd", color: COLOR_MACD, lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false,
        });
      }
      if (!macdSignalRef.current) {
        macdSignalRef.current = chart.addLineSeries({
          priceScaleId: "macd", color: COLOR_SIGNAL, lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false,
        });
      }
      chart.priceScale("macd").applyOptions({ scaleMargins: panelMargins(macdSlot) });
      macdHistRef.current.setData(histData);
      macdLineRef.current.setData(macdLineData as LineData<Time>[]);
      macdSignalRef.current.setData(signalData as LineData<Time>[]);
    } else {
      if (macdHistRef.current)   { chart.removeSeries(macdHistRef.current);   macdHistRef.current   = null; }
      if (macdLineRef.current)   { chart.removeSeries(macdLineRef.current);   macdLineRef.current   = null; }
      if (macdSignalRef.current) { chart.removeSeries(macdSignalRef.current); macdSignalRef.current = null; }
    }

    // Alarm price lines
    for (const line of alarmLinesRef.current) {
      try { candle.removePriceLine(line); } catch { /* ignore */ }
    }
    alarmLinesRef.current = [];
    if (series.alarmLevels?.length) {
      for (const alarm of series.alarmLevels) {
        const line = candle.createPriceLine({
          price: alarm.price,
          color: alarm.condition === "above" ? "#f59e0b" : "#a78bfa",
          lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
          title: alarm.label ? `⏰ ${alarm.label}` : "⏰",
        });
        alarmLinesRef.current.push(line);
      }
    }

    // S/R level lines
    for (const line of srLinesRef.current) {
      try { candle.removePriceLine(line); } catch { /* ignore */ }
    }
    srLinesRef.current = [];
    if (series.srLevels?.length) {
      for (const sr of series.srLevels) {
        const line = candle.createPriceLine({
          price: sr.price,
          color: sr.type === "support" ? "#22c55e88" : "#ef444488",
          lineWidth: 1, lineStyle: 1, axisLabelVisible: true,
          title: sr.type === "support" ? "S" : "R",
        });
        srLinesRef.current.push(line);
      }
    }

    // Open trade level lines
    for (const line of tradeLinesRef.current) {
      try { candle.removePriceLine(line); } catch { /* ignore */ }
    }
    tradeLinesRef.current = [];
    if (series.tradeLevels?.length) {
      const COLORS: Record<string, string> = { entry: "#3b82f6", sl: "#ef4444", tp1: "#22c55e", tp2: "#86efac" };
      const TITLES: Record<string, string> = { entry: "Entry", sl: "SL", tp1: "TP1", tp2: "TP2" };
      for (const tl of series.tradeLevels) {
        const line = candle.createPriceLine({
          price: tl.price,
          color: COLORS[tl.kind] ?? "#ffffff",
          lineWidth: 1,
          lineStyle: tl.kind === "entry" ? 0 : 2,
          axisLabelVisible: true,
          title: TITLES[tl.kind] ?? tl.kind,
        });
        tradeLinesRef.current.push(line);
      }
    }

    // Live price line
    if (currentPriceLineRef.current) {
      try { candle.removePriceLine(currentPriceLineRef.current); } catch { /* ignore */ }
      currentPriceLineRef.current = null;
    }
    if (series.currentPrice && series.currentPrice > 0) {
      currentPriceLineRef.current = candle.createPriceLine({
        price: series.currentPrice,
        color: COLOR_LIVE, lineWidth: 1, lineStyle: 3,
        axisLabelVisible: true, title: "LIVE",
      });
    }

    // Trade markers
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

    // fitContent only on first load per pair/TF (resetKey change resets the guard)
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      didFitRef.current = false;
    }
    if (!didFitRef.current && series.candles.length > 0) {
      chart.timeScale().fitContent();
      didFitRef.current = true;
    }
  }, [series, resetKey]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {crosshairData && (
        <div className="absolute top-1 left-1 z-10 flex gap-2.5 rounded bg-bg-card/90 border border-border px-2 py-1 font-mono text-2xs text-text-t2 pointer-events-none select-none">
          <span>
            <span className="text-text-t4">O </span>
            <span className={crosshairData.close >= crosshairData.open ? "text-green-400" : "text-red-400"}>
              {fmtVal(crosshairData.open)}
            </span>
          </span>
          <span>
            <span className="text-text-t4">H </span>
            <span className="text-green-400">{fmtVal(crosshairData.high)}</span>
          </span>
          <span>
            <span className="text-text-t4">L </span>
            <span className="text-red-400">{fmtVal(crosshairData.low)}</span>
          </span>
          <span>
            <span className="text-text-t4">C </span>
            <span className={crosshairData.close >= crosshairData.open ? "text-green-400" : "text-red-400"}>
              {fmtVal(crosshairData.close)}
            </span>
          </span>
          {crosshairData.volume !== undefined && (
            <span>
              <span className="text-text-t4">V </span>
              {fmtVol(crosshairData.volume)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
