"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useT } from "@/lib/i18n/context";
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
import type { ChartSeries, LinePoint, VolumePoint, ChartMarker, MacdPoint, AlarmLevel, BbBands, VwapBands, SrLevel, TradeLevelLine, DrawnLine } from "@/lib/chart/types";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { WatchlistPanel } from "@/components/grafik/WatchlistPanel";
import { LivePriceStrip } from "@/components/karar/LivePriceStrip";
import { useOkxCandleStream } from "@/lib/ws/useOkxCandleStream";

const PriceChart = dynamic(
  () => import("@/components/grafik/PriceChart").then((m) => m.PriceChart),
  { ssr: false },
);

const VOL_UP = "rgba(34,197,94,0.5)";
const VOL_DOWN = "rgba(239,68,68,0.5)";

const CHART_STORAGE_KEY = "qx_chart_v1";
const VALID_TF = new Set<string>(["5m", "15m", "1h", "4h", "1d"]);

/** Secondary timeframe for split view */
const SEC_TF: Record<Timeframe, Timeframe> = {
  "1d": "4h",
  "4h": "1h",
  "1h": "15m",
  "15m": "5m",
  "5m": "1m",
  "1m": "1m",
};

/** Build ChartSeries from a candle array + overlay flags */
function buildSeries(
  candles: Candle[],
  trades: ReturnType<typeof useTradesStore.getState>["trades"],
  pair: Pair,
  opts: {
    ema20: boolean; ema50: boolean; ema200: boolean; volume: boolean;
    rsi: boolean; macd: boolean; bb: boolean; vwap: boolean; sr: boolean;
    trades: boolean; alarmLevels: AlarmLevel[]; tradeLevels: TradeLevelLine[];
    drawnLines: DrawnLine[]; livePrice?: number;
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
    currentPrice: opts.livePrice,
  };
}

export default function GrafikPage() {
  const t = useT();
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

  // New tool state (not persisted — session only)
  const [showSplit, setShowSplit]       = useState(false);
  const [showFlow, setShowFlow]         = useState(false);
  const [showQuick, setShowQuick]       = useState(false);
  const [clickMode, setClickMode]       = useState<ChartClickMode>("none");
  const [drawnLines, setDrawnLines]     = useState<DrawnLine[]>([]);
  const [capturedPrice, setCapturedPrice] = useState<number | null>(null);
  const [secCandles, setSecCandles]     = useState<Candle[]>([]);
  const [secLoading, setSecLoading]     = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHART_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.pair === "string" && (PAIRS as readonly string[]).includes(s.pair)) setPair(s.pair as Pair);
      if (typeof s.tf === "string" && VALID_TF.has(s.tf)) setTimeframe(s.tf as Timeframe);
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
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist settings on change
  useEffect(() => {
    try {
      localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify({
        pair, tf: timeframe,
        o: { ema20: showEma20, ema50: showEma50, ema200: showEma200, vol: showVolume,
             rsi: showRsi, macd: showMacd, bb: showBb, vwap: showVwap, sr: showSr, trades: showTrades },
      }));
    } catch { /* ignore */ }
  }, [pair, timeframe, showEma20, showEma50, showEma200, showVolume, showRsi, showMacd, showBb, showVwap, showSr, showTrades]);

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

  // Live candle stream — updates last candle via RAF-throttled WS (ADIM 3)
  useOkxCandleStream(pair, timeframe);

  const candlesRaw = useCandleStore((s) => s.candles[`${pair}_${timeframe}`]);
  const candles    = candlesRaw ?? EMPTY_CANDLES;
  const trades     = useTradesStore((s) => s.trades);
  const positions  = usePositionStore((s) => s.positions);
  const alarms     = usePriceAlarmStore((s) => s.alarms);
  const livePrice  = useMarketStore((s) => s.prices[pair]?.last ?? null);

  const tradeLevels = useMemo<TradeLevelLine[]>(() => {
    const allPos = positions ?? [];

    // Gate: positionStore boşsa erken çıkış — tradesStore "open" dese bile çizgi çizilmez
    const livePos = allPos.filter(
      (p) => p.pair === pair && p.direction !== "NEUTRAL"
    );
    if (livePos.length === 0) return [];

    const lines: TradeLevelLine[] = [];

    for (const pos of livePos) {
      const dir = pos.direction as "LONG" | "SHORT";

      // Entry — OKX truth, her zaman mevcut
      lines.push({ price: pos.entryPx, kind: "entry", direction: dir });

      // tradesStore: yalnızca eksik seviye değerleri için backup
      // Açıklık kararına karışmıyor; livePos guard geçtikten sonra okunuyor
      const appTrade = trades.find(
        (t) => !t.isPaper && t.status === "open" && t.pair === pair && t.direction === dir
      );

      // SL: OKX algo order birincil; null ise app-side stopPrice değeri
      const sl = pos.slTriggerPx ?? appTrade?.stopPrice ?? null;
      if (sl) lines.push({ price: sl, kind: "sl", direction: dir });

      // TP1: OKX tpTriggerPx birincil; null ise app-side takeProfit1 değeri
      const tp1 = pos.tpTriggerPx ?? appTrade?.takeProfit1 ?? null;
      if (tp1) lines.push({ price: tp1, kind: "tp1", direction: dir });

      // TP2: OKX'te tekil TP — tp2 yalnız app-side'dan
      if (appTrade?.takeProfit2) lines.push({ price: appTrade.takeProfit2, kind: "tp2", direction: dir });
    }

    return lines;
  }, [positions, trades, pair]);

  const alarmLevels = useMemo<AlarmLevel[]>(
    () =>
      alarms
        .filter((a) => a.pair === pair && a.status === "active")
        .map((a) => ({ price: a.targetPrice, condition: a.condition, label: a.label })),
    [alarms, pair],
  );

  // Primary series
  const series = useMemo(() =>
    buildSeries(candles, trades, pair, {
      ema20: showEma20, ema50: showEma50, ema200: showEma200,
      volume: showVolume, rsi: showRsi, macd: showMacd, bb: showBb,
      vwap: showVwap, sr: showSr, trades: showTrades,
      alarmLevels, tradeLevels, drawnLines,
      livePrice: livePrice ?? undefined,
    }),
    [candles, trades, pair, showEma20, showEma50, showEma200, showVolume,
     showRsi, showMacd, showBb, showVwap, showSr, showTrades,
     alarmLevels, tradeLevels, drawnLines, livePrice],
  );

  // Secondary series (split view — EMA200 + volume only, same drawnLines)
  const secSeries = useMemo<ChartSeries | null>(() => {
    if (!showSplit || secCandles.length === 0) return null;
    return buildSeries(secCandles, trades, pair, {
      ema20: false, ema50: false, ema200: true,
      volume: showVolume, rsi: false, macd: false, bb: false,
      vwap: false, sr: showSr, trades: false,
      alarmLevels: [], tradeLevels, drawnLines,
      livePrice: livePrice ?? undefined,
    });
  }, [showSplit, secCandles, trades, pair, showVolume, showSr, tradeLevels, drawnLines, livePrice]);

  // Click handler dispatched to the appropriate mode
  const handlePriceClick = useCallback((price: number) => {
    if (clickMode === "hline") {
      const label = price >= 1000
        ? price.toFixed(0)
        : price >= 1
          ? price.toFixed(2)
          : price.toFixed(4);
      setDrawnLines((prev) => [
        ...prev,
        { id: `dl_${Date.now()}`, price, color: "#f59e0b", label },
      ]);
    } else if (clickMode === "price") {
      setCapturedPrice(price);
    }
  }, [clickMode]);

  const handleSetClickMode = useCallback((mode: ChartClickMode) => {
    setClickMode(mode);
    // Reset captured price when leaving price mode
    if (mode !== "price") setCapturedPrice(null);
  }, []);

  // Format for the captured price display
  function fmtPrice(p: number): string {
    return p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  return (
    <div className="flex gap-3 items-start">
      {/* Dikey canlı fiyat şeridi — 20 parite, mobilde gizli */}
      <div className="hidden md:block">
        <LivePriceStrip variant="vertical" />
      </div>

      {/* WatchlistPanel — TradingView-style right column */}
      <WatchlistPanel activePair={pair} onPairChange={setPair} />

      {/* Main chart column */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

      <ChartControls
        pair={pair}
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
        onPairChange={setPair}
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
          clickMode === "hline"
            ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
            : "border-green-500/40 bg-green-500/10 text-green-400"
        }`}>
          <span className="animate-pulse">●</span>
          {clickMode === "hline"
            ? t("grafik.drawHline")
            : t("grafik.drawPrice")}
          <button
            onClick={() => handleSetClickMode("none")}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            {t("grafik.drawCancelAll")}
          </button>
        </div>
      )}

      {/* Captured price panel */}
      {clickMode === "price" && capturedPrice !== null && (
        <div className="flex items-center gap-3 rounded border border-green-500/40 bg-green-500/10 px-3 py-2">
          <span className="font-mono text-xs text-text-t3">{t("grafik.priceCaptureLabel")}</span>
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
                title={t("grafik.priceCopyAs", { label })}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-2xs text-text-t4">
            {t("grafik.priceCaptureCopied")}
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
          <PriceChart
            series={series}
            height={showSplit ? 360 : 480}
            theme={theme}
            onPriceClick={handlePriceClick}
            resetKey={`${pair}_${timeframe}`}
          />
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
                onPriceClick={handlePriceClick}
                resetKey={`${pair}_${secTf}`}
              />
            ) : (
              <div className="flex items-center justify-center h-[360px] rounded border border-border bg-bg-card">
                <span className="font-mono text-2xs text-text-t4">
                  {secLoading ? t("grafik.loading") : t("grafik.empty")}
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

      {/* Drawn lines list */}
      {drawnLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {drawnLines.map((dl) => (
            <div
              key={dl.id}
              className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5"
              style={{ borderColor: dl.color + "60" }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: dl.color }}
              />
              <span className="font-mono text-2xs text-text-t2">${dl.label}</span>
              <button
                onClick={() => setDrawnLines((prev) => prev.filter((l) => l.id !== dl.id))}
                className="font-mono text-2xs text-text-t4 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      </div>{/* end main chart column */}
    </div>
  );
}
