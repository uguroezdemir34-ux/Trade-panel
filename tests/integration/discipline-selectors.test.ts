/**
 * DISCIPLINE SELECTORS TESTS
 *
 * computePerformance:
 *   - boş dizi → winRate 0, bestTrade null, avgRMultiple null
 *   - 1 kazanan + 1 kaybeden → winRate 0.5, totalPnlUsd doğru
 *   - rMultiple karışık → sadece dolu olanların ortalaması; hiç yoksa null
 *
 * computeDiscipline:
 *   - boş dizi → manualExitRate 0, avgScoreWin null, avgScoreLoss null
 *   - karışık reason'lar → exitReasonBreakdown sayıları doğru
 *   - kazanan/kaybeden score ayrımı → avgScoreWin / avgScoreLoss
 *
 * filterByDateRange:
 *   - sinceMs undefined → tüm dizi
 *   - sinceMs null (cast) → tüm dizi
 *   - geçmiş eşik → sadece yeni trade'ler
 *   - gelecek eşik → boş dizi
 */

import { describe, it, expect } from "vitest";
import {
  computePerformance,
  computeDiscipline,
  filterByDateRange,
} from "@/lib/trades/selectors";
import type { TradeSnapshot, ExitReason, ExitInfo } from "@/lib/trades/types";

// ─── Helper ──────────────────────────────────────────────────

const NOW = 1_720_000_000_000;

function makeTrade(
  pnlUsd: number,
  reason: ExitReason,
  score: number,
  openedAt: number,
  rMultiple?: number,
): TradeSnapshot {
  const exit: ExitInfo = {
    closedAt: openedAt + 3_600_000,
    exitPrice: 51_000,
    reason,
    pnlUsd,
    pnlPct: pnlUsd / (50_000 * 0.01),
    holdingSec: 3_600,
  };
  if (rMultiple !== undefined) exit.rMultiple = rMultiple;

  return {
    id: `trade_${openedAt}_${reason}`,
    pair: "BTC",
    direction: "LONG",
    status: "closed",
    openedAt,
    entryPrice: 50_000,
    qty: 0.01,
    leverage: 1,
    stopPrice: 49_000,
    riskAmountUsd: 10,
    entryContext: {
      score,
      verdict: "go",
    },
    exit,
  };
}

// ─── computePerformance ──────────────────────────────────────

describe("computePerformance()", () => {
  it("boş dizi → tüm alanlar sıfır/null, NaN yok", () => {
    const r = computePerformance([]);
    expect(r.tradeCount).toBe(0);
    expect(r.winRate).toBe(0);
    expect(r.winRate).not.toBeNaN();
    expect(r.totalPnlUsd).toBe(0);
    expect(r.avgRMultiple).toBeNull();
    expect(r.bestTrade).toBeNull();
    expect(r.worstTrade).toBeNull();
    expect(r.avgHoldingSec).toBe(0);
  });

  it("1 kazanan + 1 kaybeden → winRate 0.5, totalPnlUsd doğru", () => {
    const trades = [
      makeTrade(+100, "tp1", 75, NOW),
      makeTrade(-40, "sl", 60, NOW + 1),
    ];
    const r = computePerformance(trades);
    expect(r.tradeCount).toBe(2);
    expect(r.winCount).toBe(1);
    expect(r.lossCount).toBe(1);
    expect(r.winRate).toBe(0.5);
    expect(r.totalPnlUsd).toBeCloseTo(60);
    expect(r.bestTrade?.pnlUsd).toBe(100);
    expect(r.worstTrade?.pnlUsd).toBe(-40);
  });

  it("rMultiple karışık: sadece dolu olanların ortalaması", () => {
    const trades = [
      makeTrade(+100, "tp1", 70, NOW, 2.5),
      makeTrade(-40, "sl", 65, NOW + 1),      // rMultiple yok
      makeTrade(+60, "tp2", 72, NOW + 2, 1.5),
    ];
    const r = computePerformance(trades);
    expect(r.avgRMultiple).toBeCloseTo((2.5 + 1.5) / 2);
  });

  it("hiçbir trade'de rMultiple yok → avgRMultiple null", () => {
    const trades = [
      makeTrade(+50, "tp1", 70, NOW),
      makeTrade(-20, "sl", 60, NOW + 1),
    ];
    const r = computePerformance(trades);
    expect(r.avgRMultiple).toBeNull();
  });
});

// ─── computeDiscipline ───────────────────────────────────────

describe("computeDiscipline()", () => {
  it("boş dizi → manualExitRate 0, score correlation null, NaN yok", () => {
    const r = computeDiscipline([]);
    expect(r.manualExitRate).toBe(0);
    expect(r.manualExitRate).not.toBeNaN();
    expect(r.equityHaltCount).toBe(0);
    expect(r.scoreOutcomeCorrelation.avgScoreWin).toBeNull();
    expect(r.scoreOutcomeCorrelation.avgScoreLoss).toBeNull();
  });

  it("karışık reason'lar → exitReasonBreakdown sayıları doğru", () => {
    const trades = [
      makeTrade(+80, "tp1", 70, NOW),
      makeTrade(+60, "tp1", 72, NOW + 1),
      makeTrade(-30, "sl", 55, NOW + 2),
      makeTrade(+10, "manual", 65, NOW + 3),
    ];
    const r = computeDiscipline(trades);
    expect(r.exitReasonBreakdown.tp1).toBe(2);
    expect(r.exitReasonBreakdown.sl).toBe(1);
    expect(r.exitReasonBreakdown.manual).toBe(1);
    expect(r.exitReasonBreakdown.tp2).toBe(0);
    expect(r.exitReasonBreakdown.trail).toBe(0);
    expect(r.exitReasonBreakdown.equity_halt).toBe(0);
    expect(r.manualExitRate).toBe(0.25);
  });

  it("kazanan score=80, kaybeden score=50 → avgScoreWin/Loss ayrı", () => {
    const trades = [
      makeTrade(+100, "tp1", 80, NOW),
      makeTrade(-40, "sl", 50, NOW + 1),
    ];
    const r = computeDiscipline(trades);
    expect(r.scoreOutcomeCorrelation.avgScoreWin).toBe(80);
    expect(r.scoreOutcomeCorrelation.avgScoreLoss).toBe(50);
  });

  it("equity_halt sayımı doğru", () => {
    const trades = [
      makeTrade(-50, "equity_halt", 40, NOW),
      makeTrade(-30, "equity_halt", 45, NOW + 1),
      makeTrade(+20, "tp1", 70, NOW + 2),
    ];
    const r = computeDiscipline(trades);
    expect(r.equityHaltCount).toBe(2);
  });
});

// ─── filterByDateRange ───────────────────────────────────────

describe("filterByDateRange()", () => {
  const trades = [
    makeTrade(+10, "tp1", 70, NOW - 10_000),
    makeTrade(+20, "tp1", 72, NOW - 5_000),
    makeTrade(+30, "tp2", 74, NOW + 5_000),
  ];

  it("sinceMs undefined → tüm dizi döner, kayıp yok", () => {
    const r = filterByDateRange(trades, undefined);
    expect(r.length).toBe(3);
  });

  it("sinceMs null (cast) → tüm dizi döner", () => {
    const r = filterByDateRange(trades, null as unknown as undefined);
    expect(r.length).toBe(3);
  });

  it("geçmiş eşik → sadece eşik ve sonrası trade'ler", () => {
    const r = filterByDateRange(trades, NOW - 5_000);
    expect(r.length).toBe(2);
    expect(r.every((t) => t.openedAt >= NOW - 5_000)).toBe(true);
  });

  it("gelecek eşik → boş dizi", () => {
    const r = filterByDateRange(trades, NOW + 999_999);
    expect(r.length).toBe(0);
  });
});
