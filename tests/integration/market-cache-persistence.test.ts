/**
 * MARKET UTILS + MACRO CACHE + PREFLIGHT TESTS
 *
 * classifyFundingRate: 5 tier, tüm boundary değerleri (0.01%/0.005% eşikleri)
 *
 * interpretOiPriceAction: 5 senaryo (strong_up/weak_up/strong_down/weak_down/neutral),
 *   threshold boundary değerleri
 * describeOiSignal: 5 sinyal için label/tone doğrulaması
 *
 * cacheGet/cacheSet: TTL geçmemiş→değer, TTL geçmiş→null, key yok→null
 * cacheClear: tüm kayıtları siler
 * cacheSize: boyut takibi
 *
 * runPreflightChecks: 4 kontrol sırası, tüm fail kararları, passed=true
 *
 * (Trail persistence testleri — trailKey/migrateOldTrailKey/saveTrails/
 * loadTrails — kaldırıldı: otomatik trailing yönetimi kalıcı olarak
 * çıkarıldı, bkz. ROADMAP.md Adım 3.)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { classifyFundingRate } from "@/lib/market/fundingRate";
import {
  interpretOiPriceAction,
  describeOiSignal,
} from "@/lib/market/openInterest";
import {
  cacheGet,
  cacheSet,
  cacheClear,
  cacheSize,
} from "@/lib/macro/cache";
import {
  runPreflightChecks,
} from "@/lib/orchestrator/preflight";
import type { OrchestrateInput, AccountStateSnapshot } from "@/lib/orchestrator/types";
import type { ScoreResult } from "@/lib/score/orchestrator";

// ─────────────────────────────────────────────────────────────
// classifyFundingRate
// ─────────────────────────────────────────────────────────────

describe("classifyFundingRate()", () => {
  it(">= 0.05% → extreme_long", () => {
    expect(classifyFundingRate(0.0005)).toBe("extreme_long");  // tam eşik
    expect(classifyFundingRate(0.001)).toBe("extreme_long");   // üstü
  });

  it("0.02–0.05% → elevated_long", () => {
    expect(classifyFundingRate(0.0002)).toBe("elevated_long"); // tam alt eşik
    expect(classifyFundingRate(0.0003)).toBe("elevated_long");
  });

  it("-0.02% to +0.02% → neutral", () => {
    expect(classifyFundingRate(0)).toBe("neutral");
    expect(classifyFundingRate(0.0001)).toBe("neutral");       // eski extreme_long, artık neutral
    expect(classifyFundingRate(0.00005)).toBe("neutral");      // eski elevated_long, artık neutral
    expect(classifyFundingRate(0.00008)).toBe("neutral");
    expect(classifyFundingRate(-0.00005)).toBe("neutral");     // eski elevated_short, artık neutral
    expect(classifyFundingRate(-0.00008)).toBe("neutral");
    expect(classifyFundingRate(-0.0001)).toBe("neutral");      // eski extreme_short, artık neutral
  });

  it("-0.02% to -0.05% → elevated_short", () => {
    expect(classifyFundingRate(-0.0002)).toBe("elevated_short"); // tam alt eşik
    expect(classifyFundingRate(-0.0003)).toBe("elevated_short");
  });

  it("<= -0.05% → extreme_short", () => {
    expect(classifyFundingRate(-0.0005)).toBe("extreme_short");  // tam eşik
    expect(classifyFundingRate(-0.001)).toBe("extreme_short");
  });

  it("tam eşik = 0.0005 → extreme_long (>= koşulu)", () => {
    expect(classifyFundingRate(0.0005)).toBe("extreme_long");
  });

  it("tam eşik = 0.0002 → elevated_long", () => {
    expect(classifyFundingRate(0.0002)).toBe("elevated_long");
  });
});

// ─────────────────────────────────────────────────────────────
// interpretOiPriceAction
// ─────────────────────────────────────────────────────────────

describe("interpretOiPriceAction()", () => {
  it("fiyat yukarı + OI yukarı → strong_up", () => {
    expect(interpretOiPriceAction(0.5, 0.5)).toBe("strong_up");
  });

  it("fiyat yukarı + OI aşağı → weak_up (short squeeze)", () => {
    expect(interpretOiPriceAction(0.5, -0.5)).toBe("weak_up");
  });

  it("fiyat aşağı + OI yukarı → strong_down", () => {
    expect(interpretOiPriceAction(-0.5, 0.5)).toBe("strong_down");
  });

  it("fiyat aşağı + OI aşağı → weak_down (long kapanışı)", () => {
    expect(interpretOiPriceAction(-0.5, -0.5)).toBe("weak_down");
  });

  it("küçük değişim → neutral", () => {
    expect(interpretOiPriceAction(0.05, 0.1)).toBe("neutral");
  });

  it("fiyat threshold = 0.1% (eşit) → değişim anlamlı değil", () => {
    // priceUp = priceChangePct > 0.1 → 0.1 > 0.1 = false → neutral
    expect(interpretOiPriceAction(0.1, 0.5)).toBe("neutral");
  });

  it("OI threshold = 0.2% (eşit) → OI anlamlı değil", () => {
    // oiUp = oiChangePct > 0.2 → 0.2 > 0.2 = false
    expect(interpretOiPriceAction(0.5, 0.2)).toBe("neutral");
  });
});

describe("describeOiSignal()", () => {
  it("strong_up → bull", () => {
    const r = describeOiSignal("strong_up");
    expect(r.tone).toBe("bull");
    expect(r.label.length).toBeGreaterThan(0);
  });

  it("weak_up → neutral tone", () => {
    expect(describeOiSignal("weak_up").tone).toBe("neutral");
  });

  it("strong_down → bear", () => {
    expect(describeOiSignal("strong_down").tone).toBe("bear");
  });

  it("weak_down → neutral tone", () => {
    expect(describeOiSignal("weak_down").tone).toBe("neutral");
  });

  it("neutral → neutral tone", () => {
    expect(describeOiSignal("neutral").tone).toBe("neutral");
  });
});

// ─────────────────────────────────────────────────────────────
// Macro cache
// ─────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

describe("macro cache", () => {
  beforeEach(() => cacheClear());

  it("key yok → null", () => {
    expect(cacheGet("x", NOW)).toBeNull();
  });

  it("set → get döner", () => {
    cacheSet("k", { data: 42 }, NOW, 60_000);
    expect(cacheGet("k", NOW)).toEqual({ data: 42 });
  });

  it("TTL geçti → null, key silinir", () => {
    cacheSet("k", "val", NOW, 1000);
    expect(cacheGet("k", NOW + 1001)).toBeNull();
    expect(cacheSize()).toBe(0);
  });

  it("TTL tam eşit → null (expiresAt <= now)", () => {
    cacheSet("k", "val", NOW, 1000);
    // expiresAt = NOW + 1000; now = NOW + 1000 → now <= expiresAt → süresi dolmuş
    expect(cacheGet("k", NOW + 1000)).toBeNull();
  });

  it("TTL geçmedi → değer döner", () => {
    cacheSet("k", "val", NOW, 10_000);
    expect(cacheGet("k", NOW + 5_000)).toBe("val");
  });

  it("cacheClear → tüm kayıtlar silinir", () => {
    cacheSet("a", 1, NOW, 60_000);
    cacheSet("b", 2, NOW, 60_000);
    cacheClear();
    expect(cacheSize()).toBe(0);
    expect(cacheGet("a", NOW)).toBeNull();
  });

  it("cacheSize → doğru boyut", () => {
    expect(cacheSize()).toBe(0);
    cacheSet("a", 1, NOW, 60_000);
    expect(cacheSize()).toBe(1);
    cacheSet("b", 2, NOW, 60_000);
    expect(cacheSize()).toBe(2);
  });

  it("aynı key üzerine yazma → güncellenir", () => {
    cacheSet("k", "old", NOW, 60_000);
    cacheSet("k", "new", NOW, 60_000);
    expect(cacheGet("k", NOW)).toBe("new");
    expect(cacheSize()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// runPreflightChecks
// ─────────────────────────────────────────────────────────────

const BASE_NOW = 1_700_000_000_000;

function makeSignal(verdict: "go" | "wait" | "no" = "go"): ScoreResult {
  return { verdict, direction: "LONG", score: 82, total: 82, effectiveThreshold: 80 } as ScoreResult;
}

function makeAccount(overrides: Partial<AccountStateSnapshot> = {}): AccountStateSnapshot {
  return {
    drawdownProtocol: { tier: "normal", multiplier: 1, label: "Normal" },
    btcCooldownUntil: 0,
    btcSelfCooldownUntil: 0,
    todayTradeCount: 0,
    maxTradesPerDay: 2,
    ...overrides,
  };
}

function makeInput(overrides: Partial<OrchestrateInput> = {}): OrchestrateInput {
  return {
    signal: makeSignal("go"),
    pair: "BTC",
    livePrice: 50000,
    qty: 0.1,
    stopPrice: 49000,
    leverage: 10,
    marginMode: "isolated",
    source: "manual",
    accountState: makeAccount(),
    ...overrides,
  };
}

describe("runPreflightChecks()", () => {
  it("tüm kontroller geçer → passed=true, decision=executed", () => {
    const r = runPreflightChecks(makeInput(), BASE_NOW);
    expect(r.passed).toBe(true);
    expect(r.decision).toBe("executed");
  });

  it("verdict !== go → blocked_verdict", () => {
    const r = runPreflightChecks(makeInput({ signal: makeSignal("wait") }), BASE_NOW);
    expect(r.passed).toBe(false);
    expect(r.decision).toBe("blocked_verdict");
    expect(r.reasonHuman).toContain("wait");
  });

  it("verdict=no → blocked_verdict", () => {
    const r = runPreflightChecks(makeInput({ signal: makeSignal("no") }), BASE_NOW);
    expect(r.decision).toBe("blocked_verdict");
  });

  it("drawdown locked → blocked_drawdown", () => {
    const r = runPreflightChecks(
      makeInput({ accountState: makeAccount({ drawdownProtocol: { tier: "locked", multiplier: 0, label: "Kilitli" } }) }),
      BASE_NOW,
    );
    expect(r.decision).toBe("blocked_drawdown");
    expect(r.passed).toBe(false);
  });

  it("BTC cooldown aktif + alt pair → blocked_lock", () => {
    const r = runPreflightChecks(
      makeInput({
        pair: "ETH",
        accountState: makeAccount({ btcCooldownUntil: BASE_NOW + 60_000 }),
      }),
      BASE_NOW,
    );
    expect(r.decision).toBe("blocked_lock");
    expect(r.reasonHuman).toContain("ETH");
  });

  it("BTC cooldown aktif + BTC pair → geçer (BTC cooldown ETH için)", () => {
    const r = runPreflightChecks(
      makeInput({
        pair: "BTC",
        accountState: makeAccount({ btcCooldownUntil: BASE_NOW + 60_000 }),
      }),
      BASE_NOW,
    );
    // BTC cooldown sadece alt pair'leri etkiler → BTC geçer
    expect(r.passed).toBe(true);
  });

  it("BTC self cooldown aktif + BTC pair → blocked_lock", () => {
    const r = runPreflightChecks(
      makeInput({
        pair: "BTC",
        accountState: makeAccount({ btcSelfCooldownUntil: BASE_NOW + 30_000 }),
      }),
      BASE_NOW,
    );
    expect(r.decision).toBe("blocked_lock");
  });

  it("todayTradeCount >= maxTradesPerDay → blocked_daily_limit", () => {
    const r = runPreflightChecks(
      makeInput({ accountState: makeAccount({ todayTradeCount: 2, maxTradesPerDay: 2 }) }),
      BASE_NOW,
    );
    expect(r.decision).toBe("blocked_daily_limit");
    expect(r.reasonHuman).toContain("2/2");
  });

  it("sıralama: verdict en önce (verdict fail + drawdown locked → verdict kazanır)", () => {
    const r = runPreflightChecks(
      makeInput({
        signal: makeSignal("wait"),
        accountState: makeAccount({ drawdownProtocol: { tier: "locked", multiplier: 0, label: "Kilitli" } }),
      }),
      BASE_NOW,
    );
    expect(r.decision).toBe("blocked_verdict");
  });

  it("sıralama: drawdown önce verdict'ten sonra (verdict go + locked → blocked_drawdown)", () => {
    const r = runPreflightChecks(
      makeInput({
        accountState: makeAccount({
          drawdownProtocol: { tier: "locked", multiplier: 0, label: "Kilitli" },
          btcCooldownUntil: BASE_NOW + 60_000,
        }),
        pair: "ETH",
      }),
      BASE_NOW,
    );
    expect(r.decision).toBe("blocked_drawdown");
  });
});
