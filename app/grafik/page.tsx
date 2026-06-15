"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { ChartControls, type ChartClickMode } from "@/components/grafik/ChartControls";
import { ChartLegend } from "@/components/grafik/ChartLegend";
import { OrderFlowPanel } from "@/components/grafik/OrderFlowPanel";
import { QuickTradePanel } from "@/components/grafik/QuickTradePanel";
import { emaSeries } from "@/lib/indicators/ema";
import { rsiSeries } from "@/lib/indicators/rsi";
import { macdSeries } from "@/lib/indicators/macd";
import { bbSeries } from "@/lib/indicators/bb";
import { vwapSeries } from "@/lib/indicators/vwap";
import { findAllSwingHighs, findAllSwingLows } from "@/lib/sr/swing";
import { toIndicatorCandle, fetchCandles, type Timeframe, type Candle } from "@/lib/okx/candles";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { ChartSeries, LinePoint, VolumePoint, ChartMarker, MacdPoint, AlarmLevel, BbBands, VwapBands, SrLevel, TradeLevelLine, DrawnLine, TrendLine, FibLevel, RayLine, ExtendedLine, ParallelChannel, FibExtension, VerticalLine, CrossLine, FibTimeZone, LiqBand } from "@/lib/chart/types";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { WatchlistPanel } from "@/components/grafik/WatchlistPanel";
import { useOkxCandleStream } from "@/lib/ws/useOkxCandleStream";
import { DrawingToolbar } from "@/components/grafik/DrawingToolbar";
import { useLiqFeedStore, type LiqEvent } from "@/lib/store/liqFeedStore";
import { buildLiquidationMapFromEvents } from "@/lib/orderflow/liquidationMap";

// Stable empty fallback — prevents new [] reference on every selector call (Zustand re-render bug)
const EMPTY_LIQ_EVENTS: LiqEvent[] = [];

const PriceChart = dynamic(
  () => import("@/components/grafik/PriceChart").then((m) => m.PriceChart),
  { ssr: false },
);

const VOL_UP = "rgba(34,197,94,0.5)";
const VOL_DOWN = "rgba(239,68,68,0.5)";

const CHART_STORAGE_KEY = "qx_chart_v1";
const VALID_TF = new Set<string>(["1m", "5m", "15m", "1h", "4h", "1d"]);

/** Secondary timeframe for split view (zoom-in pattern) */
const SEC_TF: Record<Timeframe, Timeframe> = {
  "1d": "4h",
  "4h": "1h",
  "1h": "15m",
  "15m": "5m",
  "5m": "1m",
  "1m": "1m",
};

/** Drawn lines localStorage helpers */
const LINES_KEY = "qx_chart_dl_v2_";
function loadLines(pair: string): DrawnLine[] {
  try {
    const raw = localStorage.getItem(LINES_KEY + pair);
    if (!raw) return [];
    const d = JSON.parse(raw);
    return Array.isArray(d) ? (d as DrawnLine[]) : [];
  } catch { return []; }
}
function saveLines(pair: string, lines: DrawnLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(LINES_KEY + pair);
    else localStorage.setItem(LINES_KEY + pair, JSON.stringify(lines));
  } catch { /* ignore */ }
}

const TL_KEY  = "qx_tl_v1_";
const FIB_KEY = "qx_fib_v1_";
function loadTrendLines(pair: string): TrendLine[] {
  try { return JSON.parse(localStorage.getItem(TL_KEY + pair) ?? "[]") as TrendLine[]; }
  catch { return []; }
}
function saveTrendLines(pair: string, lines: TrendLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(TL_KEY + pair);
    else localStorage.setItem(TL_KEY + pair, JSON.stringify(lines));
  } catch { /* ignore */ }
}
function loadFibLevels(pair: string): FibLevel[] {
  try { return JSON.parse(localStorage.getItem(FIB_KEY + pair) ?? "[]") as FibLevel[]; }
  catch { return []; }
}
function saveFibLevels(pair: string, levels: FibLevel[]): void {
  try {
    if (levels.length === 0) localStorage.removeItem(FIB_KEY + pair);
    else localStorage.setItem(FIB_KEY + pair, JSON.stringify(levels));
  } catch { /* ignore */ }
}

const RAY_KEY  = "qx_ray_v1_";
const EXT_KEY  = "qx_ext_v1_";
const CH_KEY   = "qx_ch_v1_";
const FIBX_KEY = "qx_fibx_v1_";
const VL_KEY   = "qx_vl_v1_";
function loadRayLines(pair: string): RayLine[] {
  try { return JSON.parse(localStorage.getItem(RAY_KEY + pair) ?? "[]") as RayLine[]; }
  catch { return []; }
}
function saveRayLines(pair: string, lines: RayLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(RAY_KEY + pair);
    else localStorage.setItem(RAY_KEY + pair, JSON.stringify(lines));
  } catch { /* ignore */ }
}
function loadExtLines(pair: string): ExtendedLine[] {
  try { return JSON.parse(localStorage.getItem(EXT_KEY + pair) ?? "[]") as ExtendedLine[]; }
  catch { return []; }
}
function saveExtLines(pair: string, lines: ExtendedLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(EXT_KEY + pair);
    else localStorage.setItem(EXT_KEY + pair, JSON.stringify(lines));
  } catch { /* ignore */ }
}
function loadChannels(pair: string): ParallelChannel[] {
  try { return JSON.parse(localStorage.getItem(CH_KEY + pair) ?? "[]") as ParallelChannel[]; }
  catch { return []; }
}
function saveChannels(pair: string, chs: ParallelChannel[]): void {
  try {
    if (chs.length === 0) localStorage.removeItem(CH_KEY + pair);
    else localStorage.setItem(CH_KEY + pair, JSON.stringify(chs));
  } catch { /* ignore */ }
}
function loadFibExtensions(pair: string): FibExtension[] {
  try { return JSON.parse(localStorage.getItem(FIBX_KEY + pair) ?? "[]") as FibExtension[]; }
  catch { return []; }
}
function saveFibExtensions(pair: string, exts: FibExtension[]): void {
  try {
    if (exts.length === 0) localStorage.removeItem(FIBX_KEY + pair);
    else localStorage.setItem(FIBX_KEY + pair, JSON.stringify(exts));
  } catch { /* ignore */ }
}
function loadVerticalLines(pair: string): VerticalLine[] {
  try { return JSON.parse(localStorage.getItem(VL_KEY + pair) ?? "[]") as VerticalLine[]; }
  catch { return []; }
}
function saveVerticalLines(pair: string, lines: VerticalLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(VL_KEY + pair);
    else localStorage.setItem(VL_KEY + pair, JSON.stringify(lines));
  } catch { /* ignore */ }
}
const CL_KEY  = "qx_cl_v1_";
const FTZ_KEY = "qx_ftz_v1_";
function loadCrossLines(pair: string): CrossLine[] {
  try { return JSON.parse(localStorage.getItem(CL_KEY + pair) ?? "[]") as CrossLine[]; }
  catch { return []; }
}
function saveCrossLines(pair: string, lines: CrossLine[]): void {
  try {
    if (lines.length === 0) localStorage.removeItem(CL_KEY + pair);
    else localStorage.setItem(CL_KEY + pair, JSON.stringify(lines));
  } catch { /* ignore */ }
}
function loadFibTimeZones(pair: string): FibTimeZone[] {
  try { return JSON.parse(localStorage.getItem(FTZ_KEY + pair) ?? "[]") as FibTimeZone[]; }
  catch { return []; }
}
function saveFibTimeZones(pair: string, zones: FibTimeZone[]): void {
  try {
    if (zones.length === 0) localStorage.removeItem(FTZ_KEY + pair);
    else localStorage.setItem(FTZ_KEY + pair, JSON.stringify(zones));
  } catch { /* ignore */ }
}

/** Build ChartSeries from a candle array + overlay flags */
function buildSeries(
  candles: Candle[],
  trades: ReturnType<typeof useTradesStore.getState>["trades"],
  pair: Pair,
  opts: {
    ema20: boolean; ema50: boolean; ema200: boolean; volume: boolean;
    rsi: boolean; macd: boolean; bb: boolean; vwap: boolean; sr: boolean;
    trades: boolean; alarmLevels: AlarmLevel[]; tradeLevels: TradeLevelLine[];
    drawnLines: DrawnLine[]; trendLines: TrendLine[]; fibLevels: FibLevel[];
    rayLines: RayLine[]; extLines: ExtendedLine[]; channels: ParallelChannel[]; fibExtensions: FibExtension[];
    verticalLines: VerticalLine[]; crossLines: CrossLine[]; fibTimeZones: FibTimeZone[];
    livePrice?: number;
  },
): ChartSeries {
  const candlePoints = candles.map((c) => ({
    time: Math.floor(c.ts / 1000) as unknown as number,
    open: c.open, high: c.high, low: c.low, close: c.close,
  }));
  const closes = candles.map((c) => c.close);
  const times  = candles.map((c) => Math.floor(c.ts / 1000));

  let ema20: LinePoint[] | undefined;
  let ema50: LinePoint[] | undefined;
  let ema200: LinePoint[] | undefined;

  if (opts.ema20 && candles.length >= 20) {
    const vals = emaSeries(closes, { period: 20 });
    ema20 = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }
  if (opts.ema50 && candles.length >= 50) {
    const vals = emaSeries(closes, { period: 50 });
    ema50 = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }
  if (opts.ema200 && candles.length >= 200) {
    const vals = emaSeries(closes, { period: 200 });
    ema200 = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }

  let volume: VolumePoint[] | undefined;
  if (opts.volume && candles.length > 0) {
    volume = candles.map((c, i) => ({
      time: times[i], value: c.volume,
      color: c.close >= c.open ? VOL_UP : VOL_DOWN,
    }));
  }

  let rsi: LinePoint[] | undefined;
  if (opts.rsi && candles.length >= 15) {
    const vals = rsiSeries(closes, { period: 14 });
    rsi = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }

  let macdData: MacdPoint[] | undefined;
  if (opts.macd && candles.length >= 35) {
    macdData = macdSeries(closes, times);
  }

  let bbBands: BbBands | undefined;
  if (opts.bb && candles.length >= 20) {
    const bbVals = bbSeries(closes);
    const upper: LinePoint[] = []; const middle: LinePoint[] = []; const lower: LinePoint[] = [];
    bbVals.forEach((v, i) => {
      if (v !== null) {
        upper.push({ time: times[i], value: v.upper });
        middle.push({ time: times[i], value: v.mean });
        lower.push({ time: times[i], value: v.lower });
      }
    });
    if (upper.length > 0) bbBands = { upper, middle, lower };
  }

  let vwapBands: VwapBands | undefined;
  if (opts.vwap && candles.length >= 2) {
    const pts = vwapSeries(
      closes, candles.map(c => c.high), candles.map(c => c.low),
      candles.map(c => c.volume), candles.map(c => c.ts),
    );
    const vwapLine: LinePoint[] = []; const upperLine: LinePoint[] = []; const lowerLine: LinePoint[] = [];
    pts.forEach((v, i) => {
      if (v !== null) {
        vwapLine.push({ time: times[i], value: v.vwap });
        upperLine.push({ time: times[i], value: v.upper });
        lowerLine.push({ time: times[i], value: v.lower });
      }
    });
    if (vwapLine.length > 0) vwapBands = { vwap: vwapLine, upper: upperLine, lower: lowerLine };
  }

  let markers: ChartMarker[] | undefined;
  if (opts.trades) {
    markers = trades
      .filter((t) => t.pair === pair)
      .map((t) => ({
        time: Math.floor(t.openedAt / 1000),
        position: t.direction === "LONG" ? "belowBar" as const : "aboveBar" as const,
        color: t.direction === "LONG" ? "#22c55e" : "#ef4444",
        shape: t.direction === "LONG" ? "arrowUp" as const : "arrowDown" as const,
        text: `${t.direction} ${t.isPaper ? "(P)" : ""}`,
      }));
  }

  let srLevels: SrLevel[] | undefined;
  if (opts.sr && candles.length >= 7) {
    const indCandles = candles.map(toIndicatorCandle);
    const highs = findAllSwingHighs(indCandles, 60, 3, 8);
    const lows  = findAllSwingLows(indCandles, 60, 3, 8);
    srLevels = [
      ...highs.map((p) => ({ price: p.price, type: "resistance" as const })),
      ...lows.map((p) => ({ price: p.price, type: "support" as const })),
    ];
  }

  return {
    candles: candlePoints, ema20, ema50, ema200, volume, rsi, macdData,
    bb: bbBands, vwap: vwapBands, alarmLevels: opts.alarmLevels,
    markers, srLevels, tradeLevels: opts.tradeLevels,
    drawnLines: opts.drawnLines,
    trendLines: opts.trendLines,
    fibLevels:  opts.fibLevels,
    rayLines:   opts.rayLines,
    extLines:   opts.extLines,
    channels:   opts.channels,
    fibExtensions: opts.fibExtensions,
    verticalLines: opts.verticalLines,
    crossLines:    opts.crossLines,
    fibTimeZones:  opts.fibTimeZones,
    currentPrice:  opts.livePrice,
  };
}

export default function GrafikPage() {
  const theme = useSettingsStore((s) => s.theme);

  const [pair, setPair]           = useState<Pair>("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [showEma20, setShowEma20]   = useState(true);
  const [showEma50, setShowEma50]   = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showTrades, setShowTrades] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi]       = useState(false);
  const [showMacd, setShowMacd]     = useState(false);
  const [showBb, setShowBb]         = useState(false);
  const [showVwap, setShowVwap]     = useState(false);
  const [showSr, setShowSr]         = useState(false);
  const [showLiqMagnet, setShowLiqMagnet] = useState(true);

  // New tool state (not persisted — session only)
  const [showSplit, setShowSplit]       = useState(false);
  const [showFlow, setShowFlow]         = useState(false);
  const [showQuick, setShowQuick]       = useState(false);
  const [clickMode, setClickMode]       = useState<ChartClickMode>("none");
  const [drawnLines, setDrawnLines]         = useState<DrawnLine[]>([]);
  const [trendLines, setTrendLines]         = useState<TrendLine[]>([]);
  const [fibLevels, setFibLevels]           = useState<FibLevel[]>([]);
  const [rayLines, setRayLines]             = useState<RayLine[]>([]);
  const [extLines, setExtLines]             = useState<ExtendedLine[]>([]);
  const [channels, setChannels]             = useState<ParallelChannel[]>([]);
  const [fibExtensions, setFibExtensions]   = useState<FibExtension[]>([]);
  const [verticalLines, setVerticalLines]   = useState<VerticalLine[]>([]);
  const [crossLines, setCrossLines]         = useState<CrossLine[]>([]);
  const [fibTimeZones, setFibTimeZones]     = useState<FibTimeZone[]>([]);
  const [pendingPoint, setPendingPoint]     = useState<{ time: number; price: number } | null>(null);
  const [pendingChannelLine, setPendingChannelLine] = useState<{ p1: { time: number; price: number }; p2: { time: number; price: number } } | null>(null);
  const [capturedPrice, setCapturedPrice] = useState<number | null>(null);
  const [secCandles, setSecCandles]     = useState<Candle[]>([]);
  const [secLoading, setSecLoading]     = useState(false);
  // Chart height / fullscreen
  const [chartHeight, setChartHeight]   = useState(480);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Local candles for 1m/5m (not covered by global poller)
  const [localCandles, setLocalCandles] = useState<Candle[]>([]);
  // Guard against saving before initial load completes
  const hasLoadedRef = useRef(false);
  // Loading state for main chart — two separate refs to avoid nested-timer leak
  const showLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chartLoadState, setChartLoadState] = useState<"loading" | "ready" | "failed">("loading");

  // Load persisted settings on mount
  useEffect(() => {
    let loadedPair: Pair = "BTC";
    try {
      const raw = localStorage.getItem(CHART_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.pair === "string" && (PAIRS as readonly string[]).includes(s.pair)) {
          loadedPair = s.pair as Pair;
          setPair(loadedPair);
        }
        if (typeof s.tf === "string" && VALID_TF.has(s.tf)) setTimeframe(s.tf as Timeframe);
        if (typeof s.chartHeight === "number" && s.chartHeight >= 200 && s.chartHeight <= 1000) {
          setChartHeight(s.chartHeight);
        }
        const o = s.o as Record<string, boolean> | undefined;
        if (o) {
          if (o.ema20  !== undefined) setShowEma20(o.ema20);
          if (o.ema50  !== undefined) setShowEma50(o.ema50);
          if (o.ema200 !== undefined) setShowEma200(o.ema200);
          if (o.vol    !== undefined) setShowVolume(o.vol);
          if (o.rsi    !== undefined) setShowRsi(o.rsi);
          if (o.macd   !== undefined) setShowMacd(o.macd);
          if (o.bb     !== undefined) setShowBb(o.bb);
          if (o.vwap   !== undefined) setShowVwap(o.vwap);
          if (o.sr     !== undefined) setShowSr(o.sr);
          if (o.trades !== undefined) setShowTrades(o.trades);
          if (o.liqMagnet !== undefined) setShowLiqMagnet(o.liqMagnet);
        }
      }
    } catch { /* ignore */ }
    // Load all drawings for restored pair (after chartStorage parse)
    setDrawnLines(loadLines(loadedPair));
    setTrendLines(loadTrendLines(loadedPair));
    setFibLevels(loadFibLevels(loadedPair));
    setRayLines(loadRayLines(loadedPair));
    setExtLines(loadExtLines(loadedPair));
    setChannels(loadChannels(loadedPair));
    setFibExtensions(loadFibExtensions(loadedPair));
    setVerticalLines(loadVerticalLines(loadedPair));
    setCrossLines(loadCrossLines(loadedPair));
    setFibTimeZones(loadFibTimeZones(loadedPair));
    hasLoadedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist settings on change (skip initial mount)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    try {
      localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify({
        pair, tf: timeframe, chartHeight,
        o: { ema20: showEma20, ema50: showEma50, ema200: showEma200, vol: showVolume,
             rsi: showRsi, macd: showMacd, bb: showBb, vwap: showVwap, sr: showSr, trades: showTrades,
             liqMagnet: showLiqMagnet },
      }));
    } catch { /* ignore */ }
  }, [pair, timeframe, chartHeight, showEma20, showEma50, showEma200, showVolume, showRsi, showMacd, showBb, showVwap, showSr, showTrades, showLiqMagnet]);

  // Persist drawings per pair (skip initial mount)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveLines(pair, drawnLines);
  }, [pair, drawnLines]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveTrendLines(pair, trendLines);
  }, [pair, trendLines]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveFibLevels(pair, fibLevels);
  }, [pair, fibLevels]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveRayLines(pair, rayLines);
  }, [pair, rayLines]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveExtLines(pair, extLines);
  }, [pair, extLines]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveChannels(pair, channels);
  }, [pair, channels]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveFibExtensions(pair, fibExtensions);
  }, [pair, fibExtensions]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveVerticalLines(pair, verticalLines);
  }, [pair, verticalLines]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveCrossLines(pair, crossLines);
  }, [pair, crossLines]);
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    saveFibTimeZones(pair, fibTimeZones);
  }, [pair, fibTimeZones]);

  // Fetch 1m/5m candles locally (not in global poller)
  useEffect(() => {
    if (timeframe !== "1m" && timeframe !== "5m") {
      setLocalCandles([]);
      return;
    }
    let cancelled = false;
    const doFetch = async () => {
      const data = await fetchCandles(pair, timeframe, 200);
      if (!cancelled) setLocalCandles(data ?? []);
    };
    void doFetch();
    const intervalMs = timeframe === "1m" ? 15_000 : 30_000;
    const id = setInterval(() => void doFetch(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      setLocalCandles([]);
    };
  }, [pair, timeframe]);

  // ESC: pendingChannelLine → pendingPoint → fullscreen (önce en son adımı iptal et)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingChannelLine) { setPendingChannelLine(null); return; }
      if (pendingPoint) { setPendingPoint(null); return; }
      if (isFullscreen) { setIsFullscreen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pendingChannelLine, pendingPoint, isFullscreen]);

  // Fetch secondary TF candles when split view is active
  const secTf = SEC_TF[timeframe];
  useEffect(() => {
    if (!showSplit) { setSecCandles([]); return; }
    setSecLoading(true);
    fetchCandles(pair, secTf, 200)
      .then((data) => { setSecCandles(data ?? []); })
      .catch(() => { setSecCandles([]); })
      .finally(() => { setSecLoading(false); });
  }, [showSplit, pair, secTf]);

  // Switch pair: load new pair's drawings, clear pending
  const handlePairChange = useCallback((newPair: Pair) => {
    setDrawnLines(loadLines(newPair));
    setTrendLines(loadTrendLines(newPair));
    setFibLevels(loadFibLevels(newPair));
    setRayLines(loadRayLines(newPair));
    setExtLines(loadExtLines(newPair));
    setChannels(loadChannels(newPair));
    setFibExtensions(loadFibExtensions(newPair));
    setVerticalLines(loadVerticalLines(newPair));
    setCrossLines(loadCrossLines(newPair));
    setFibTimeZones(loadFibTimeZones(newPair));
    setPendingPoint(null);
    setPendingChannelLine(null);
    setClickMode("none");
    setPair(newPair);
  }, []);

  // Resize handle
  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = chartHeight;
    const onMove = (ev: MouseEvent) => {
      setChartHeight(Math.max(200, Math.min(1000, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [chartHeight]);

  // Live candle stream — updates last candle via RAF-throttled WS (ADIM 3)
  useOkxCandleStream(pair, timeframe);

  const candlesRaw = useCandleStore((s) => s.candles[`${pair}_${timeframe}`]);
  const storedCandles = candlesRaw ?? EMPTY_CANDLES;
  // For 1m/5m use locally-fetched candles; global poller doesn't cover these TFs
  const candles = (timeframe === "1m" || timeframe === "5m") ? localCandles : storedCandles;
  const candlesReady = candles.length > 0;

  // Drive loading overlay: ready immediately if data exists, otherwise debounce 400ms
  // before showing "loading" (prevents flash for cached pairs on quick switches).
  // Two separate refs ensure the inner 24.6s fail-timer is always reachable for cleanup.
  useEffect(() => {
    if (showLoadingTimerRef.current) { clearTimeout(showLoadingTimerRef.current); showLoadingTimerRef.current = null; }
    if (failTimerRef.current)        { clearTimeout(failTimerRef.current);        failTimerRef.current = null; }
    if (candlesReady) {
      setChartLoadState("ready");
      return;
    }
    showLoadingTimerRef.current = setTimeout(() => {
      showLoadingTimerRef.current = null;
      setChartLoadState("loading");
      failTimerRef.current = setTimeout(() => {
        failTimerRef.current = null;
        setChartLoadState("failed");
      }, 24_600);
    }, 400);
    return () => {
      if (showLoadingTimerRef.current) { clearTimeout(showLoadingTimerRef.current); showLoadingTimerRef.current = null; }
      if (failTimerRef.current)        { clearTimeout(failTimerRef.current);        failTimerRef.current = null; }
    };
  }, [pair, timeframe, candlesReady]);

  const trades     = useTradesStore((s) => s.trades);
  const alarms     = usePriceAlarmStore((s) => s.alarms);
  const livePrice  = useMarketStore((s) => s.prices[pair]?.last ?? null);
  const liqEvents  = useLiqFeedStore((s) => s.events[pair] ?? EMPTY_LIQ_EVENTS);

  const tradeLevels = useMemo<TradeLevelLine[]>(() => {
    const open = trades.filter((t) => t.status === "open" && t.pair === pair);
    const lines: TradeLevelLine[] = [];
    for (const t of open) {
      if (t.direction !== "LONG" && t.direction !== "SHORT") continue;
      lines.push({ price: t.entryPrice,  kind: "entry", direction: t.direction });
      lines.push({ price: t.stopPrice,   kind: "sl",    direction: t.direction });
      if (t.takeProfit1) lines.push({ price: t.takeProfit1, kind: "tp1", direction: t.direction });
      if (t.takeProfit2) lines.push({ price: t.takeProfit2, kind: "tp2", direction: t.direction });
    }
    return lines;
  }, [trades, pair]);

  const alarmLevels = useMemo<AlarmLevel[]>(
    () =>
      alarms
        .filter((a) => a.pair === pair && a.status === "active")
        .map((a) => ({ price: a.targetPrice, condition: a.condition, label: a.label })),
    [alarms, pair],
  );

  // Liq Magnet bands
  const liqBands = useMemo<LiqBand[]>(() => {
    if (!showLiqMagnet || liqEvents.length < 20) return [];
    if (!livePrice) return [];
    try {
      const liqMap = buildLiquidationMapFromEvents(pair, liqEvents, livePrice);
      const bands: LiqBand[] = [];
      if (liqMap.nearestLongLiq) {
        bands.push({ id: "liq_long", price: liqMap.nearestLongLiq.price, side: "long", intensity: liqMap.nearestLongLiq.intensity });
      }
      if (liqMap.nearestShortLiq) {
        bands.push({ id: "liq_short", price: liqMap.nearestShortLiq.price, side: "short", intensity: liqMap.nearestShortLiq.intensity });
      }
      liqMap.magnetZones.slice(0, 2).forEach((z, i) => {
        bands.push({ id: `liq_zone_${i}`, price: z.price, side: z.price < livePrice ? "long" : "short", intensity: z.intensity * 0.6 });
      });
      return bands;
    } catch { return []; }
  }, [showLiqMagnet, liqEvents, pair, livePrice]);

  // Primary series — excludes livePrice and liqBands so price ticks don't re-run the full chart sync
  const series = useMemo(() =>
    buildSeries(candles, trades, pair, {
      ema20: showEma20, ema50: showEma50, ema200: showEma200,
      volume: showVolume, rsi: showRsi, macd: showMacd, bb: showBb,
      vwap: showVwap, sr: showSr, trades: showTrades,
      alarmLevels, tradeLevels, drawnLines, trendLines, fibLevels,
      rayLines, extLines, channels, fibExtensions, verticalLines, crossLines, fibTimeZones,
    }),
    [candles, trades, pair, showEma20, showEma50, showEma200, showVolume,
     showRsi, showMacd, showBb, showVwap, showSr, showTrades,
     alarmLevels, tradeLevels, drawnLines, trendLines, fibLevels,
     rayLines, extLines, channels, fibExtensions, verticalLines, crossLines, fibTimeZones],
  );

  // Secondary series (split view — EMA200 + volume only, no drawings, no livePrice)
  const secSeries = useMemo<ChartSeries | null>(() => {
    if (!showSplit || secCandles.length === 0) return null;
    return buildSeries(secCandles, trades, pair, {
      ema20: false, ema50: false, ema200: true,
      volume: showVolume, rsi: false, macd: false, bb: false,
      vwap: false, sr: showSr, trades: false,
      alarmLevels: [], tradeLevels, drawnLines,
      trendLines: [], fibLevels: [],
      rayLines: [], extLines: [], channels: [], fibExtensions: [], verticalLines: [],
      crossLines: [], fibTimeZones: [],
    });
  }, [showSplit, secCandles, trades, pair, showVolume, showSr, tradeLevels, drawnLines]);

  const DRAW_COLORS = ["#f59e0b", "#3b82f6", "#ec4899", "#22c55e", "#8b5cf6", "#f97316"];

  // Click handler dispatched to the appropriate mode.
  // time may be undefined when tapping empty chart areas on mobile.
  // hline/ray/price ignore time; all other modes guard and require it.
  const handleChartClick = useCallback((price: number, time: number | undefined) => {
    if (clickMode === "hline") {
      const label = price >= 1000 ? price.toFixed(0) : price >= 1 ? price.toFixed(2) : price.toFixed(4);
      setDrawnLines((prev) => [
        ...prev,
        { id: `dl_${Date.now()}`, price, color: DRAW_COLORS[prev.length % DRAW_COLORS.length], label },
      ]);
    } else if (clickMode === "price") {
      setCapturedPrice(price);
    } else if (clickMode === "ray") {
      const label = price >= 1000 ? price.toFixed(0) : price >= 1 ? price.toFixed(2) : price.toFixed(4);
      setRayLines((prev) => [
        ...prev,
        { id: `ray_${Date.now()}`, price, color: DRAW_COLORS[prev.length % DRAW_COLORS.length], label },
      ]);
    } else if (clickMode === "trendline") {
      if (time === undefined) return;
      if (!pendingPoint) {
        setPendingPoint({ time, price });
      } else {
        const id = `tl_${Date.now()}`;
        const color = DRAW_COLORS[trendLines.length % DRAW_COLORS.length];
        setTrendLines((prev) => [...prev, { id, p1: pendingPoint, p2: { time, price }, color }]);
        setPendingPoint(null);
      }
    } else if (clickMode === "fibonacci") {
      if (time === undefined) return;
      if (!pendingPoint) {
        setPendingPoint({ time, price });
      } else {
        const id = `fib_${Date.now()}`;
        setFibLevels((prev) => [...prev, { id, p1Price: pendingPoint.price, p2Price: price, color: "#a78bfa" }]);
        setPendingPoint(null);
      }
    } else if (clickMode === "extline") {
      if (time === undefined) return;
      if (!pendingPoint) {
        setPendingPoint({ time, price });
      } else {
        setExtLines((prev) => [
          ...prev,
          { id: `ext_${Date.now()}`, p1: pendingPoint, p2: { time, price }, color: DRAW_COLORS[prev.length % DRAW_COLORS.length] },
        ]);
        setPendingPoint(null);
      }
    } else if (clickMode === "channel") {
      if (time === undefined) return;
      if (!pendingPoint && !pendingChannelLine) {
        setPendingPoint({ time, price });
      } else if (pendingPoint && !pendingChannelLine) {
        setPendingChannelLine({ p1: pendingPoint, p2: { time, price } });
        setPendingPoint(null);
      } else if (pendingChannelLine) {
        const { p1, p2 } = pendingChannelLine;
        const dt = p2.time !== p1.time ? p2.time - p1.time : 1;
        const slope = (p2.price - p1.price) / dt;
        const priceOnLine = p1.price + slope * (time - p1.time);
        const offset = price - priceOnLine;
        setChannels((prev) => [
          ...prev,
          { id: `ch_${Date.now()}`, p1, p2, offset, color: DRAW_COLORS[prev.length % DRAW_COLORS.length] },
        ]);
        setPendingChannelLine(null);
      }
    } else if (clickMode === "fibext") {
      if (time === undefined) return;
      if (!pendingPoint) {
        setPendingPoint({ time, price });
      } else {
        setFibExtensions((prev) => [
          ...prev,
          { id: `fibx_${Date.now()}`, p1Price: pendingPoint.price, p2Price: price, color: "#a78bfa" },
        ]);
        setPendingPoint(null);
      }
    } else if (clickMode === "vline") {
      if (time === undefined) return;
      setVerticalLines((prev) => [
        ...prev,
        { id: `vl_${Date.now()}`, time, color: DRAW_COLORS[prev.length % DRAW_COLORS.length] },
      ]);
    } else if (clickMode === "crossline") {
      if (time === undefined) return;
      setCrossLines((prev) => [
        ...prev,
        { id: `cl_${Date.now()}`, time, price, color: DRAW_COLORS[prev.length % DRAW_COLORS.length] },
      ]);
    } else if (clickMode === "fibtimezone") {
      if (time === undefined) return;
      if (!pendingPoint) {
        setPendingPoint({ time, price });
      } else {
        if (time !== pendingPoint.time) {
          setFibTimeZones((prev) => [
            ...prev,
            { id: `ftz_${Date.now()}`, time0: pendingPoint.time, time1: time, color: "#a78bfa" },
          ]);
        }
        setPendingPoint(null);
      }
    }
  }, [clickMode, pendingPoint, pendingChannelLine, trendLines.length]);

  const handleSetClickMode = useCallback((mode: ChartClickMode) => {
    setClickMode(mode);
    setPendingPoint(null);
    setPendingChannelLine(null);
    if (mode !== "price") setCapturedPrice(null);
  }, []);

  const clearAllDrawings = useCallback(() => {
    setDrawnLines([]);
    setTrendLines([]);
    setFibLevels([]);
    setRayLines([]);
    setExtLines([]);
    setChannels([]);
    setFibExtensions([]);
    setVerticalLines([]);
    setCrossLines([]);
    setFibTimeZones([]);
    setPendingPoint(null);
    setPendingChannelLine(null);
  }, []);

  // Format for the captured price display
  function fmtPrice(p: number): string {
    return p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  return (
    <div className="flex gap-3 items-stretch">
      {/* Main chart column */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

      <ChartControls
        timeframe={timeframe}
        showEma20={showEma20}
        showEma50={showEma50}
        showEma200={showEma200}
        showTrades={showTrades}
        showVolume={showVolume}
        showRsi={showRsi}
        showMacd={showMacd}
        showBb={showBb}
        showVwap={showVwap}
        showSr={showSr}
        showSplit={showSplit}
        clickMode={clickMode}
        hasDrawnLines={drawnLines.length > 0}
        onTimeframeChange={setTimeframe}
        onToggleEma20={() => setShowEma20((v) => !v)}
        onToggleEma50={() => setShowEma50((v) => !v)}
        onToggleEma200={() => setShowEma200((v) => !v)}
        onToggleTrades={() => setShowTrades((v) => !v)}
        onToggleVolume={() => setShowVolume((v) => !v)}
        onToggleRsi={() => setShowRsi((v) => !v)}
        onToggleMacd={() => setShowMacd((v) => !v)}
        onToggleBb={() => setShowBb((v) => !v)}
        onToggleVwap={() => setShowVwap((v) => !v)}
        onToggleSr={() => setShowSr((v) => !v)}
        onToggleSplit={() => setShowSplit((v) => !v)}
        showFlow={showFlow}
        onToggleFlow={() => setShowFlow((v) => !v)}
        showQuick={showQuick}
        onToggleQuick={() => setShowQuick((v) => !v)}
        showLiqMagnet={showLiqMagnet}
        onToggleLiqMagnet={() => setShowLiqMagnet((v) => !v)}
        onSetClickMode={handleSetClickMode}
        onClearDrawnLines={() => setDrawnLines([])}
      />

      <ChartLegend
        showEma20={showEma20}
        showEma50={showEma50}
        showEma200={showEma200}
        showTrades={showTrades}
        showVolume={showVolume}
        showRsi={showRsi}
        showMacd={showMacd}
        showBb={showBb}
        showVwap={showVwap}
        showSr={showSr}
      />

      {/* Active mode indicator */}
      {clickMode !== "none" && (
        <div className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-mono ${
          clickMode === "hline" || clickMode === "ray"
            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
            : clickMode === "trendline" || clickMode === "extline"
            ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
            : clickMode === "channel"
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
            : clickMode === "fibonacci" || clickMode === "fibext" || clickMode === "fibtimezone"
            ? "border-purple-500/40 bg-purple-500/10 text-purple-400"
            : clickMode === "crossline"
            ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
            : "border-green-500/40 bg-green-500/10 text-green-400"
        }`}>
          <span className="animate-pulse">●</span>
          {clickMode === "hline"
            ? "Y-ÇİZGİ — Grafik üzerine tıkla → yatay çizgi"
            : clickMode === "ray"
            ? "IŞIN — Grafik üzerine tıkla → yatay ışın"
            : clickMode === "trendline"
            ? pendingPoint
              ? "TREND — 2. nokta: bitiş noktasına tıkla (ESC = iptal)"
              : "TREND — 1. nokta: başlangıç noktasına tıkla"
            : clickMode === "extline"
            ? pendingPoint
              ? "UZAYAN ÇİZGİ — 2. nokta: bitiş noktasına tıkla (ESC = iptal)"
              : "UZAYAN ÇİZGİ — 1. nokta: başlangıç noktasına tıkla"
            : clickMode === "channel"
            ? pendingChannelLine
              ? "PARALEL KANAL — 3. nokta: kanal genişliğini tıkla (ESC = 2.adım iptal)"
              : pendingPoint
              ? "PARALEL KANAL — 2. nokta: bitiş noktasına tıkla (ESC = iptal)"
              : "PARALEL KANAL — 1. nokta: başlangıç noktasına tıkla"
            : clickMode === "fibonacci"
            ? pendingPoint
              ? "FİBONACCİ — 2. nokta: bitiş fiyatına tıkla (ESC = iptal)"
              : "FİBONACCİ — 1. nokta: başlangıç fiyatına tıkla"
            : clickMode === "fibext"
            ? pendingPoint
              ? "FİB EXT — 2. nokta: bitiş fiyatına tıkla (ESC = iptal)"
              : "FİB EXT — 1. nokta: başlangıç fiyatına tıkla"
            : clickMode === "vline"
            ? "DİKEY ÇİZGİ — Grafik üzerine tıkla → dikey çizgi"
            : clickMode === "crossline"
            ? "CROSS ÇİZGİ — Grafik üzerine tıkla → artı işareti"
            : clickMode === "fibtimezone"
            ? pendingPoint
              ? "FİB ZAMAN — 2. nokta: zaman aralığı bitiş noktasına tıkla (ESC = iptal)"
              : "FİB ZAMAN — 1. nokta: başlangıç noktasına tıkla"
            : "PRICE MODE — Grafik üzerine tıkla → fiyat yakala"}
          <button
            onClick={() => {
              if (pendingChannelLine) { setPendingChannelLine(null); return; }
              if (pendingPoint) { setPendingPoint(null); return; }
              handleSetClickMode("none");
            }}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            {pendingChannelLine ? "↩ 2.adım iptal" : pendingPoint ? "↩ 1.nokta iptal" : "✕ İptal"}
          </button>
        </div>
      )}

      {/* Captured price panel */}
      {clickMode === "price" && capturedPrice !== null && (
        <div className="flex items-center gap-3 rounded border border-green-500/40 bg-green-500/10 px-3 py-2">
          <span className="font-mono text-xs text-text-t3">Fiyat</span>
          <span className="font-mono text-sm font-bold text-green-400">
            ${fmtPrice(capturedPrice)}
          </span>
          <div className="flex gap-1 ml-2">
            {(["Entry", "TP1", "TP2", "SL"] as const).map((label) => (
              <button
                key={label}
                onClick={() => void copyToClipboard(fmtPrice(capturedPrice))}
                className={`rounded border px-2 py-0.5 font-mono text-2xs tracking-wider transition-colors ${
                  label === "SL"
                    ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                    : label.startsWith("TP")
                      ? "border-green-500/40 text-green-400 hover:bg-green-500/10"
                      : "border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                }`}
                title={`${label} olarak kopyala`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-2xs text-text-t4">
            Kopyalandı ✓ veya kaydet
          </span>
          <button
            onClick={() => setCapturedPrice(null)}
            className="text-text-t4 hover:text-text-t2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chart grid — single or split */}
      <div className={`flex gap-3 ${showSplit ? "flex-col md:flex-row" : "flex-col"}`}>
        {/* Primary chart */}
        <div className={showSplit ? "flex-1 min-w-0" : "w-full"}>
          {showSplit && (
            <p className="mb-1 font-mono text-2xs text-text-t4 uppercase tracking-wider">
              {pair} · {timeframe.toUpperCase()}
            </p>
          )}
          {/* Fullscreen wrapper */}
          <div className={isFullscreen ? "fixed inset-0 z-50 bg-bg-page flex flex-col" : ""}>
            {isFullscreen && (
              <div className="flex items-center gap-2 shrink-0 border-b border-border px-3 py-2">
                <span className="font-mono text-xs text-text-t2 font-bold">{pair} · {timeframe.toUpperCase()}</span>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="ml-auto rounded border border-border px-2 py-0.5 font-mono text-2xs text-text-t3 hover:text-text-t1 hover:border-text-t2 transition-colors"
                >
                  ✕ Kapat
                </button>
              </div>
            )}
            <div className={isFullscreen ? "flex-1 flex" : "flex"}>
              {/* Drawing toolbar — left of chart canvas */}
              <DrawingToolbar
                clickMode={clickMode}
                onSetClickMode={handleSetClickMode}
                hasDrawings={drawnLines.length > 0 || rayLines.length > 0 || trendLines.length > 0
                  || extLines.length > 0 || channels.length > 0 || fibLevels.length > 0 || fibExtensions.length > 0
                  || verticalLines.length > 0 || crossLines.length > 0 || fibTimeZones.length > 0}
                pendingPoint={!!(pendingPoint || pendingChannelLine)}
                onClearAll={clearAllDrawings}
              />
              <div className={isFullscreen ? "flex-1 relative" : "relative flex-1"}>
                {!isFullscreen && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="absolute top-1 right-1 z-20 rounded border border-border bg-bg-card/80 px-1.5 py-0.5 font-mono text-2xs text-text-t4 hover:text-text-t2 hover:border-text-t3 transition-colors"
                    title="Tam ekran"
                  >
                    ⛶
                  </button>
                )}
                <PriceChart
                  series={series}
                  height={isFullscreen
                    ? (typeof window !== "undefined" ? window.innerHeight - 56 : 700)
                    : (showSplit ? 360 : chartHeight)}
                  theme={theme}
                  onChartClick={handleChartClick}
                  resetKey={`${pair}_${timeframe}`}
                  liqBands={liqBands}
                  currentPrice={livePrice ?? undefined}
                />
                {chartLoadState !== "ready" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-card/70 rounded pointer-events-none">
                    {chartLoadState === "loading" ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-brand/40 border-t-brand animate-spin" />
                        <span className="font-mono text-[10px] text-text-t4">Yükleniyor…</span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-text-t4">Veri yüklenemedi, tekrar deneniyor…</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Resize handle (only when not split or fullscreen) */}
          {!showSplit && !isFullscreen && (
            <div
              className="mt-0.5 h-1.5 w-full cursor-row-resize rounded bg-border/30 hover:bg-border/70 transition-colors"
              onMouseDown={handleResizeMouseDown}
              title="Grafik yüksekliğini ayarla"
            />
          )}
        </div>

        {/* Secondary chart (split view) */}
        {showSplit && (
          <div className="flex-1 min-w-0">
            <p className="mb-1 font-mono text-2xs text-text-t4 uppercase tracking-wider">
              {pair} · {secTf.toUpperCase()}
              {secLoading && <span className="ml-2 opacity-50">…</span>}
            </p>
            {secSeries ? (
              <PriceChart
                series={secSeries}
                height={360}
                theme={theme}
                onChartClick={handleChartClick}
                resetKey={`${pair}_${secTf}`}
                currentPrice={livePrice ?? undefined}
              />
            ) : (
              <div className="flex items-center justify-center h-[360px] rounded border border-border bg-bg-card">
                <span className="font-mono text-2xs text-text-t4">
                  {secLoading ? "Yükleniyor…" : "Veri yok"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Flow Panel */}
      {showFlow && <OrderFlowPanel pair={pair} />}

      {/* Quick Trade Panel */}
      {showQuick && <QuickTradePanel pair={pair} />}

      {/* All drawn items — individual ✕ per drawing */}
      {(drawnLines.length > 0 || rayLines.length > 0 || trendLines.length > 0 ||
        extLines.length > 0 || channels.length > 0 || fibLevels.length > 0 || fibExtensions.length > 0
        || verticalLines.length > 0 || crossLines.length > 0 || fibTimeZones.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {drawnLines.map((dl) => (
            <div key={dl.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: dl.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">─</span>
              <span className="font-mono text-2xs text-text-t2">${dl.label}</span>
              <button onClick={() => setDrawnLines((prev) => prev.filter((l) => l.id !== dl.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {rayLines.map((rl) => (
            <div key={rl.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: rl.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">→</span>
              <span className="font-mono text-2xs text-text-t2">${rl.label}</span>
              <button onClick={() => setRayLines((prev) => prev.filter((l) => l.id !== rl.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {trendLines.map((tl) => (
            <div key={tl.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: tl.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">╱</span>
              <span className="font-mono text-2xs text-text-t2">TL</span>
              <button onClick={() => setTrendLines((prev) => prev.filter((l) => l.id !== tl.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {extLines.map((el) => (
            <div key={el.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: el.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">↔</span>
              <span className="font-mono text-2xs text-text-t2">EXT</span>
              <button onClick={() => setExtLines((prev) => prev.filter((l) => l.id !== el.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: ch.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">≡</span>
              <span className="font-mono text-2xs text-text-t2">KANAL</span>
              <button onClick={() => setChannels((prev) => prev.filter((l) => l.id !== ch.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {fibLevels.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: f.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">φ</span>
              <span className="font-mono text-2xs text-text-t2">FIB</span>
              <button onClick={() => setFibLevels((prev) => prev.filter((l) => l.id !== f.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {fibExtensions.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: f.color + "60" }}>
              <span className="font-mono text-2xs text-text-t4">Φ</span>
              <span className="font-mono text-2xs text-text-t2">FIB+</span>
              <button onClick={() => setFibExtensions((prev) => prev.filter((l) => l.id !== f.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {verticalLines.map((vl) => (
            <div key={vl.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: (vl.color ?? "#f59e0b") + "60" }}>
              <span className="font-mono text-2xs text-text-t4">│</span>
              <span className="font-mono text-2xs text-text-t2">V-ÇİZ</span>
              <button onClick={() => setVerticalLines((prev) => prev.filter((l) => l.id !== vl.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {crossLines.map((cl) => (
            <div key={cl.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: (cl.color ?? "#f97316") + "60" }}>
              <span className="font-mono text-2xs text-text-t4">✛</span>
              <span className="font-mono text-2xs text-text-t2">CROSS</span>
              <button onClick={() => setCrossLines((prev) => prev.filter((l) => l.id !== cl.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
          {fibTimeZones.map((ftz) => (
            <div key={ftz.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5" style={{ borderColor: (ftz.color ?? "#a78bfa") + "60" }}>
              <span className="font-mono text-2xs text-text-t4">ƒ</span>
              <span className="font-mono text-2xs text-text-t2">FIB-T</span>
              <button onClick={() => setFibTimeZones((prev) => prev.filter((l) => l.id !== ftz.id))} className="font-mono text-2xs text-text-t4 hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}

      </div>{/* end main chart column */}

      {/* WatchlistPanel — TradingView-style right column */}
      <WatchlistPanel activePair={pair} onPairChange={handlePairChange} />
    </div>
  );
}
