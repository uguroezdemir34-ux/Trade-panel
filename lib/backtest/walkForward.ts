/**
 * WALK-FORWARD OPTIMIZATION — Rolling IS/OOS window analysis.
 *
 * Uses existing BacktestTrade[] (no additional engine runs).
 * Divides the trade history into N time windows, optimizes minScore
 * threshold on the in-sample (IS) portion, evaluates on out-of-sample (OOS).
 *
 * Limitation: can only test minScore >= the threshold used in the original
 * backtest run (lower-score trades were never captured).
 */

import type { BacktestTrade, WFOResult, WFOWindow } from "./types";

function tradeEv(trades: BacktestTrade[]): number | null {
  if (trades.length < 5) return null;
  const wins = trades.filter((t) => t.rMultiple > 0);
  const losses = trades.filter((t) => t.rMultiple <= 0);
  const wr = wins.length / trades.length;
  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length)
    : 0;
  return wr * avgWin - (1 - wr) * avgLoss;
}

function tradeWinRate(trades: BacktestTrade[]): number | null {
  if (trades.length === 0) return null;
  return (trades.filter((t) => t.rMultiple > 0).length / trades.length) * 100;
}

export function runWalkForward(
  trades: BacktestTrade[],
  minScoreCandidates: number[],
  nWindows: number,
  isSplit = 0.7,
): WFOResult {
  if (trades.length < 20 || minScoreCandidates.length === 0) {
    return { windows: [], avgDegradation: null, conclusion: "insufficient" };
  }

  const sorted = [...trades].sort((a, b) => a.entryTs - b.entryTs);
  const minTs = sorted[0].entryTs;
  const maxTs = sorted[sorted.length - 1].entryTs;
  const totalMs = maxTs - minTs;
  if (totalMs <= 0) return { windows: [], avgDegradation: null, conclusion: "insufficient" };

  const windowMs = totalMs / nWindows;
  const windows: WFOWindow[] = [];

  for (let w = 0; w < nWindows; w++) {
    const wStart = minTs + w * windowMs;
    const wEnd = wStart + windowMs;
    const isEnd = wStart + windowMs * isSplit;

    const isTrades = sorted.filter((t) => t.entryTs >= wStart && t.entryTs < isEnd);
    const oosTrades = sorted.filter((t) => t.entryTs >= isEnd && t.entryTs < wEnd);

    // Find best minScore on IS
    let bestMs = minScoreCandidates[0];
    let bestIsEv = -Infinity;

    for (const ms of minScoreCandidates) {
      const filtered = isTrades.filter((t) => t.score >= ms);
      const ev = tradeEv(filtered);
      if (ev !== null && ev > bestIsEv) {
        bestIsEv = ev;
        bestMs = ms;
      }
    }

    const bestIsTrades = isTrades.filter((t) => t.score >= bestMs);
    const oosFiltered = oosTrades.filter((t) => t.score >= bestMs);
    const oosEv = tradeEv(oosFiltered);
    const oosWr = tradeWinRate(oosFiltered);

    const isEv = bestIsEv === -Infinity ? null : bestIsEv;
    const degradation =
      isEv !== null && isEv > 0 && oosEv !== null
        ? (isEv - oosEv) / Math.abs(isEv)
        : null;

    windows.push({
      windowIdx: w + 1,
      windowStart: wStart,
      windowEnd: wEnd,
      bestMinScore: bestMs,
      isEv,
      isTradeCount: bestIsTrades.length,
      oosEv,
      oosWinRate: oosWr,
      oosTradeCount: oosFiltered.length,
      degradation,
    });
  }

  const validDeg = windows
    .map((w) => w.degradation)
    .filter((d): d is number => d !== null);
  const avgDegradation =
    validDeg.length > 0
      ? validDeg.reduce((a, b) => a + b, 0) / validDeg.length
      : null;

  const hasEnoughOos = windows.some((w) => w.oosTradeCount >= 5);
  const conclusion: WFOResult["conclusion"] = !hasEnoughOos
    ? "insufficient"
    : avgDegradation !== null && avgDegradation > 0.5
    ? "overfit"
    : "robust";

  return { windows, avgDegradation, conclusion };
}
