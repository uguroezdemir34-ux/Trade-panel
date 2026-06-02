export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LinePoint {
  time: number;
  value: number;
}

export interface ChartMarker {
  time: number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text?: string;
}

export interface VolumePoint {
  time: number;
  value: number;
  color: string;
}

export interface MacdPoint {
  time: number;
  hist: number;
  macd: number;
  signal: number;
}

export interface BbBands {
  upper: LinePoint[];
  middle: LinePoint[];
  lower: LinePoint[];
}

export interface AlarmLevel {
  price: number;
  condition: "above" | "below";
  label?: string;
}

export interface VwapBands {
  vwap: LinePoint[];
  upper: LinePoint[];
  lower: LinePoint[];
}

export interface SrLevel {
  price: number;
  type: "support" | "resistance";
}

export interface TradeLevelLine {
  price: number;
  kind: "entry" | "sl" | "tp1" | "tp2";
  direction: "LONG" | "SHORT";
}

export interface ChartSeries {
  candles: CandlePoint[];
  ema20?: LinePoint[];
  ema50?: LinePoint[];
  ema200?: LinePoint[];
  volume?: VolumePoint[];
  rsi?: LinePoint[];
  macdData?: MacdPoint[];
  bb?: BbBands;
  vwap?: VwapBands;
  alarmLevels?: AlarmLevel[];
  markers?: ChartMarker[];
  srLevels?: SrLevel[];
  tradeLevels?: TradeLevelLine[];
  /** Canlı fiyat — grafik üzerinde mavi kesikli "LIVE" çizgisi */
  currentPrice?: number;
}
