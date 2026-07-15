/**
 * RECONCILE ORPHAN IMPORT — tradesStore.importOrphanTrade()/importOrphanTrades()
 * regresyon testleri (henüz commit edilmemiş özellik).
 *
 * Kapsam:
 *   - Idempotency: aynı orphan listesi iki kez importOrphanTrades'e verilirse
 *     ikinci çağrı hiçbir yeni trade eklemez (count===0, trades.length sabit).
 *   - pair/direction null olan orphan içe aktarılamaz (null döner).
 *   - entryPrice/pnlPct geriye türetimi LONG ve SHORT için ayrı ayrı, elle
 *     hesaplanmış beklenen değerlerle doğrulanır.
 *   - computeCalibrationStats(): reconcile-import trade'ler scoreBuckets'tan
 *     hariç, directionStats/pairStats/totalTrades'e dahil.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useTradesStore } from "@/lib/store/tradesStore";
import { computeCalibrationStats } from "@/lib/pnl/calibration";
import type { ReconcileOrphan } from "@/lib/reconcile/reconciler";

const NOW = 1_700_000_000_000;

function makeOrphan(overrides: Partial<ReconcileOrphan> = {}): ReconcileOrphan {
  return {
    ordId: "okx_ord_1",
    pair: "BTC",
    direction: "LONG",
    pnlUsd: 500,
    feeUsd: 2.5,
    avgPx: 52000,
    filledAtMs: NOW,
    sz: 0.5,
    ...overrides,
  };
}

beforeEach(() => {
  useTradesStore.getState()._reset();
});

describe("importOrphanTrade() / importOrphanTrades() — idempotency", () => {
  it("aynı orphan listesi İKİNCİ kez verildiğinde hiçbir yeni trade eklenmez", () => {
    const orphans = [
      makeOrphan({ ordId: "ord_a", pair: "BTC" }),
      makeOrphan({ ordId: "ord_b", pair: "ETH", direction: "SHORT" }),
    ];

    const firstCount = useTradesStore.getState().importOrphanTrades(orphans);
    expect(firstCount).toBe(2);
    expect(useTradesStore.getState().trades.length).toBe(2);

    const secondCount = useTradesStore.getState().importOrphanTrades(orphans);
    expect(secondCount).toBe(0);
    expect(useTradesStore.getState().trades.length).toBe(2); // ikiye katlanmadı
  });

  it("aynı orphan'ı importOrphanTrade ile iki kez çağırmak ikinci seferde null döner", () => {
    const orphan = makeOrphan({ ordId: "ord_dup" });
    const first = useTradesStore.getState().importOrphanTrade(orphan);
    expect(first).not.toBeNull();
    expect(useTradesStore.getState().trades.length).toBe(1);

    const second = useTradesStore.getState().importOrphanTrade(orphan);
    expect(second).toBeNull();
    expect(useTradesStore.getState().trades.length).toBe(1); // tekrar eklenmedi
  });

  it("aynı batch İÇİNDE (tek importOrphanTrades çağrısında) tekrarlanan ordId sadece bir kez eklenir", () => {
    const orphans = [
      makeOrphan({ ordId: "ord_same" }),
      makeOrphan({ ordId: "ord_same" }), // aynı ordId, batch içi tekrar
    ];
    const count = useTradesStore.getState().importOrphanTrades(orphans);
    expect(count).toBe(1);
    expect(useTradesStore.getState().trades.length).toBe(1);
  });
});

describe("importOrphanTrade() — pair/direction null guard", () => {
  it("pair null ise içe aktarılmaz, null döner, store değişmez", () => {
    const orphan = makeOrphan({ pair: null });
    const result = useTradesStore.getState().importOrphanTrade(orphan);
    expect(result).toBeNull();
    expect(useTradesStore.getState().trades.length).toBe(0);
  });

  it("direction null ise içe aktarılmaz, null döner, store değişmez", () => {
    const orphan = makeOrphan({ direction: null });
    const result = useTradesStore.getState().importOrphanTrade(orphan);
    expect(result).toBeNull();
    expect(useTradesStore.getState().trades.length).toBe(0);
  });
});

describe("importOrphanTrade() — entryPrice/pnlPct geriye türetimi", () => {
  it("LONG: exitPrice=52000, sz=0.5, pnlUsd=500 → entryPrice=51000, pnlPct≈1.9608%", () => {
    const orphan = makeOrphan({
      ordId: "ord_long",
      pair: "BTC",
      direction: "LONG",
      avgPx: 52000,
      sz: 0.5,
      pnlUsd: 500,
    });
    const snap = useTradesStore.getState().importOrphanTrade(orphan);
    expect(snap).not.toBeNull();
    // Doğrulama: (exitPrice - entryPrice) * qty === pnlUsd olmalı (LONG)
    expect(snap!.entryPrice).toBeCloseTo(51000, 6);
    expect((orphan.avgPx - snap!.entryPrice) * orphan.sz).toBeCloseTo(orphan.pnlUsd, 6);
    expect(snap!.exit!.pnlPct).toBeCloseTo(1.9608, 3);
    expect(snap!.exit!.pnlUsd).toBe(500);
    expect(snap!.direction).toBe("LONG");
  });

  it("SHORT: exitPrice=48000, sz=1, pnlUsd=800 → entryPrice=48800, pnlPct≈1.6393%", () => {
    const orphan = makeOrphan({
      ordId: "ord_short",
      pair: "ETH",
      direction: "SHORT",
      avgPx: 48000,
      sz: 1,
      pnlUsd: 800,
    });
    const snap = useTradesStore.getState().importOrphanTrade(orphan);
    expect(snap).not.toBeNull();
    // Doğrulama: (entryPrice - exitPrice) * qty === pnlUsd olmalı (SHORT)
    expect(snap!.entryPrice).toBeCloseTo(48800, 6);
    expect((snap!.entryPrice - orphan.avgPx) * orphan.sz).toBeCloseTo(orphan.pnlUsd, 6);
    expect(snap!.exit!.pnlPct).toBeCloseTo(1.6393, 3);
    expect(snap!.exit!.pnlUsd).toBe(800);
    expect(snap!.direction).toBe("SHORT");
  });

  it("negatif pnlUsd (zararlı işlem) için de entryPrice doğru türetilir (LONG)", () => {
    const orphan = makeOrphan({
      ordId: "ord_long_loss",
      direction: "LONG",
      avgPx: 49000,
      sz: 0.2,
      pnlUsd: -100, // zarar
    });
    const snap = useTradesStore.getState().importOrphanTrade(orphan);
    // entryPrice = exitPrice - (pnlUsd/qty)*1 = 49000 - (-100/0.2) = 49000+500=49500
    expect(snap!.entryPrice).toBeCloseTo(49500, 6);
    expect((orphan.avgPx - snap!.entryPrice) * orphan.sz).toBeCloseTo(-100, 6);
    expect(snap!.exit!.pnlUsd).toBe(-100);
  });

  it("sentinel alanlar dürüstçe 'bilinmiyor' işaretli: holdingSec=0, rMultiple undefined, source='reconcile-import'", () => {
    const orphan = makeOrphan({ ordId: "ord_sentinel" });
    const snap = useTradesStore.getState().importOrphanTrade(orphan);
    expect(snap!.source).toBe("reconcile-import");
    expect(snap!.exit!.holdingSec).toBe(0);
    expect(snap!.exit!.rMultiple).toBeUndefined();
    expect(snap!.riskAmountUsd).toBe(0);
    expect(snap!.status).toBe("closed");
    expect(snap!.orderId).toBe(orphan.ordId); // orderId OKX ordId'sinden set edildi (dedup için)
    expect(snap!.entryContext.score).toBe(0);
    expect(snap!.entryContext.verdict).toBe("no");
  });
});

describe("computeCalibrationStats() — reconcile-import trade ayrımı", () => {
  it("reconcile-import trade scoreBuckets'tan hariç, ama directionStats/pairStats/totalTrades'e dahil", () => {
    // 1) Gerçek, skorlu bir trade (uygulama üzerinden açılmış gibi)
    const realTrade = useTradesStore.getState().openPending({
      pair: "BTC",
      direction: "LONG",
      entryPrice: 50000,
      qty: 0.1,
      leverage: 10,
      stopPrice: 49000,
      riskAmountUsd: 100,
      entryContext: { score: 88, verdict: "go" },
      now: NOW,
    });
    useTradesStore.getState().confirmTradeOpen(realTrade.id);
    useTradesStore.getState().closeTradeById({
      id: realTrade.id,
      exitPrice: 51000,
      reason: "tp1",
      now: NOW + 3_600_000,
    });

    // 2) reconcile-import trade (skor verisi yok)
    useTradesStore.getState().importOrphanTrade(
      makeOrphan({ ordId: "ord_import_1", pair: "ETH", direction: "SHORT" }),
    );

    const allTrades = useTradesStore.getState().trades;
    expect(allTrades.length).toBe(2);

    const stats = computeCalibrationStats(allTrades);

    // totalTrades HER İKİSİNİ de sayar
    expect(stats.totalTrades).toBe(2);
    expect(stats.noScoreDataCount).toBe(1);

    // scoreBuckets: SADECE gerçek skorlu trade sayılmalı (toplam=1)
    const scoreBucketTotal = stats.scoreBuckets.reduce((s, b) => s + b.tradeCount, 0);
    expect(scoreBucketTotal).toBe(1);
    const bucket8589 = stats.scoreBuckets.find((b) => b.label === "85–89");
    expect(bucket8589?.tradeCount).toBe(1); // 88 skoru bu kovaya düşüyor

    // directionStats: HER İKİSİ de sayılmalı (LONG=1 gerçek, SHORT=1 import)
    const longStats = stats.directionStats.find((d) => d.label === "LONG");
    const shortStats = stats.directionStats.find((d) => d.label === "SHORT");
    expect(longStats?.tradeCount).toBe(1);
    expect(shortStats?.tradeCount).toBe(1);

    // pairStats: BTC (gerçek) + ETH (import) ikisi de var
    const btcStats = stats.pairStats.find((p) => p.label === "BTC");
    const ethStats = stats.pairStats.find((p) => p.label === "ETH");
    expect(btcStats?.tradeCount).toBe(1);
    expect(ethStats?.tradeCount).toBe(1);
  });

  it("hiç reconcile-import trade yoksa noScoreDataCount=0, scoreBuckets toplamı totalTrades'e eşit", () => {
    const realTrade = useTradesStore.getState().openPending({
      pair: "BTC",
      direction: "LONG",
      entryPrice: 50000,
      qty: 0.1,
      leverage: 10,
      stopPrice: 49000,
      riskAmountUsd: 100,
      entryContext: { score: 82, verdict: "go" },
      now: NOW,
    });
    useTradesStore.getState().confirmTradeOpen(realTrade.id);
    useTradesStore.getState().closeTradeById({
      id: realTrade.id,
      exitPrice: 51000,
      reason: "tp1",
      now: NOW + 3_600_000,
    });

    const stats = computeCalibrationStats(useTradesStore.getState().trades);
    expect(stats.noScoreDataCount).toBe(0);
    const scoreBucketTotal = stats.scoreBuckets.reduce((s, b) => s + b.tradeCount, 0);
    expect(scoreBucketTotal).toBe(stats.totalTrades);
  });
});
