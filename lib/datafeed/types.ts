/**
 * TradingView Charting Library — Datafeed API type definitions.
 *
 * Hand-written from the public JS Financial Charting Library / Datafeed API spec.
 * Replace this file's exports with imports from the official @tradingview/charting_library
 * package once the TV repo is available:
 *   import type { IDatafeedChartApi, LibrarySymbolInfo, ... } from "@tradingview/charting_library";
 */

export type ResolutionString = string;

export interface DatafeedConfiguration {
  supported_resolutions: ResolutionString[];
  exchanges?: Array<{ value: string; name: string; desc: string }>;
  symbols_types?: Array<{ name: string; value: string }>;
}

export interface LibrarySymbolInfo {
  /** Short ticker, e.g. "BTCUSDT.P" */
  name: string;
  /** Full display name, e.g. "BTC/USDT Perpetual" */
  full_name: string;
  description: string;
  type: string;
  /** "24x7" for crypto perpetuals */
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: "price";
  /** 10^decimal_places, e.g. 100 for 2 decimal places */
  pricescale: number;
  minmov: number;
  volume_precision?: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly?: boolean;
  supported_resolutions: ResolutionString[];
  data_status?: "streaming" | "endofday" | "pulsed" | "delayed_streaming";
  /** Internal symbol key used in callbacks — same as name */
  ticker?: string;
}

/** A single OHLCV bar; `time` is Unix milliseconds. */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PeriodParams {
  /** Unix seconds */
  from: number;
  /** Unix seconds */
  to: number;
  countBack: number;
  firstDataRequest: boolean;
}

export type OnReadyCallback = (config: DatafeedConfiguration) => void;
export type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;
export type DatafeedErrorCallback = (reason: string) => void;
export type HistoryCallback = (
  bars: Bar[],
  meta: { noData: boolean; nextTime?: number },
) => void;
export type SubscribeBarsCallback = (bar: Bar) => void;

export interface SearchSymbolResultItem {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  type: string;
  ticker?: string;
}

export interface IDatafeedChartApi {
  onReady(callback: OnReadyCallback): void;
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (items: SearchSymbolResultItem[]) => void,
  ): void;
  resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    onError: DatafeedErrorCallback,
    extension?: unknown,
  ): void;
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: DatafeedErrorCallback,
  ): void;
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void,
  ): void;
  unsubscribeBars(subscriberUID: string): void;
}
