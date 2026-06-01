"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { ChartControls } from "@/components/grafik/ChartControls";
import { ChartLegend } from "@/components/grafik/ChartLegend";
import { emaSeries } from "@/lib/indicators/ema";
import { rsiSeries } from "@/lib/indicators/rsi";
import { macdSeries } from "@/lib/indicators/macd";
import { bbSeries } from "@/lib/indicators/bb";
import type { Pair } from "@/lib/constants/pairs";
import type { Timeframe } from "@/lib/okx/candles";
import type { ChartSeries, LinePoint, VolumePoint, ChartMarker, MacdPoint, AlarmLevel, BbBands } from "@/lib/chart/types";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";

const PriceChart = dynamic(
  () => import("@/components/grafik/PriceChart").then((m) => m.PriceChart),
  { ssr: false },
);

const VOL_UP = "rgba(34,197,94,0.5)";
const VOL_DOWN = "rgba(239,68,68,0.5)";

export default function GrafikPage() {
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

  const candlesRaw = useCandleStore((s) => s.candles[`${pair}_${timeframe}`]);
  const candles = candlesRaw ?? EMPTY_CANDLES;
  const trades = useTradesStore((s) => s.trades);
  const alarms = usePriceAlarmStore((s) => s.alarms);

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

    return { candles: candlePoints, ema20, ema50, ema200, volume, rsi, macdData, bb: bbBands, alarmLevels, markers };
  }, [candles, trades, pair, showEma20, showEma50, showEma200, showTrades, showVolume, showRsi, showMacd, showBb, alarmLevels]);

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
      />
      <PriceChart series={series} height={480} />
    </div>
  );
}
