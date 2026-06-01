/**
 * BACKTEST TYPES — Backtest engine ortak tipleri.
 */

import type { Pair } from "@/lib/constants/pairs";

export interface BacktestConfig {
  pair: Pair;
  /** Kaç aylık 1h+4h geçmişi kullanılsın */
  dataMonths: 6 | 12;
  /** Dondurulmuş F&G değeri (tarihi F&G verisi yok) */
  frozenFg: number;
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
}
