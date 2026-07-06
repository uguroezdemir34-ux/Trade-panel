"use client";

/**
 * PRICE CHART V2 — lightweight-charts v4 wrapper.
 *
 * Architecture changes vs V1 (PriceChart.tsx):
 *   - 17 useEffects → 6 useEffects
 *   - Drawing overlays arrive as separate stable props (not via series)
 *   - liqBands dead prop removed
 *   - Chart config constants imported from lib/chart/config
 *   - onChartClick ref updated at render time (no dedicated effect)
 *
 * Effect map:
 *   1. []                    — mount: chart init, ResizeObserver, crosshair, cleanup
 *   2. [height]              — applyOptions({height})
 *   3. [theme]               — applyOptions(colors)
 *   4. [series, resetKey]    — all indicator data + fitContent guard
 *   5. [currentPrice]        — live price line (WS hot path, isolated)
 *   6. [drawnLines, …9more]  — all 10 drawing overlay types merged
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
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
import type {
  ChartSeries,
  DrawnLine,
  TrendLine,
  FibLevel,
  RayLine,
  ExtendedLine,
  ParallelChannel,
  FibExtension,
  VerticalLine,
  CrossLine,
  FibTimeZone,
} from "@/lib/chart/types";
import { VerticalLinePrimitive } from "@/lib/chart/primitives/VerticalLinePrimitive";
import { CrossLinePrimitive } from "@/lib/chart/primitives/CrossLinePrimitive";
import { FibTimeZonePrimitive } from "@/lib/chart/primitives/FibTimeZonePrimitive";
import {
  SERIES_COLORS,
  THEME_COLORS,
  CHART_DEFAULTS,
  panelMargins,
  candleMargins,
  computeSlots,
} from "@/lib/chart/config";

// ─── Module-level constants ────────────────────────────────────────────────

const EXT_SECONDS = 100_000_000;

const FIB_RATIOS = [
  { r: 0,     label: "0%"    },
  { r: 0.236, label: "23.6%" },
  { r: 0.382, label: "38.2%" },
  { r: 0.5,   label: "50%"   },
  { r: 0.618, label: "61.8%" },
  { r: 0.786, label: "78.6%" },
  { r: 1,     label: "100%"  },
] as const;

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
] as const;

// ─── Drawing sync helpers (pure, no closures) ─────────────────────────────

function syncHLines(
  candle: ISeriesApi<"Candlestick">,
  incoming: DrawnLine[],
  map: Map<string, IPriceLine>,
) {
  const ids = new Set(incoming.map((l) => l.id));
  for (const [id, pl] of map) {
    if (!ids.has(id)) {
      try { candle.removePriceLine(pl); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const dl of incoming) {
    if (map.has(dl.id)) continue;
    const pl = candle.createPriceLine({
      price: dl.price, color: dl.color,
      lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: dl.label ?? "",
    });
    map.set(dl.id, pl);
  }
}

function syncRayLines(
  candle: ISeriesApi<"Candlestick">,
  incoming: RayLine[],
  map: Map<string, IPriceLine>,
) {
  const ids = new Set(incoming.map((l) => l.id));
  for (const [id, pl] of map) {
    if (!ids.has(id)) {
      try { candle.removePriceLine(pl); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const rl of incoming) {
    if (map.has(rl.id)) continue;
    const pl = candle.createPriceLine({
      price: rl.price, color: rl.color,
      lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: rl.label ?? "",
    });
    map.set(rl.id, pl);
  }
}

function syncFibLevels(
  candle: ISeriesApi<"Candlestick">,
  incoming: FibLevel[],
  map: Map<string, IPriceLine[]>,
) {
  const ids = new Set(incoming.map((f) => f.id));
  for (const [id, lines] of map) {
    if (!ids.has(id)) {
      for (const pl of lines) { try { candle.removePriceLine(pl); } catch { /* ignore */ } }
      map.delete(id);
    }
  }
  for (const fib of incoming) {
    if (map.has(fib.id)) continue;
    const high  = Math.max(fib.p1Price, fib.p2Price);
    const low   = Math.min(fib.p1Price, fib.p2Price);
    const range = high - low;
    const lines: IPriceLine[] = [];
    for (const { r, label } of FIB_RATIOS) {
      const pl = candle.createPriceLine({
        price: high - range * r, color: fib.color,
        lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: label,
      });
      lines.push(pl);
    }
    map.set(fib.id, lines);
  }
}

function syncFibExtensions(
  candle: ISeriesApi<"Candlestick">,
  incoming: FibExtension[],
  map: Map<string, IPriceLine[]>,
) {
  const ids = new Set(incoming.map((f) => f.id));
  for (const [id, lines] of map) {
    if (!ids.has(id)) {
      for (const pl of lines) { try { candle.removePriceLine(pl); } catch { /* ignore */ } }
      map.delete(id);
    }
  }
  for (const fib of incoming) {
    if (map.has(fib.id)) continue;
    const high  = Math.max(fib.p1Price, fib.p2Price);
    const low   = Math.min(fib.p1Price, fib.p2Price);
    const range = high - low;
    const lines: IPriceLine[] = [];
    for (const { r, label, ext } of FIB_EXT_RATIOS) {
      const pl = candle.createPriceLine({
        price: high - range * r, color: fib.color,
        lineWidth: 1, lineStyle: ext ? 0 : 2, axisLabelVisible: true, title: label,
      });
      lines.push(pl);
    }
    map.set(fib.id, lines);
  }
}

function syncTrendLines(
  chart: IChartApi,
  incoming: TrendLine[],
  map: Map<string, ISeriesApi<"Line">>,
) {
  const ids = new Set(incoming.map((l) => l.id));
  for (const [id, ls] of map) {
    if (!ids.has(id)) {
      try { chart.removeSeries(ls); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const tl of incoming) {
    if (map.has(tl.id)) continue;
    let pt1 = tl.p1, pt2 = tl.p2;
    if (pt1.time > pt2.time) { [pt1, pt2] = [pt2, pt1]; }
    else if (pt1.time === pt2.time) { pt2 = { ...pt2, time: pt2.time + 1 }; }
    const ls = chart.addLineSeries({
      color: tl.color, lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    ls.setData([
      { time: pt1.time as Time, value: pt1.price },
      { time: pt2.time as Time, value: pt2.price },
    ]);
    map.set(tl.id, ls);
  }
}

function syncExtLines(
  chart: IChartApi,
  incoming: ExtendedLine[],
  map: Map<string, ISeriesApi<"Line">>,
) {
  const ids = new Set(incoming.map((l) => l.id));
  for (const [id, ls] of map) {
    if (!ids.has(id)) {
      try { chart.removeSeries(ls); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const el of incoming) {
    if (map.has(el.id)) continue;
    let pt1 = el.p1, pt2 = el.p2;
    if (pt1.time > pt2.time) { [pt1, pt2] = [pt2, pt1]; }
    else if (pt1.time === pt2.time) { pt2 = { ...pt2, time: pt2.time + 1 }; }
    const dt    = pt2.time - pt1.time;
    const slope = (pt2.price - pt1.price) / dt;
    const farLeft  = pt1.time - EXT_SECONDS;
    const farRight = pt2.time + EXT_SECONDS;
    const ls = chart.addLineSeries({
      color: el.color, lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    ls.setData([
      { time: farLeft  as Time, value: pt1.price + slope * (farLeft  - pt1.time) },
      { time: farRight as Time, value: pt1.price + slope * (farRight - pt1.time) },
    ]);
    map.set(el.id, ls);
  }
}

function syncChannels(
  chart: IChartApi,
  incoming: ParallelChannel[],
  map: Map<string, [ISeriesApi<"Line">, ISeriesApi<"Line">, ISeriesApi<"Line">]>,
) {
  const ids = new Set(incoming.map((c) => c.id));
  for (const [id, [ls1, ls2, ls3]] of map) {
    if (!ids.has(id)) {
      try { chart.removeSeries(ls1); chart.removeSeries(ls2); chart.removeSeries(ls3); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const ch of incoming) {
    if (map.has(ch.id)) continue;
    let pt1 = ch.p1, pt2 = ch.p2;
    if (pt1.time > pt2.time) { [pt1, pt2] = [pt2, pt1]; }
    else if (pt1.time === pt2.time) { pt2 = { ...pt2, time: pt2.time + 1 }; }
    const lineOpts = {
      color: ch.color, lineWidth: 1 as const,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
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
    map.set(ch.id, [ls1, ls2, ls3]);
  }
}

function syncVerticalLines(
  candle: ISeriesApi<"Candlestick">,
  incoming: VerticalLine[],
  map: Map<string, VerticalLinePrimitive>,
) {
  const ids = new Set(incoming.map((v) => v.id));
  for (const [id, prim] of map) {
    if (!ids.has(id)) {
      try { (candle as any).detachPrimitive(prim); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const vl of incoming) {
    if (map.has(vl.id)) continue;
    const prim = new VerticalLinePrimitive(vl);
    try { (candle as any).attachPrimitive(prim); } catch { /* ignore */ }
    map.set(vl.id, prim);
  }
}

function syncCrossLines(
  candle: ISeriesApi<"Candlestick">,
  incoming: CrossLine[],
  map: Map<string, CrossLinePrimitive>,
) {
  const ids = new Set(incoming.map((c) => c.id));
  for (const [id, prim] of map) {
    if (!ids.has(id)) {
      try { (candle as any).detachPrimitive(prim); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const cl of incoming) {
    if (map.has(cl.id)) continue;
    const prim = new CrossLinePrimitive(cl);
    try { (candle as any).attachPrimitive(prim); } catch { /* ignore */ }
    map.set(cl.id, prim);
  }
}

function syncFibTimeZones(
  candle: ISeriesApi<"Candlestick">,
  incoming: FibTimeZone[],
  map: Map<string, FibTimeZonePrimitive>,
) {
  const ids = new Set(incoming.map((f) => f.id));
  for (const [id, prim] of map) {
    if (!ids.has(id)) {
      try { (candle as any).detachPrimitive(prim); } catch { /* ignore */ }
      map.delete(id);
    }
  }
  for (const ftz of incoming) {
    if (map.has(ftz.id)) continue;
    const prim = new FibTimeZonePrimitive(ftz);
    try { (candle as any).attachPrimitive(prim); } catch { /* ignore */ }
    map.set(ftz.id, prim);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface CrosshairInfo {
  open: number; high: number; low: number; close: number; volume?: number;
}

function fmtVal(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  series: ChartSeries;
  height?: number;
  theme?: "dark" | "light";
  onChartClick?: (price: number, time: number | undefined) => void;
  resetKey?: string;
  /** Live price — separate prop so WS ticks don't re-run the main data effect */
  currentPrice?: number;
  /** When true, overlay div captures pointer events for drawing; false = LWC pan/zoom */
  isDrawingMode?: boolean;
  // ── Drawing overlays — each is a stable useState ref from the parent ──
  drawnLines?:    DrawnLine[];
  trendLines?:    TrendLine[];
  fibLevels?:     FibLevel[];
  rayLines?:      RayLine[];
  extLines?:      ExtendedLine[];
  channels?:      ParallelChannel[];
  fibExtensions?: FibExtension[];
  verticalLines?: VerticalLine[];
  crossLines?:    CrossLine[];
  fibTimeZones?:  FibTimeZone[];
}

// ─── Component ────────────────────────────────────────────────────────────

export function PriceChartV2({
  series,
  height = 400,
  theme = "dark",
  onChartClick,
  resetKey,
  currentPrice,
  isDrawingMode = false,
  drawnLines,
  trendLines,
  fibLevels,
  rayLines,
  extLines,
  channels,
  fibExtensions,
  verticalLines,
  crossLines,
  fibTimeZones,
}: Props): React.ReactElement {
  const t = useT();

  // Keep callback ref fresh at render time — no dedicated effect needed
  const onChartClickRef = useRef(onChartClick);
  onChartClickRef.current = onChartClick;

  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Indicator series refs
  const ema20Ref        = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref        = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref       = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef       = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiRef          = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef         = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapUpperRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapLowerRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const alarmLinesRef   = useRef<IPriceLine[]>([]);
  const srLinesRef      = useRef<IPriceLine[]>([]);
  const tradeLinesRef   = useRef<IPriceLine[]>([]);
  const currentPriceLineRef = useRef<IPriceLine | null>(null);

  // Drawing overlay maps
  const drawnLinesMapRef    = useRef<Map<string, IPriceLine>>(new Map());
  const trendLinesMapRef    = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const fibLinesMapRef      = useRef<Map<string, IPriceLine[]>>(new Map());
  const rayLinesMapRef      = useRef<Map<string, IPriceLine>>(new Map());
  const extLinesMapRef      = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const channelsMapRef      = useRef<Map<string, [ISeriesApi<"Line">, ISeriesApi<"Line">, ISeriesApi<"Line">]>>(new Map());
  const fibExtMapRef        = useRef<Map<string, IPriceLine[]>>(new Map());
  const verticalLinesMapRef = useRef<Map<string, VerticalLinePrimitive>>(new Map());
  const crossLinesMapRef    = useRef<Map<string, CrossLinePrimitive>>(new Map());
  const fibTimeZonesMapRef  = useRef<Map<string, FibTimeZonePrimitive>>(new Map());

  // fitContent guard
  const didFitRef    = useRef(false);
  const resetKeyRef  = useRef<string | undefined>(undefined);

  // Pointer tap detection
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const [crosshairData, setCrosshairData] = useState<CrosshairInfo | null>(null);

  // ── Effect 1: Mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    didFitRef.current = false;
    resetKeyRef.current = undefined;

    const tc = THEME_COLORS[theme];
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: tc.text,
        fontFamily: CHART_DEFAULTS.fontFamily,
      },
      grid: {
        vertLines: { color: tc.grid },
        horzLines: { color: tc.grid },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: tc.border,
        rightOffset: CHART_DEFAULTS.rightOffset,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: { borderColor: tc.border },
      handleScroll: { vertTouchDrag: false },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: SERIES_COLORS.up,
      downColor: SERIES_COLORS.down,
      wickUpColor: SERIES_COLORS.up,
      wickDownColor: SERIES_COLORS.down,
      borderVisible: false,
    });
    candleRef.current = candle;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(container);

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
      trendLinesMapRef.current.clear();
      fibLinesMapRef.current.clear();
      rayLinesMapRef.current.clear();
      extLinesMapRef.current.clear();
      channelsMapRef.current.clear();
      fibExtMapRef.current.clear();
      verticalLinesMapRef.current.clear();
      crossLinesMapRef.current.clear();
      fibTimeZonesMapRef.current.clear();
      chartRef.current       = null;
      candleRef.current      = null;
      ema20Ref.current       = null;
      ema50Ref.current       = null;
      ema200Ref.current      = null;
      volumeRef.current      = null;
      rsiRef.current         = null;
      macdHistRef.current    = null;
      macdLineRef.current    = null;
      macdSignalRef.current  = null;
      bbUpperRef.current     = null;
      bbMiddleRef.current    = null;
      bbLowerRef.current     = null;
      vwapRef.current        = null;
      vwapUpperRef.current   = null;
      vwapLowerRef.current   = null;
      currentPriceLineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effect 2: Height ─────────────────────────────────────────────────────
  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // ── Effect 3: Theme ──────────────────────────────────────────────────────
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

  // ── Effect 4: Main data (indicators) ────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    const hasVol  = !!(series.volume?.length);
    const hasRsi  = !!(series.rsi?.length);
    const hasMacd = !!(series.macdData?.length);
    const slots     = computeSlots(hasVol, hasRsi, hasMacd);
    const panelCount = slots.length;

    chart.priceScale("right").applyOptions({ scaleMargins: candleMargins(panelCount) });
    candle.setData(series.candles as CandlestickData<Time>[]);

    // EMA 20
    if (series.ema20?.length) {
      if (!ema20Ref.current) {
        ema20Ref.current = chart.addLineSeries({
          color: SERIES_COLORS.ema20, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
        });
      }
      ema20Ref.current.setData(series.ema20 as LineData<Time>[]);
    } else if (ema20Ref.current) {
      chart.removeSeries(ema20Ref.current);
      ema20Ref.current = null;
    }

    // EMA 50
    if (series.ema50?.length) {
      if (!ema50Ref.current) {
        ema50Ref.current = chart.addLineSeries({
          color: SERIES_COLORS.ema50, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
        });
      }
      ema50Ref.current.setData(series.ema50 as LineData<Time>[]);
    } else if (ema50Ref.current) {
      chart.removeSeries(ema50Ref.current);
      ema50Ref.current = null;
    }

    // EMA 200
    if (series.ema200?.length) {
      if (!ema200Ref.current) {
        ema200Ref.current = chart.addLineSeries({
          color: SERIES_COLORS.ema200, lineWidth: 2, lineStyle: 1,
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
        color: SERIES_COLORS.bb, lineWidth: 1 as const, lineStyle: 0 as const,
        priceLineVisible: false, lastValueVisible: false,
      };
      if (!bbUpperRef.current)  bbUpperRef.current  = chart.addLineSeries({ ...bbOpts, lineStyle: 2 });
      if (!bbMiddleRef.current) bbMiddleRef.current = chart.addLineSeries(bbOpts);
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
        vwapRef.current = chart.addLineSeries({ ...vwapOpts, color: SERIES_COLORS.vwap, lineWidth: 2 });
      }
      if (!vwapUpperRef.current) {
        vwapUpperRef.current = chart.addLineSeries({
          ...vwapOpts, color: SERIES_COLORS.vwap, lineWidth: 1, lineStyle: 2, lastValueVisible: false,
        });
      }
      if (!vwapLowerRef.current) {
        vwapLowerRef.current = chart.addLineSeries({
          ...vwapOpts, color: SERIES_COLORS.vwap, lineWidth: 1, lineStyle: 2, lastValueVisible: false,
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
          priceScaleId: "volume", priceLineVisible: false, lastValueVisible: false,
        });
        chart.priceScale("volume").applyOptions({ drawTicks: false, borderVisible: false, autoScale: true });
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
          priceScaleId: "rsi", color: SERIES_COLORS.rsi, lineWidth: 1,
          priceLineVisible: false, lastValueVisible: true,
        });
        rsiLine.createPriceLine({ price: 70, color: "#ef4444cc", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: t("grafik.rsiOverbought") });
        rsiLine.createPriceLine({ price: 50, color: "#94a3b8aa", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: t("grafik.rsiMidline") });
        rsiLine.createPriceLine({ price: 30, color: "#22c55ecc", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: t("grafik.rsiOversold") });
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
      const macdSlot   = slots.find((s) => s.name === "macd")!.slot;
      const histData   = series.macdData!.map((p) => ({ time: p.time as Time, value: p.hist,   color: p.hist >= 0 ? "#22c55e88" : "#ef444488" }));
      const macdLineData = series.macdData!.map((p) => ({ time: p.time as Time, value: p.macd   }));
      const signalData   = series.macdData!.map((p) => ({ time: p.time as Time, value: p.signal }));
      if (!macdHistRef.current) {
        macdHistRef.current = chart.addHistogramSeries({ priceScaleId: "macd", priceLineVisible: false, lastValueVisible: false });
        chart.priceScale("macd").applyOptions({ drawTicks: false, borderVisible: false });
      }
      if (!macdLineRef.current) {
        macdLineRef.current = chart.addLineSeries({ priceScaleId: "macd", color: SERIES_COLORS.macd, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      }
      if (!macdSignalRef.current) {
        macdSignalRef.current = chart.addLineSeries({ priceScaleId: "macd", color: SERIES_COLORS.macdSignal, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
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

    // Alarm price lines (full clear + rebuild each time — these are data-driven, not user-drawn)
    for (const line of alarmLinesRef.current) { try { candle.removePriceLine(line); } catch { /* ignore */ } }
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
    for (const line of srLinesRef.current) { try { candle.removePriceLine(line); } catch { /* ignore */ } }
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

    // Trade level lines (entry / SL / TP)
    for (const line of tradeLinesRef.current) { try { candle.removePriceLine(line); } catch { /* ignore */ } }
    tradeLinesRef.current = [];
    if (series.tradeLevels?.length) {
      const COLORS: Record<string, string> = { entry: "#3b82f6", sl: "#ef4444", tp1: "#22c55e", tp2: "#86efac" };
      const TITLES: Record<string, string> = { entry: t("grafik.tradeLevelEntry"), sl: "SL", tp1: "TP1", tp2: "TP2" };
      for (const tl of series.tradeLevels) {
        const line = candle.createPriceLine({
          price: tl.price,
          color: COLORS[tl.kind] ?? "#ffffff",
          lineWidth: 1, lineStyle: tl.kind === "entry" ? 0 : 2, axisLabelVisible: true,
          title: tl.label ?? TITLES[tl.kind] ?? tl.kind,
        });
        tradeLinesRef.current.push(line);
      }
    }

    // Trade markers
    if (series.markers?.length) {
      candle.setMarkers(
        series.markers.map((m) => ({
          time: m.time as Time, position: m.position, color: m.color,
          shape: m.shape, text: m.text,
        } as SeriesMarker<Time>)),
      );
    } else {
      candle.setMarkers([]);
    }

    // fitContent — only on first load per pair/TF
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      didFitRef.current = false;
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
    if (!didFitRef.current && series.candles.length > 0) {
      chart.timeScale().fitContent();
      didFitRef.current = true;
    }
  }, [series, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 5: Live price line ────────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle) return;
    if (currentPrice && currentPrice > 0) {
      if (currentPriceLineRef.current) {
        try { currentPriceLineRef.current.applyOptions({ price: currentPrice }); } catch { /* ignore */ }
      } else {
        try {
          currentPriceLineRef.current = candle.createPriceLine({
            price: currentPrice, color: SERIES_COLORS.live,
            lineWidth: 1, lineStyle: 3, axisLabelVisible: true,
            title: t("grafik.livePriceLabel"),
          });
        } catch { /* ignore */ }
      }
    } else if (currentPriceLineRef.current) {
      try { candle.removePriceLine(currentPriceLineRef.current); } catch { /* ignore */ }
      currentPriceLineRef.current = null;
    }
  }, [currentPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 6: Drawing overlays (all 10 types merged) ────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    syncHLines(candle,   drawnLines    ?? [], drawnLinesMapRef.current);
    syncRayLines(candle, rayLines      ?? [], rayLinesMapRef.current);
    syncFibLevels(candle,    fibLevels     ?? [], fibLinesMapRef.current);
    syncFibExtensions(candle, fibExtensions ?? [], fibExtMapRef.current);
    syncTrendLines(chart, trendLines   ?? [], trendLinesMapRef.current);
    syncExtLines(chart,   extLines     ?? [], extLinesMapRef.current);
    syncChannels(chart,   channels     ?? [], channelsMapRef.current);
    syncVerticalLines(candle, verticalLines ?? [], verticalLinesMapRef.current);
    syncCrossLines(candle,    crossLines    ?? [], crossLinesMapRef.current);
    syncFibTimeZones(candle,  fibTimeZones  ?? [], fibTimeZonesMapRef.current);
  }, [drawnLines, trendLines, fibLevels, rayLines, extLines, channels, fibExtensions, verticalLines, crossLines, fibTimeZones]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {/*
        Drawing input overlay:
        - isDrawingMode OFF: pointer-events:none → LWC pan/zoom unaffected
        - isDrawingMode ON:  captures all pointer events before browser scroll/pan
          PointerEvent fires identically on mouse, iOS touch, Android touch, PWA.
          30px threshold handles mobile finger jitter.
      */}
      <div
        className="absolute inset-0"
        style={{
          pointerEvents: isDrawingMode ? "auto" : "none",
          touchAction: "none",
          cursor: isDrawingMode ? "crosshair" : "default",
        }}
        onPointerDown={(e) => { pointerStartRef.current = { x: e.clientX, y: e.clientY }; }}
        onPointerCancel={() => { pointerStartRef.current = null; }}
        onPointerUp={(e) => {
          const start = pointerStartRef.current;
          pointerStartRef.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (dx * dx + dy * dy > 900) return; // >30px = pan/drag
          const chart = chartRef.current;
          const candle = candleRef.current;
          if (!chart || !candle) return;
          const rect  = e.currentTarget.getBoundingClientRect();
          const price = candle.coordinateToPrice(e.clientY - rect.top);
          if (price === null || price <= 0) return;
          const resolved = chart.timeScale().coordinateToTime(e.clientX - rect.left);
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
