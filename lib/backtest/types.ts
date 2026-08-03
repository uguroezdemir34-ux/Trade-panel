/**
 * BACKTEST TYPES — Backtest engine ortak tipleri.
 */

import type { Pair } from "@/lib/constants/pairs";
import type { ScorerWeights, ScoreSubScores } from "@/lib/score/orchestrator";
import type { Regime } from "@/lib/score/scorers";
import type { AtrRegime } from "@/lib/indicators/atr-percentile";

export interface BacktestConfig {
  pair: Pair;
  /** Kaç aylık 1h+4h geçmişi kullanılsın */
  dataMonths: 3 | 6 | 12 | 24;
  /** Dondurulmuş F&G değeri (tarihi F&G verisi yok) */
  frozenFg: number;
  /** Minimum score filter — only enter if score >= this value (0 = no filter) */
  minScore?: number;
  /** Taker fee rate for both entry and exit. Default: 0.0005 (OKX Futures 0.05%) */
  takerFee?: number;
  /** Hourly funding rate cost as a fraction. Default: 0 (not modelled) */
  fundingRateHourly?: number;
  /**
   * Market order slippage as a fraction. Default 0 (no slippage model).
   * 0.001 = 0.1% — applied to entry; SL/timeout exits also slipped against direction.
   */
  slippagePct?: number;
  /**
   * Signal timeframe. Default "1h" — checks every 1h bar.
   * "4h" — only fires signals at 4h bar boundaries (first 1h of each new 4h candle).
   */
  signalTf?: "1h" | "4h";
  /**
   * Scorer ağırlıkları — null/undefined ise varsayılan (tümü 1.0) kullanılır.
   * Bu alan sayesinde farklı ağırlık konfigürasyonları backtest edilebilir.
   */
  scorerWeights?: ScorerWeights | null;
}

export interface BacktestTrade {
  pair: Pair;
  direction: "LONG" | "SHORT";
  entryTs: number;
  entryPrice: number;
  exitTs: number;
  exitPrice: number;
  exitReason: "tp1" | "tp2" | "sl" | "timeout";
  tp1Price: number;
  tp2Price: number;
  stopPrice: number;
  /** Raw score 0-100 at entry signal */
  score: number;
  /** (exitPrice - entryPrice) / stopDistance × direction */
  rMultiple: number;
  /** pnl as % of entry price × direction */
  pnlPct: number;
  barsHeld: number;
  /** Round-trip fees + funding cost as % of entry price (always positive) */
  feesPct?: number;
  /** pnlPct minus feesPct — undefined for results cached before fee model was added */
  netPnlPct?: number;
  /** Sinyal anındaki rejim — undefined for results cached before this field was added */
  regime?: Regime;
  /** Sinyal anındaki 8 kategori HAM (ağırlıksız) skor — ScoreResult.sub ile aynı şekil */
  subScores?: ScoreSubScores;
  /** total'e giren modifier'lar — pooled trade-level analiz için (bkz. exportPooledResults) */
  oiBonus?: number;
  srModifier?: number;
  regimeBonus?: number;
  sweepBonus?: number;
  /** Bu trade'in tetiklendiği an, kaçıncı ardışık GO barıydı (1 = ilk bar, taze sinyal) — "geç giriş" hipotezi testi için */
  consecutiveGoBars?: number;
  /** Son ≤6 bar'ın ham skoru, entry bar dahil, eski→yeni sıralı — slope/velocity analizi için */
  scoreHistory?: number[];
  /** Giriş anındaki ATR percentile (0-100) — atrPercentile(), volatilite-patlaması hipotezi testi için */
  atrPercentile?: number | null;
  /** Giriş anındaki ATR rejimi — compression/normal/expansion/extreme_expansion */
  atrRegime?: AtrRegime | null;
  /** current ATR / son 20 bar ATR ortalaması */
  atrRatio?: number | null;
}

export interface ScoreBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  winCount: number;
  winRate: number | null;
  avgR: number | null;
}

export interface DirectionStats {
  count: number;
  winCount: number;
  winRate: number | null;
}

export interface BacktestStats {
  totalTrades: number;
  winCount: number;
  loseCount: number;
  winRate: number;
  avgRMultiple: number | null;
  /** Maximum peak-to-trough R drawdown across sequential trades */
  maxDrawdownR: number;
  /** Longest consecutive win run */
  maxWinStreak: number;
  /** Longest consecutive loss run */
  maxLossStreak: number;
  /** Gross wins / gross losses (R) — null if no losses */
  profitFactor: number | null;
  /** mean(R)/std(R) — null when < 5 trades */
  sharpe: number | null;
  /** mean(R)/downside_std(R) — null when < 5 trades */
  sortino: number | null;
  byScoreBucket: ScoreBucket[];
  byDirection: { LONG: DirectionStats; SHORT: DirectionStats };
}

export interface BacktestResult {
  pair: Pair;
  trades: BacktestTrade[];
  stats: BacktestStats;
  runAt: number;
  dataMonths: number;
  totalBarsScanned: number;
  /** Hangi ağırlıklarla çalıştırıldı — null ise varsayılan */
  scorerWeights?: ScorerWeights | null;
}

// ── Walk-Forward Optimization ─────────────────────────────────────────────

export interface WFOWindow {
  windowIdx: number;
  /** Start epoch ms of this window */
  windowStart: number;
  /** End epoch ms of this window */
  windowEnd: number;
  /** Best minScore found on in-sample trades */
  bestMinScore: number;
  /** EV (R) of best minScore on in-sample period */
  isEv: number | null;
  /** Number of trades used in IS evaluation */
  isTradeCount: number;
  /** EV (R) of best minScore applied to out-of-sample period */
  oosEv: number | null;
  /** Win rate % on OOS */
  oosWinRate: number | null;
  /** Number of OOS trades */
  oosTradeCount: number;
  /** (IS_EV - OOS_EV) / |IS_EV| — positive = degraded, negative = improved */
  degradation: number | null;
}

export interface WFOResult {
  windows: WFOWindow[];
  /** Mean degradation across windows with valid IS EV > 0 */
  avgDegradation: number | null;
  /** Summary judgment */
  conclusion: "robust" | "overfit" | "insufficient";
}

// ── Temporal Consistency (Score × Time Heatmap) ───────────────────────────

export interface HeatmapCell {
  n: number;
  ev: number | null;
  winRate: number | null;
}

export interface TemporalConsistencyResult {
  minScores: number[];
  periodLabels: string[];
  grid: HeatmapCell[][];  // grid[scoreIdx][periodIdx]
}
