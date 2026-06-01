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

export interface ChartSeries {
  candles: CandlePoint[];
  ema20?: LinePoint[];
  ema50?: LinePoint[];
  ema200?: LinePoint[];
  volume?: VolumePoint[];
  rsi?: LinePoint[];
  macdData?: MacdPoint[];
  markers?: ChartMarker[];
}
