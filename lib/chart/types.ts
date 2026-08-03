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

/**
 * Skorun gerçekten kullandığı S/R kaynakları (bkz. lib/sr/detect.ts
 * detectSRLevels — SrLevelType ile BİREBİR aynı string'ler) + "swing_15m":
 * detectSRLevels 15m'yi hiç kapsamıyor, bu grafik-only bir katman (gerçek
 * 15m mumlardan findAllSwingHighs/Lows, bkz. lib/hooks/useChartSrLevels.ts).
 */
export type SrLevelSource =
  | "pivot_4h_high"
  | "pivot_4h_low"
  | "pivot_1h_high"
  | "pivot_1h_low"
  | "PDH"
  | "PDL"
  | "PWH"
  | "PWL"
  | "ROUND"
  | "swing_15m";

export interface SrLevel {
  price: number;
  type: "support" | "resistance";
  source: SrLevelSource;
}

export interface LiqBand {
  id: string;
  price: number;
  side: "long" | "short";
  intensity: number;
}

export interface TradeLevelLine {
  price: number;
  kind: "entry" | "sl" | "tp1" | "tp2";
  direction: "LONG" | "SHORT";
  /** Grafik çizgisi başlığı — kaynak borsa etiketi için (ör. "BNB Entry") */
  label?: string;
}

export interface DrawnLine {
  id: string;
  price: number;
  color: string;
  label?: string;
}

export interface TrendLine {
  id: string;
  p1: { time: number; price: number };
  p2: { time: number; price: number };
  color: string;
}

export interface FibLevel {
  id: string;
  p1Price: number;
  p2Price: number;
  color: string;
}

export interface RayLine {
  id: string;
  price: number;
  color: string;
  label?: string;
}

export interface ExtendedLine {
  id: string;
  p1: { time: number; price: number };
  p2: { time: number; price: number };
  color: string;
}

export interface ParallelChannel {
  id: string;
  p1: { time: number; price: number };
  p2: { time: number; price: number };
  offset: number;
  color: string;
}

export interface FibExtension {
  id: string;
  p1Price: number;
  p2Price: number;
  color: string;
}

export interface VerticalLine {
  id: string;
  time: number;
  color?: string;
}

export interface CrossLine {
  id: string;
  time: number;
  price: number;
  color?: string;
}

export interface FibTimeZone {
  id: string;
  time0: number;
  time1: number;
  color?: string;
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
  liqBands?: LiqBand[];
  tradeLevels?: TradeLevelLine[];
  drawnLines?: DrawnLine[];
  trendLines?: TrendLine[];
  fibLevels?: FibLevel[];
  rayLines?: RayLine[];
  extLines?: ExtendedLine[];
  channels?: ParallelChannel[];
  fibExtensions?: FibExtension[];
  verticalLines?: VerticalLine[];
  crossLines?: CrossLine[];
  fibTimeZones?: FibTimeZone[];
}
