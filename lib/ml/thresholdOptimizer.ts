/**
 * THRESHOLD OPTIMIZER — Backtest verisiyle optimal GO eşiğini bulur.
 *
 * Algoritma: Her potansiyel eşik için (50–90, 2'şer adım)
 *   - Bu eşiği geçen trade'leri filtrele
 *   - Win rate, avg R, EV (expected value %) hesapla
 *   - En yüksek EV'yi veren eşiği "optimal" olarak döndür
 *
 * Minimum 10 trade şartı: çok az trade'li eşiklerde optimizasyon
 * istatistiksel olarak güvenilmez (overfitting riski).
 *
 * Skor motoru değişmez — bu bir analiz aracıdır.
 */

import type { BacktestTrade } from "@/lib/backtest/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThresholdPoint {
  threshold: number;
  tradeCount: number;
  winRate: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  evR: number | null; // R-çarpanı cinsinden beklenti değeri
  ev: number | null;  // Net PnL% cinsinden beklenti değeri
}

export interface ThresholdOptimizationResult {
  /** 50'den 90'a (2'şer adım) tüm eşik noktaları */
  curve: ThresholdPoint[];
  /** En yüksek EV'yi veren eşik (min 10 trade şartı) */
  optimal: ThresholdPoint | null;
  /** Mevcut eşiğe karşılık gelen nokta */
  currentPoint: ThresholdPoint | null;
  totalTrades: number;
}

// ─── Minimum trades for reliability ──────────────────────────────────────────

const MIN_TRADES_FOR_OPTIMAL = 10;

// ─── Main function ────────────────────────────────────────────────────────────

export function optimizeThreshold(
  trades: BacktestTrade[],
  currentThreshold = 70,
): ThresholdOptimizationResult {
  const curve: ThresholdPoint[] = [];

  for (let threshold = 50; threshold <= 90; threshold += 2) {
    curve.push(computePoint(trades, threshold));
  }

  const validForOptimal = curve.filter(
    (p) => p.evR !== null && p.tradeCount >= MIN_TRADES_FOR_OPTIMAL,
  );
  const optimal =
    validForOptimal.length > 0
      ? validForOptimal.reduce((best, p) =>
          (p.evR ?? -Infinity) > (best.evR ?? -Infinity) ? p : best,
        )
      : null;

  // Current threshold point: exact match or nearest even number
  const snapped = currentThreshold % 2 === 0
    ? currentThreshold
    : currentThreshold - 1;
  const currentPoint =
    curve.find((p) => p.threshold === snapped) ??
    curve.find((p) => Math.abs(p.threshold - currentThreshold) <= 1) ??
    null;

  return { curve, optimal, currentPoint, totalTrades: trades.length };
}

function computePoint(trades: BacktestTrade[], threshold: number): ThresholdPoint {
  const filtered = trades.filter((t) => t.score >= threshold);
  if (filtered.length === 0) {
    return { threshold, tradeCount: 0, winRate: null, avgWinR: null, avgLossR: null, evR: null, ev: null };
  }

  const wins   = filtered.filter((t) => t.rMultiple > 0);
  const losses = filtered.filter((t) => t.rMultiple <= 0);
  const winRate  = wins.length / filtered.length;
  const lossRate = losses.length / filtered.length;

  const avgWinR =
    wins.length > 0
      ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length
      : 0;
  const avgLossR =
    losses.length > 0
      ? losses.reduce((s, t) => s + Math.abs(t.rMultiple), 0) / losses.length
      : 0;
  const evR = winRate * avgWinR - lossRate * avgLossR;

  // Net PnL% based EV (use netPnlPct if available, else pnlPct)
  const pnlGetter = (t: BacktestTrade) => t.netPnlPct ?? t.pnlPct;
  const winPnls  = wins.map(pnlGetter);
  const lossPnls = losses.map(pnlGetter).map(Math.abs);
  const avgWinPnl  = winPnls.length > 0  ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0;
  const avgLossPnl = lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0;
  const ev = winRate * avgWinPnl - lossRate * avgLossPnl;

  return {
    threshold,
    tradeCount: filtered.length,
    winRate,
    avgWinR,
    avgLossR,
    evR,
    ev,
  };
}
