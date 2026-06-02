"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { ChartControls } from "@/components/grafik/ChartControls";
import { ChartLegend } from "@/components/grafik/ChartLegend";
import { emaSeries } from "@/lib/indicators/ema";
import { rsiSeries } from "@/lib/indicators/rsi";
import { macdSeries } from "@/lib/indicators/macd";
import { bbSeries } from "@/lib/indicators/bb";
import { vwapSeries } from "@/lib/indicators/vwap";
import { findAllSwingHighs, findAllSwingLows } from "@/lib/sr/swing";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { Timeframe } from "@/lib/okx/candles";
import type { ChartSeries, LinePoint, VolumePoint, ChartMarker, MacdPoint, AlarmLevel, BbBands, VwapBands, SrLevel, TradeLevelLine } from "@/lib/chart/types";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";

const PriceChart = dynamic(
  () => import("@/components/grafik/PriceChart").then((m) => m.PriceChart),
  { ssr: false },
);

const VOL_UP = "rgba(34,197,94,0.5)";
const VOL_DOWN = "rgba(239,68,68,0.5)";

const CHART_STORAGE_KEY = "qx_chart_v1";
const VALID_TF = new Set<string>(["5m", "15m", "1h", "4h", "1d"]);

export default function GrafikPage() {
  const theme = useSettingsStore((s) => s.theme);

  const [pair, setPair] = useState<Pair>("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showTrades, setShowTrades] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [showBb, setShowBb] = useState(false);
  const [showVwap, setShowVwap] = useState(false);
  const [showSr, setShowSr] = useState(false);

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
        if (o.ema20 !== undefined) setShowEma20(o.ema20);
        if (o.ema50 !== undefined) setShowEma50(o.ema50);
        if (o.ema200 !== undefined) setShowEma200(o.ema200);
        if (o.vol !== undefined) setShowVolume(o.vol);
        if (o.rsi !== undefined) setShowRsi(o.rsi);
        if (o.macd !== undefined) setShowMacd(o.macd);
        if (o.bb !== undefined) setShowBb(o.bb);
        if (o.vwap !== undefined) setShowVwap(o.vwap);
        if (o.sr !== undefined) setShowSr(o.sr);
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

  const candlesRaw = useCandleStore((s) => s.candles[`${pair}_${timeframe}`]);
  const candles = candlesRaw ?? EMPTY_CANDLES;
  const trades = useTradesStore((s) => s.trades);
  const alarms = usePriceAlarmStore((s) => s.alarms);
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? null);

  const tradeLevels = useMemo<TradeLevelLine[]>(() => {
    const open = trades.filter((t) => t.status === "open" && t.pair === pair);
    const lines: TradeLevelLine[] = [];
    for (const t of open) {
      if (t.direction !== "LONG" && t.direction !== "SHORT") continue;
      lines.push({ price: t.entryPrice, kind: "entry", direction: t.direction });
      lines.push({ price: t.stopPrice, kind: "sl", direction: t.direction });
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

  const series: ChartSeries = useMemo(() => {
    const candlePoints = candles.map((c) => ({
      time: Math.floor(c.ts / 1000) as unknown as number,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => Math.floor(c.ts / 1000));

    // EMA overlays
    let ema20: LinePoint[] | undefined;
    let ema50: LinePoint[] | undefined;
    let ema200: LinePoint[] | undefined;

    if (showEma20 && candles.length >= 20) {
      const vals = emaSeries(closes, { period: 20 });
      ema20 = vals
        .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
        .filter((p): p is LinePoint => p !== null);
    }

    if (showEma50 && candles.length >= 50) {
      const vals = emaSeries(closes, { period: 50 });
      ema50 = vals
        .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
        .filter((p): p is LinePoint => p !== null);
    }

    if (showEma200 && candles.length >= 200) {
      const vals = emaSeries(closes, { period: 200 });
      ema200 = vals
        .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
        .filter((p): p is LinePoint => p !== null);
    }

    // Volume bars
    let volume: VolumePoint[] | undefined;
    if (showVolume && candles.length > 0) {
      volume = candles.map((c, i) => ({
        time: times[i],
        value: c.volume,
        color: c.close >= c.open ? VOL_UP : VOL_DOWN,
      }));
    }

    // RSI panel
    let rsi: LinePoint[] | undefined;
    if (showRsi && candles.length >= 15) {
      const vals = rsiSeries(closes, { period: 14 });
      rsi = vals
        .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
        .filter((p): p is LinePoint => p !== null);
    }

    // MACD panel
    let macdData: MacdPoint[] | undefined;
    if (showMacd && candles.length >= 35) {
      macdData = macdSeries(closes, times);
    }

    // Bollinger Bands overlay
    let bbBands: BbBands | undefined;
    if (showBb && candles.length >= 20) {
      const bbVals = bbSeries(closes);
      const upper: LinePoint[] = [];
      const middle: LinePoint[] = [];
      const lower: LinePoint[] = [];
      bbVals.forEach((v, i) => {
        if (v !== null) {
          upper.push({ time: times[i], value: v.upper });
          middle.push({ time: times[i], value: v.mean });
          lower.push({ time: times[i], value: v.lower });
        }
      });
      if (upper.length > 0) bbBands = { upper, middle, lower };
    }

    // VWAP overlay
    let vwapBands: VwapBands | undefined;
    if (showVwap && candles.length >= 2) {
      const highs   = candles.map((c) => c.high);
      const lows    = candles.map((c) => c.low);
      const vols    = candles.map((c) => c.volume);
      const tsMs    = candles.map((c) => c.ts);
      const pts = vwapSeries(closes, highs, lows, vols, tsMs);
      const vwapLine: LinePoint[] = [];
      const upperLine: LinePoint[] = [];
      const lowerLine: LinePoint[] = [];
      pts.forEach((v, i) => {
        if (v !== null) {
          vwapLine.push({ time: times[i], value: v.vwap });
          upperLine.push({ time: times[i], value: v.upper });
          lowerLine.push({ time: times[i], value: v.lower });
        }
      });
      if (vwapLine.length > 0) vwapBands = { vwap: vwapLine, upper: upperLine, lower: lowerLine };
    }

    // Trade markers
    let markers: ChartMarker[] | undefined;
    if (showTrades) {
      const pairTrades = trades.filter((t) => t.pair === pair);
      markers = pairTrades.map((t) => ({
        time: Math.floor(t.openedAt / 1000),
        position: t.direction === "LONG" ? "belowBar" : "aboveBar",
        color: t.direction === "LONG" ? "#22c55e" : "#ef4444",
        shape: t.direction === "LONG" ? "arrowUp" : "arrowDown",
        text: `${t.direction} ${t.isPaper ? "(P)" : ""}`,
      }));
    }

    // Swing S/R level overlays
    let srLevels: SrLevel[] | undefined;
    if (showSr && candles.length >= 7) {
      const indCandles = candles.map(toIndicatorCandle);
      const highs = findAllSwingHighs(indCandles, 60, 3, 8);
      const lows = findAllSwingLows(indCandles, 60, 3, 8);
      srLevels = [
        ...highs.map((p) => ({ price: p.price, type: "resistance" as const })),
        ...lows.map((p) => ({ price: p.price, type: "support" as const })),
      ];
    }

    return { candles: candlePoints, ema20, ema50, ema200, volume, rsi, macdData, bb: bbBands, vwap: vwapBands, alarmLevels, markers, srLevels, tradeLevels, currentPrice: livePrice ?? undefined };
  }, [candles, trades, pair, showEma20, showEma50, showEma200, showTrades, showVolume, showRsi, showMacd, showBb, showVwap, showSr, alarmLevels, tradeLevels, livePrice]);

  return (
    <div className="flex flex-col gap-3">
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
      <PriceChart series={series} height={480} theme={theme} />
    </div>
  );
}
