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
import type { ChartSeries, LiqBand } from "@/lib/chart/types";
import { VerticalLinePrimitive } from "@/lib/chart/primitives/VerticalLinePrimitive";
import { CrossLinePrimitive } from "@/lib/chart/primitives/CrossLinePrimitive";
import { FibTimeZonePrimitive } from "@/lib/chart/primitives/FibTimeZonePrimitive";

interface Props {
  series: ChartSeries;
  height?: number;
  theme?: "dark" | "light";
  /** Called when user clicks on the chart: price from coordinateToPrice + bar time (undefined in empty areas) */
  onChartClick?: (price: number, time: number | undefined) => void;
  /** Change when pair/TF changes to trigger a fitContent() reset */
  resetKey?: string;
  /** Liq magnet bands — separate prop so price-tick updates don't re-run the full series effect */
  liqBands?: LiqBand[];
  /** Live price line — separate prop so price-tick updates don't re-run the full series effect */
  currentPrice?: number;
  /** When true, overlay div captures pointer events for drawing input; false = transparent (LWC pan/zoom normal) */
  isDrawingMode?: boolean;
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

const EXT_SECONDS = 100_000_000;

const FIB_EXT_RATIOS = [
  { r: 0,     label: "0%",     ext: false },
  { r: 0.236, label: "23.6%",  ext: false },
  { r: 0.382, label: "38.2%",  ext: false },
  { r: 0.5,   label: "50%",    ext: false },
  { r: 0.618, label: "61.8%",  ext: false },
  { r: 0.786, label: "78.6%",  ext: false },
  { r: 1,     label: "100%",   ext: false },
  { r: 1.272, label: "127.2%", ext: true  },
  { r: 1.414, label: "141.4%", ext: true  },
  { r: 1.618, label: "161.8%", ext: true  },
];

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

export function PriceChart({ series, height = 400, theme = "dark", onChartClick, resetKey, liqBands, currentPrice, isDrawingMode = false }: Props): React.ReactElement {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const drawnLinesMapRef    = useRef<Map<string, IPriceLine>>(new Map());
  const liqBandsMapRef      = useRef<Map<string, IPriceLine[]>>(new Map());
  const trendLinesMapRef    = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const fibLinesMapRef      = useRef<Map<string, IPriceLine[]>>(new Map());
  const rayLinesMapRef      = useRef<Map<string, IPriceLine>>(new Map());
  const extLinesMapRef      = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const channelsMapRef      = useRef<Map<string, [ISeriesApi<"Line">, ISeriesApi<"Line">, ISeriesApi<"Line">]>>(new Map());
  const fibExtMapRef        = useRef<Map<string, IPriceLine[]>>(new Map());
  const verticalLinesMapRef  = useRef<Map<string, VerticalLinePrimitive>>(new Map());
  const crossLinesMapRef     = useRef<Map<string, CrossLinePrimitive>>(new Map());
  const fibTimeZonesMapRef   = useRef<Map<string, FibTimeZonePrimitive>>(new Map());
  const onChartClickRef  = useRef(onChartClick);
  const pointerStartRef  = useRef<{ x: number; y: number } | null>(null);
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
      for (const lines of liqBandsMapRef.current.values()) {
        for (const pl of lines) { try { candle.removePriceLine(pl); } catch { /* ignore */ } }
      }
      liqBandsMapRef.current.clear();
      trendLinesMapRef.current.clear();
      fibLinesMapRef.current.clear();
      rayLinesMapRef.current.clear();
      extLinesMapRef.current.clear();
      channelsMapRef.current.clear();
      fibExtMapRef.current.clear();
      verticalLinesMapRef.current.clear();
      crossLinesMapRef.current.clear();
      fibTimeZonesMapRef.current.clear();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Keep click callback ref fresh ─────────────────────────────────────
  useEffect(() => {
    onChartClickRef.current = onChartClick;
  }, [onChartClick]);

  // ─── Height resize (applyOptions, no chart recreation) ──────────────────
  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

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

  // ─── Sync Liq Magnet bands (direct prop — not via series to avoid full chart re-sync on every price tick) ───
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = liqBands ?? [];
    const incomingIds = new Set(incoming.map((b) => b.id));

    // Remove bands no longer in incoming
    for (const [id, lines] of liqBandsMapRef.current) {
      if (!incomingIds.has(id)) {
        for (const pl of lines) { try { candle.removePriceLine(pl); } catch { /* ignore */ } }
        liqBandsMapRef.current.delete(id);
      }
    }
    for (const band of incoming) {
      const bw = band.price * 0.010;
      const existing = liqBandsMapRef.current.get(band.id);
      if (existing) {
        // Update price lines in-place (Fix 4: band price changes with livePrice)
        const [center, upper, lower] = existing;
        try {
          center.applyOptions({ price: band.price });
          upper.applyOptions({ price: band.price + bw });
          lower.applyOptions({ price: band.price - bw });
        } catch { /* ignore */ }
        continue;
      }
      const isLong = band.side === "long";
      const baseColor = isLong ? "#22c55e" : "#ef4444";
      const alpha = Math.max(0.45, Math.min(0.80, band.intensity + 0.2));
      const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
      try {
        const center = candle.createPriceLine({
          price: band.price,
          color: `${baseColor}${alphaHex}`,
          lineWidth: 3,
          lineStyle: 0,
          axisLabelVisible: true,
          title: isLong ? `Liq Pool ↓ ${(band.intensity * 100).toFixed(0)}%` : `Liq Pool ↑ ${(band.intensity * 100).toFixed(0)}%`,
        });
        const upper = candle.createPriceLine({
          price: band.price + bw,
          color: `${baseColor}38`,
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: false,
          title: "",
        });
        const lower = candle.createPriceLine({
          price: band.price - bw,
          color: `${baseColor}38`,
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: false,
          title: "",
        });
        liqBandsMapRef.current.set(band.id, [center, upper, lower]);
      } catch (err) {
        console.error("[LiqBands] createPriceLine failed, skipping band:", band.id, err);
      }
    }
  }, [liqBands]);

  // ─── Sync trend lines (diagonal LineSeries) ──────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const incoming = series.trendLines ?? [];
    const incomingIds = new Set(incoming.map((l) => l.id));

    for (const [id, ls] of trendLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { chart.removeSeries(ls); } catch { /* ignore */ }
        trendLinesMapRef.current.delete(id);
      }
    }
    for (const tl of incoming) {
      if (trendLinesMapRef.current.has(tl.id)) continue;
      // Ensure ascending time order (lightweight-charts requires unique sorted times)
      let pt1 = tl.p1, pt2 = tl.p2;
      if (tl.p1.time > tl.p2.time) { pt1 = tl.p2; pt2 = tl.p1; }
      else if (tl.p1.time === tl.p2.time) { pt2 = { ...tl.p2, time: tl.p2.time + 1 }; }
      const ls = chart.addLineSeries({
        color: tl.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ls.setData([
        { time: pt1.time as Time, value: pt1.price },
        { time: pt2.time as Time, value: pt2.price },
      ]);
      trendLinesMapRef.current.set(tl.id, ls);
    }
  }, [series.trendLines]);

  // ─── Sync Fibonacci levels (7 price lines per fib) ───────────────────────
  const FIB_RATIOS = [
    { r: 0,     label: "0%" },
    { r: 0.236, label: "23.6%" },
    { r: 0.382, label: "38.2%" },
    { r: 0.5,   label: "50%" },
    { r: 0.618, label: "61.8%" },
    { r: 0.786, label: "78.6%" },
    { r: 1,     label: "100%" },
  ];

  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.fibLevels ?? [];
    const incomingIds = new Set(incoming.map((f) => f.id));

    for (const [id, lines] of fibLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        for (const pl of lines) {
          try { candle.removePriceLine(pl); } catch { /* ignore */ }
        }
        fibLinesMapRef.current.delete(id);
      }
    }
    for (const fib of incoming) {
      if (fibLinesMapRef.current.has(fib.id)) continue;
      const high  = Math.max(fib.p1Price, fib.p2Price);
      const low   = Math.min(fib.p1Price, fib.p2Price);
      const range = high - low;
      const lines: IPriceLine[] = [];
      for (const { r, label } of FIB_RATIOS) {
        const pl = candle.createPriceLine({
          price: high - range * r,
          color: fib.color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: label,
        });
        lines.push(pl);
      }
      fibLinesMapRef.current.set(fib.id, lines);
    }
  }, [series.fibLevels]);

  // ─── Sync ray lines (horizontal rays, identical render to drawnLines) ────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.rayLines ?? [];
    const incomingIds = new Set(incoming.map((l) => l.id));
    for (const [id, pl] of rayLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { candle.removePriceLine(pl); } catch { /* ignore */ }
        rayLinesMapRef.current.delete(id);
      }
    }
    for (const rl of incoming) {
      if (rayLinesMapRef.current.has(rl.id)) continue;
      const pl = candle.createPriceLine({
        price: rl.price,
        color: rl.color,
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: rl.label ?? "",
      });
      rayLinesMapRef.current.set(rl.id, pl);
    }
  }, [series.rayLines]);

  // ─── Sync extended lines (diagonal, extrapolated ~3yr each direction) ────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const incoming = series.extLines ?? [];
    const incomingIds = new Set(incoming.map((l) => l.id));
    for (const [id, ls] of extLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { chart.removeSeries(ls); } catch { /* ignore */ }
        extLinesMapRef.current.delete(id);
      }
    }
    for (const el of incoming) {
      if (extLinesMapRef.current.has(el.id)) continue;
      let pt1 = el.p1, pt2 = el.p2;
      if (pt1.time > pt2.time) { [pt1, pt2] = [pt2, pt1]; }
      else if (pt1.time === pt2.time) { pt2 = { ...pt2, time: pt2.time + 1 }; }
      const dt = pt2.time - pt1.time;
      const slope = (pt2.price - pt1.price) / dt;
      const farLeft  = pt1.time - EXT_SECONDS;
      const farRight = pt2.time + EXT_SECONDS;
      const ls = chart.addLineSeries({
        color: el.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ls.setData([
        { time: farLeft  as Time, value: pt1.price + slope * (farLeft  - pt1.time) },
        { time: farRight as Time, value: pt1.price + slope * (farRight - pt1.time) },
      ]);
      extLinesMapRef.current.set(el.id, ls);
    }
  }, [series.extLines]);

  // ─── Sync parallel channels (3 LineSeries: base / mid dashed / outer) ────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const incoming = series.channels ?? [];
    const incomingIds = new Set(incoming.map((c) => c.id));
    for (const [id, [ls1, ls2, ls3]] of channelsMapRef.current) {
      if (!incomingIds.has(id)) {
        try { chart.removeSeries(ls1); chart.removeSeries(ls2); chart.removeSeries(ls3); } catch { /* ignore */ }
        channelsMapRef.current.delete(id);
      }
    }
    for (const ch of incoming) {
      if (channelsMapRef.current.has(ch.id)) continue;
      let pt1 = ch.p1, pt2 = ch.p2;
      if (pt1.time > pt2.time) { [pt1, pt2] = [pt2, pt1]; }
      else if (pt1.time === pt2.time) { pt2 = { ...pt2, time: pt2.time + 1 }; }
      const lineOpts = {
        color: ch.color,
        lineWidth: 1 as const,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      };
      const ls1 = chart.addLineSeries(lineOpts);
      const ls2 = chart.addLineSeries({ ...lineOpts, lineStyle: 2 as const });
      const ls3 = chart.addLineSeries(lineOpts);
      ls1.setData([
        { time: pt1.time as Time, value: pt1.price },
        { time: pt2.time as Time, value: pt2.price },
      ]);
      ls2.setData([
        { time: pt1.time as Time, value: pt1.price + ch.offset / 2 },
        { time: pt2.time as Time, value: pt2.price + ch.offset / 2 },
      ]);
      ls3.setData([
        { time: pt1.time as Time, value: pt1.price + ch.offset },
        { time: pt2.time as Time, value: pt2.price + ch.offset },
      ]);
      channelsMapRef.current.set(ch.id, [ls1, ls2, ls3]);
    }
  }, [series.channels]);

  // ─── Sync Fibonacci extensions (10 levels: retracement + 127/141/161%) ───
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.fibExtensions ?? [];
    const incomingIds = new Set(incoming.map((f) => f.id));
    for (const [id, lines] of fibExtMapRef.current) {
      if (!incomingIds.has(id)) {
        for (const pl of lines) { try { candle.removePriceLine(pl); } catch { /* ignore */ } }
        fibExtMapRef.current.delete(id);
      }
    }
    for (const fib of incoming) {
      if (fibExtMapRef.current.has(fib.id)) continue;
      const high  = Math.max(fib.p1Price, fib.p2Price);
      const low   = Math.min(fib.p1Price, fib.p2Price);
      const range = high - low;
      const lines: IPriceLine[] = [];
      for (const { r, label, ext } of FIB_EXT_RATIOS) {
        const pl = candle.createPriceLine({
          price: high - range * r,
          color: fib.color,
          lineWidth: 1,
          lineStyle: ext ? 0 : 2,
          axisLabelVisible: true,
          title: label,
        });
        lines.push(pl);
      }
      fibExtMapRef.current.set(fib.id, lines);
    }
  }, [series.fibExtensions]);

  // ─── Sync vertical lines (primitive — LWC ISeriesPrimitive API) ──────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.verticalLines ?? [];
    const incomingIds = new Set(incoming.map((v) => v.id));

    for (const [id, primitive] of verticalLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { (candle as any).detachPrimitive(primitive); } catch { /* ignore */ }
        verticalLinesMapRef.current.delete(id);
      }
    }
    for (const vl of incoming) {
      if (verticalLinesMapRef.current.has(vl.id)) continue;
      const primitive = new VerticalLinePrimitive(vl);
      try { (candle as any).attachPrimitive(primitive); } catch { /* ignore */ }
      verticalLinesMapRef.current.set(vl.id, primitive);
    }
  }, [series.verticalLines]);

  // ─── Sync cross lines (primitive — horiz + vert through one point) ──────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.crossLines ?? [];
    const incomingIds = new Set(incoming.map((c) => c.id));

    for (const [id, primitive] of crossLinesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { (candle as any).detachPrimitive(primitive); } catch { /* ignore */ }
        crossLinesMapRef.current.delete(id);
      }
    }
    for (const cl of incoming) {
      if (crossLinesMapRef.current.has(cl.id)) continue;
      const primitive = new CrossLinePrimitive(cl);
      try { (candle as any).attachPrimitive(primitive); } catch { /* ignore */ }
      crossLinesMapRef.current.set(cl.id, primitive);
    }
  }, [series.crossLines]);

  // ─── Sync Fibonacci time zones (primitive — N vertical lines) ────────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    const incoming = series.fibTimeZones ?? [];
    const incomingIds = new Set(incoming.map((f) => f.id));

    for (const [id, primitive] of fibTimeZonesMapRef.current) {
      if (!incomingIds.has(id)) {
        try { (candle as any).detachPrimitive(primitive); } catch { /* ignore */ }
        fibTimeZonesMapRef.current.delete(id);
      }
    }
    for (const ftz of incoming) {
      if (fibTimeZonesMapRef.current.has(ftz.id)) continue;
      const primitive = new FibTimeZonePrimitive(ftz);
      try { (candle as any).attachPrimitive(primitive); } catch { /* ignore */ }
      fibTimeZonesMapRef.current.set(ftz.id, primitive);
    }
  }, [series.fibTimeZones]);

  // ─── Live price line (separate prop — updates every WS tick without re-running full series effect) ──
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    if (currentPrice && currentPrice > 0) {
      if (currentPriceLineRef.current) {
        // Update in-place — no flicker
        try { currentPriceLineRef.current.applyOptions({ price: currentPrice }); } catch { /* ignore */ }
      } else {
        try {
          currentPriceLineRef.current = candle.createPriceLine({
            price: currentPrice,
            color: COLOR_LIVE, lineWidth: 1, lineStyle: 3,
            axisLabelVisible: true, title: "LIVE",
          });
        } catch { /* ignore */ }
      }
    } else if (currentPriceLineRef.current) {
      try { candle.removePriceLine(currentPriceLineRef.current); } catch { /* ignore */ }
      currentPriceLineRef.current = null;
    }
  }, [currentPrice]);

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
          title: tl.label ?? TITLES[tl.kind] ?? tl.kind,
        });
        tradeLinesRef.current.push(line);
      }
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
      // Re-enable autoScale so Y axis adjusts to new pair's price range
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
    if (!didFitRef.current && series.candles.length > 0) {
      chart.timeScale().fitContent();
      didFitRef.current = true;
    }
  }, [series, resetKey]);

  return (
    <div className="relative w-full" style={{ height }}>
      {/* LWC mount point — no event handlers; all drawing input comes from overlay below */}
      <div ref={containerRef} className="w-full h-full" />
      {/*
        Drawing input overlay — architecture rationale:
        - LWC canvas absorbs touch events internally (preventDefault) and subscribeClick is
          unreliable on mobile ("working as intended" per LWC issue #1417).
        - When drawing mode is OFF: pointer-events:none → fully transparent, LWC pan/zoom unaffected.
        - When drawing mode is ON:  pointer-events:auto + touch-action:none → overlay captures all
          pointer input before the browser can interpret it as scroll/pan. PointerEvent API fires
          identically on mouse, iOS touch, Android touch, and PWA. 10px tap threshold handles
          mobile finger jitter (vs. 4px which was too tight).
      */}
      <div
        className="absolute inset-0"
        style={{
          pointerEvents: isDrawingMode ? "auto" : "none",
          touchAction: "none",
          cursor: isDrawingMode ? "crosshair" : "default",
        }}
        onPointerDown={(e) => {
          pointerStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
        onPointerUp={(e) => {
          const start = pointerStartRef.current;
          pointerStartRef.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (dx * dx + dy * dy > 900) return; // >30px = pan/drag, not a tap (mobile ~11-15px jitter)
          const chart = chartRef.current;
          const candle = candleRef.current;
          if (!chart || !candle) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const price = candle.coordinateToPrice(y);
          if (price === null || price <= 0) return;
          const resolved = chart.timeScale().coordinateToTime(x);
          const time = resolved != null ? (resolved as number) : undefined;
          onChartClickRef.current?.(price, time);
        }}
      />
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
