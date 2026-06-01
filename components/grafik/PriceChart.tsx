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
}

const COLOR_UP    = "#22c55e";
const COLOR_DOWN  = "#ef4444";
const COLOR_EMA20 = "#3b82f6";
const COLOR_EMA50 = "#f59e0b";
const COLOR_EMA200 = "#a855f7";
const COLOR_RSI   = "#ec4899";
const COLOR_GRID  = "#e5e5e5";
const COLOR_TEXT  = "#525252";

// Scale margin presets for each pane combination
function candleMargins(hasVol: boolean, hasRsi: boolean) {
  if (hasVol && hasRsi) return { top: 0.03, bottom: 0.42 };
  if (hasVol || hasRsi)  return { top: 0.03, bottom: 0.22 };
  return { top: 0.03, bottom: 0.02 };
}
function volMargins(hasRsi: boolean) {
  return hasRsi
    ? { top: 0.60, bottom: 0.20 }
    : { top: 0.78, bottom: 0.02 };
}
const RSI_MARGINS = { top: 0.82, bottom: 0.02 };

export function PriceChart({ series, height = 400 }: Props): React.ReactElement {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema20Ref      = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref      = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref     = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiRef        = useRef<ISeriesApi<"Line"> | null>(null);

  // ─── Mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: COLOR_TEXT,
        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
      },
      grid: {
        vertLines: { color: COLOR_GRID },
        horzLines: { color: COLOR_GRID },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: COLOR_GRID,
      },
      rightPriceScale: { borderColor: COLOR_GRID },
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
      volumeRef.current = null;
      rsiRef.current    = null;
    };
  }, [height]);

  // ─── Data / visibility update ────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    // Determine what's active this render
    const hasVol = !!(series.volume?.length);
    const hasRsi = !!(series.rsi?.length);

    // 1. Update candle price scale margins
    chart.priceScale("right").applyOptions({
      scaleMargins: candleMargins(hasVol, hasRsi),
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

    // 6. Volume histogram
    if (hasVol) {
      if (!volumeRef.current) {
        volumeRef.current = chart.addHistogramSeries({
          priceScaleId: "volume",
          priceLineVisible: false,
          lastValueVisible: false,
        });
        chart.priceScale("volume").applyOptions({
          drawTicks: false,
          borderVisible: false,
        });
      }
      chart.priceScale("volume").applyOptions({
        scaleMargins: volMargins(hasRsi),
      });
      volumeRef.current.setData(series.volume as HistogramData<Time>[]);
    } else if (volumeRef.current) {
      chart.removeSeries(volumeRef.current);
      volumeRef.current = null;
    }

    // 7. RSI panel
    if (hasRsi) {
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
        chart.priceScale("rsi").applyOptions({
          drawTicks: false,
          borderVisible: false,
          scaleMargins: RSI_MARGINS,
        });
        rsiRef.current = rsiLine;
      }
      rsiRef.current.setData(series.rsi as LineData<Time>[]);
    } else if (rsiRef.current) {
      chart.removeSeries(rsiRef.current);
      rsiRef.current = null;
    }

    // 8. Trade markers
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
