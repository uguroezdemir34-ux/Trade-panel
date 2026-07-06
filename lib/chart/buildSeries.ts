import { emaSeries } from "@/lib/indicators/ema";
import { rsiSeries } from "@/lib/indicators/rsi";
import { macdSeries } from "@/lib/indicators/macd";
import { bbSeries } from "@/lib/indicators/bb";
import { vwapSeries } from "@/lib/indicators/vwap";
import { findAllSwingHighs, findAllSwingLows } from "@/lib/sr/swing";
import { toIndicatorCandle, type Candle } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";
import type { TradeSnapshot } from "@/lib/trades/types";
import type {
  ChartSeries,
  LinePoint,
  VolumePoint,
  ChartMarker,
  MacdPoint,
  AlarmLevel,
  BbBands,
  VwapBands,
  SrLevel,
  TradeLevelLine,
} from "@/lib/chart/types";
import { SERIES_COLORS } from "@/lib/chart/config";

export interface BuildSeriesOpts {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  bb: boolean;
  vwap: boolean;
  sr: boolean;
  trades: boolean;
  alarmLevels: AlarmLevel[];
  tradeLevels: TradeLevelLine[];
}

/**
 * Builds indicator-only ChartSeries from raw candles + trade history.
 * Drawing overlays (drawnLines, trendLines, etc.) are NOT included here —
 * they are passed as separate stable props to PriceChartV2.
 */
export function buildSeries(
  candles: Candle[],
  trades: TradeSnapshot[],
  pair: Pair,
  opts: BuildSeriesOpts,
): ChartSeries {
  const candlePoints = candles.map((c) => ({
    time:  Math.floor(c.ts / 1000) as unknown as number,
    open:  c.open,
    high:  c.high,
    low:   c.low,
    close: c.close,
  }));
  const closes = candles.map((c) => c.close);
  const times  = candles.map((c) => Math.floor(c.ts / 1000));

  let ema20: LinePoint[] | undefined;
  let ema50: LinePoint[] | undefined;
  let ema200: LinePoint[] | undefined;

  if (opts.ema20 && candles.length >= 20) {
    const vals = emaSeries(closes, { period: 20 });
    ema20 = vals.map((v, i) => (v !== null ? { time: times[i], value: v } : null))
      .filter((p): p is LinePoint => p !== null);
  }
  if (opts.ema50 && candles.length >= 50) {
    const vals = emaSeries(closes, { period: 50 });
    ema50 = vals.map((v, i) => (v !== null ? { time: times[i], value: v } : null))
      .filter((p): p is LinePoint => p !== null);
  }
  if (opts.ema200 && candles.length >= 200) {
    const vals = emaSeries(closes, { period: 200 });
    ema200 = vals.map((v, i) => (v !== null ? { time: times[i], value: v } : null))
      .filter((p): p is LinePoint => p !== null);
  }

  let volume: VolumePoint[] | undefined;
  if (opts.volume && candles.length > 0) {
    volume = candles.map((c, i) => ({
      time:  times[i],
      value: c.volume,
      color: c.close >= c.open ? SERIES_COLORS.volUp : SERIES_COLORS.volDown,
    }));
  }

  let rsi: LinePoint[] | undefined;
  if (opts.rsi && candles.length >= 15) {
    const vals = rsiSeries(closes, { period: 14 });
    rsi = vals.map((v, i) => (v !== null ? { time: times[i], value: v } : null))
      .filter((p): p is LinePoint => p !== null);
  }

  let macdData: MacdPoint[] | undefined;
  if (opts.macd && candles.length >= 35) {
    macdData = macdSeries(closes, times);
  }

  let bbBands: BbBands | undefined;
  if (opts.bb && candles.length >= 20) {
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

  let vwapBands: VwapBands | undefined;
  if (opts.vwap && candles.length >= 2) {
    const pts = vwapSeries(
      closes,
      candles.map((c) => c.high),
      candles.map((c) => c.low),
      candles.map((c) => c.volume),
      candles.map((c) => c.ts),
    );
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

  let markers: ChartMarker[] | undefined;
  if (opts.trades) {
    markers = trades
      .filter((t) => t.pair === pair)
      .map((t) => ({
        time:     Math.floor(t.openedAt / 1000),
        position: t.direction === "LONG" ? ("belowBar" as const) : ("aboveBar" as const),
        color:    t.direction === "LONG" ? "#22c55e" : "#ef4444",
        shape:    t.direction === "LONG" ? ("arrowUp" as const) : ("arrowDown" as const),
        text:     `${t.direction} ${t.isPaper ? "(P)" : ""}`,
      }));
  }

  let srLevels: SrLevel[] | undefined;
  if (opts.sr && candles.length >= 7) {
    const indCandles = candles.map(toIndicatorCandle);
    const highs = findAllSwingHighs(indCandles, 60, 3, 8);
    const lows  = findAllSwingLows(indCandles, 60, 3, 8);
    srLevels = [
      ...highs.map((p) => ({ price: p.price, type: "resistance" as const })),
      ...lows.map((p)  => ({ price: p.price, type: "support"    as const })),
    ];
  }

  return {
    candles: candlePoints,
    ema20, ema50, ema200,
    volume, rsi, macdData,
    bb: bbBands,
    vwap: vwapBands,
    alarmLevels: opts.alarmLevels,
    markers,
    srLevels,
    tradeLevels: opts.tradeLevels,
    // drawing fields intentionally absent — passed as separate props to PriceChartV2
  };
}
