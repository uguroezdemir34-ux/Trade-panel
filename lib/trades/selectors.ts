/**
 * TRADE SELECTORS — Filtreleme + sıralama yardımcıları.
 *
 * Saf fonksiyonlar — UI ve store store'lardan çağrılır.
 */

import type { Pair } from "@/lib/constants/pairs";
import type { TradeSnapshot, TradeStatus, ExitReason } from "./types";

export function filterByStatus(
  trades: readonly TradeSnapshot[],
  status: TradeStatus,
): TradeSnapshot[] {
  return trades.filter((t) => t.status === status);
}

export function filterByPair(
  trades: readonly TradeSnapshot[],
  pair: Pair,
): TradeSnapshot[] {
  return trades.filter((t) => t.pair === pair);
}

export function filterOpen(trades: readonly TradeSnapshot[]): TradeSnapshot[] {
  return filterByStatus(trades, "open");
}

export function filterClosed(
  trades: readonly TradeSnapshot[],
): TradeSnapshot[] {
  return filterByStatus(trades, "closed");
}

/**
 * Sıralama: en yeni önce (entry timestamp desc).
 */
export function sortByOpenedDesc(
  trades: readonly TradeSnapshot[],
): TradeSnapshot[] {
  return [...trades].sort((a, b) => b.openedAt - a.openedAt);
}

/**
 * Son N trade (en yeni N tane).
 */
export function recentTrades(
  trades: readonly TradeSnapshot[],
  n: number,
): TradeSnapshot[] {
  return sortByOpenedDesc(trades).slice(0, n);
}

/**
 * Bugün açılmış trade sayısı (max-per-day kontrolü için).
 *
 * Default timezone: kullanıcının yerel saat dilimi.
 */
export function countTradesToday(
  trades: readonly TradeSnapshot[],
  now: number = Date.now(),
): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayStart = today.getTime();
  return trades.filter((t) => t.openedAt >= dayStart).length;
}

/**
 * Status'a göre breakdown — UI özet kartı için.
 */
export function statusBreakdown(
  trades: readonly TradeSnapshot[],
): Record<TradeStatus, number> {
  return {
    pending: trades.filter((t) => t.status === "pending").length,
    open: trades.filter((t) => t.status === "open").length,
    closed: trades.filter((t) => t.status === "closed").length,
  };
}

// ─── Aggregate selectors (disiplin paneli için) ──────────────

export interface PerformanceSummary {
  totalPnlUsd: number;
  totalPnlPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgRMultiple: number | null;
  avgHoldingSec: number;
  bestTrade: { pair: Pair; pnlUsd: number } | null;
  worstTrade: { pair: Pair; pnlUsd: number } | null;
}

export interface DisciplineSummary {
  manualExitRate: number;
  exitReasonBreakdown: Record<ExitReason, number>;
  equityHaltCount: number;
  scoreOutcomeCorrelation: {
    avgScoreWin: number | null;
    avgScoreLoss: number | null;
  };
}

/**
 * Performans metrikleri — kapanmış trade dizisi üzerinde çalışır.
 * Tarih filtrelemesi caller'da yapılır (filterByDateRange).
 */
export function computePerformance(
  closedTrades: readonly TradeSnapshot[],
): PerformanceSummary {
  const trades = closedTrades.filter((t) => t.exit !== undefined);

  if (trades.length === 0) {
    return {
      totalPnlUsd: 0,
      totalPnlPct: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      avgRMultiple: null,
      avgHoldingSec: 0,
      bestTrade: null,
      worstTrade: null,
    };
  }

  let totalPnlUsd = 0;
  let totalPnlPct = 0;
  let winCount = 0;
  let rMultipleSum = 0;
  let rMultipleCount = 0;
  let holdingSecSum = 0;
  let best: { pair: Pair; pnlUsd: number } | null = null;
  let worst: { pair: Pair; pnlUsd: number } | null = null;

  for (const t of trades) {
    const { pnlUsd, pnlPct, holdingSec, rMultiple } = t.exit!;

    totalPnlUsd += pnlUsd;
    totalPnlPct += pnlPct;
    holdingSecSum += holdingSec;

    if (pnlUsd > 0) winCount++;

    if (rMultiple !== undefined) {
      rMultipleSum += rMultiple;
      rMultipleCount++;
    }

    if (best === null || pnlUsd > best.pnlUsd) best = { pair: t.pair, pnlUsd };
    if (worst === null || pnlUsd < worst.pnlUsd) worst = { pair: t.pair, pnlUsd };
  }

  const tradeCount = trades.length;

  return {
    totalPnlUsd,
    totalPnlPct: totalPnlPct / tradeCount,
    tradeCount,
    winCount,
    lossCount: tradeCount - winCount,
    winRate: winCount / tradeCount,
    avgRMultiple: rMultipleCount > 0 ? rMultipleSum / rMultipleCount : null,
    avgHoldingSec: holdingSecSum / tradeCount,
    bestTrade: best,
    worstTrade: worst,
  };
}

/**
 * Disiplin metrikleri — kapanmış trade dizisi üzerinde çalışır.
 * Tarih filtrelemesi caller'da yapılır (filterByDateRange).
 */
export function computeDiscipline(
  closedTrades: readonly TradeSnapshot[],
): DisciplineSummary {
  const trades = closedTrades.filter((t) => t.exit !== undefined);

  const breakdown: Record<ExitReason, number> = {
    tp1: 0,
    tp2: 0,
    sl: 0,
    manual: 0,
    trail: 0,
    equity_halt: 0,
  };

  let manualCount = 0;
  let equityHaltCount = 0;
  let scoreWinSum = 0;
  let scoreWinCount = 0;
  let scoreLossSum = 0;
  let scoreLossCount = 0;

  for (const t of trades) {
    const reason = t.exit!.reason;
    breakdown[reason]++;
    if (reason === "manual") manualCount++;
    if (reason === "equity_halt") equityHaltCount++;

    const score = t.entryContext.score;
    if (t.exit!.pnlUsd > 0) {
      scoreWinSum += score;
      scoreWinCount++;
    } else {
      scoreLossSum += score;
      scoreLossCount++;
    }
  }

  const tradeCount = trades.length;

  return {
    manualExitRate: tradeCount > 0 ? manualCount / tradeCount : 0,
    exitReasonBreakdown: breakdown,
    equityHaltCount,
    scoreOutcomeCorrelation: {
      avgScoreWin: scoreWinCount > 0 ? scoreWinSum / scoreWinCount : null,
      avgScoreLoss: scoreLossCount > 0 ? scoreLossSum / scoreLossCount : null,
    },
  };
}

/**
 * Tarih aralığı filtresi — openedAt >= sinceMs olan trade'ler.
 * sinceMs undefined veya null ise tüm diziyi döndürür ("tüm zamanlar").
 * Tüm status'lara uygulanabilir; caller filterClosed ile zincirler.
 */
export function filterByDateRange(
  trades: readonly TradeSnapshot[],
  sinceMs?: number,
): TradeSnapshot[] {
  if (sinceMs == null) return [...trades];
  return trades.filter((t) => t.openedAt >= sinceMs);
}
