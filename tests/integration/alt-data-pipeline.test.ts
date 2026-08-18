/**
 * ALT DATA PIPELINE — Entegrasyon Testleri (Topic 9)
 *
 * Kapsam:
 *   1. OI Velocity Engine (lib/market/oi-velocity.ts) — boundary değer testleri
 *   2. Score Engine entegrasyonu — oiVelocityScore'un
 *      computeScore() içinde total'a doğru katkı yaptığını kanıtla
 *   3. composeScoreInput() geçişi — yeni alanlar ScoreInput'a aktarılıyor
 */

import { describe, it, expect } from "vitest";

// ── OI Velocity ───────────────────────────────────────────────
import {
  computeOiVelocity,
  computeOiVelocityWindow,
  oiVelocityScoreOrZero,
  type OiSnapshot,
  type OiVelocityConfig,
} from "@/lib/market/oi-velocity";

// ── Score Engine ──────────────────────────────────────────────
import { computeScore, type ScoreInput } from "@/lib/score/orchestrator";

// ── composeScoreInput ─────────────────────────────────────────
import {
  composeScoreInput,
  type ComposeInput,
} from "@/lib/score/composeScoreInput";

// ─────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────

/** Minimal geçerli OI snapshot çifti */
function makeOiPair(
  oiFirst: number,
  oiLast: number,
  priceFirst: number,
  priceLast: number,
): OiSnapshot[] {
  return [
    { timestamp: 1000, openInterest: oiFirst, price: priceFirst },
    { timestamp: 2000, openInterest: oiLast, price: priceLast },
  ];
}

/** Minimal ScoreInput — gerçek computeScore çağrısı için */
function makeMinimalScoreInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  const base: ScoreInput = {
    pair: "BTC",
    px: 50000,
    px4h: 50000,
    px15: 50000,
    ema21_15m: 50000,
    ema50_1h: 49000,
    ema200_1h: 45000,
    ema50_4h: 48000,
    ema200_4h: 44000,
    ema50_1d: 44000,
    rsi: 55,
    adx: 30,
    bbPct: 0.5,
    vwap: { vwap: 49000, stddev: 500 },
    volRatio: 1.2,
    fundingRate: 0.0001,
    fundingHistory: null,
    atrPercentile: 50,
    adx4h: 28,
    ema21_1h: 49500,
    closes1h: Array(12).fill(50000),
    volumes1h: Array(15).fill(1000),
    srModifier: 0,
    sweep15m: { type: null, strength: 0 },
    fg: 50,
    last4hMovePct: 0.5,
    timeQuality: { quality: 1, reason: "ok" },
    eventSkipUntil: null,
    btcCooldownUntil: null,
    btcCooldownReason: "",
    btcSelfCooldownUntil: null,
    lockReleasedAt: null,
    openPositions: [],
    drawdownProtocol: { tier: "normal", minScore: 80, label: "Normal", reason: "" },
    trades: [],
    now: 1_700_000_000_000,
  };
  return { ...base, ...overrides };
}

// ═══════════════════════════════════════════════════════════════
// OI VELOCITY TESTS
// ═══════════════════════════════════════════════════════════════

describe("OI Velocity Engine", () => {
  describe("computeOiVelocity — null guard", () => {
    it("null on empty array", () => {
      expect(computeOiVelocity([], "BTC")).toBeNull();
    });

    it("null on single snapshot", () => {
      expect(computeOiVelocity([{ timestamp: 1, openInterest: 1000, price: 100 }], "BTC")).toBeNull();
    });

    it("null when openInterest=0 in first snapshot", () => {
      const snaps = makeOiPair(0, 1000, 100, 110);
      expect(computeOiVelocity(snaps, "BTC")).toBeNull();
    });

    it("null when price=0 in last snapshot", () => {
      const snaps = makeOiPair(1000, 1100, 100, 0);
      expect(computeOiVelocity(snaps, "BTC")).toBeNull();
    });
  });

  describe("computeOiVelocity — regime detection", () => {
    it("aggressive_long when price↑ + OI↑", () => {
      // price +2%, OI +2%
      const result = computeOiVelocity(makeOiPair(1000, 1020, 100, 102), "BTC");
      expect(result?.regime).toBe("aggressive_long");
      expect(result?.oiVelocityScore).toBeGreaterThan(0);
    });

    it("short_squeeze_risk when price↓ + OI↑", () => {
      const result = computeOiVelocity(makeOiPair(1000, 1020, 100, 98), "BTC");
      expect(result?.regime).toBe("short_squeeze_risk");
      expect(result?.oiVelocityScore).toBeLessThan(0);
    });

    it("long_unwind when price↑ + OI↓", () => {
      const result = computeOiVelocity(makeOiPair(1000, 980, 100, 102), "BTC");
      expect(result?.regime).toBe("long_unwind");
      expect(result?.oiVelocityScore).toBeLessThan(0);
    });

    it("bear_exhaustion when price↓ + OI↓", () => {
      const result = computeOiVelocity(makeOiPair(1000, 980, 100, 98), "BTC");
      expect(result?.regime).toBe("bear_exhaustion");
      expect(result?.oiVelocityScore).toBeGreaterThan(0);
    });

    it("neutral when changes below threshold", () => {
      // OI change 0.1% (< 0.5% default), price 0.1% (< 0.3% default)
      const result = computeOiVelocity(makeOiPair(1000, 1001, 100, 100.1), "BTC");
      expect(result?.regime).toBe("neutral");
      expect(result?.oiVelocityScore).toBe(0);
    });
  });

  describe("computeOiVelocity — score boundary values", () => {
    it("score clamped to +10 on extreme bullish OI spike", () => {
      // OI +100% price +5% → aggressive_long, rawScore >> 10
      const result = computeOiVelocity(makeOiPair(1000, 2000, 100, 105), "BTC");
      expect(result?.oiVelocityScore).toBe(10);
    });

    it("score clamped to -10 on extreme short squeeze", () => {
      // OI +100% price -5% → short_squeeze_risk
      const result = computeOiVelocity(makeOiPair(1000, 2000, 100, 95), "BTC");
      expect(result?.oiVelocityScore).toBe(-10);
    });

    it("score ∈ [-10, +10] for aggressive_long +10% OI", () => {
      const result = computeOiVelocity(makeOiPair(1000, 1100, 100, 102), "BTC");
      expect(result?.oiVelocityScore).toBeGreaterThanOrEqual(-10);
      expect(result?.oiVelocityScore).toBeLessThanOrEqual(10);
    });

    it("custom scoreFactor scales result proportionally", () => {
      const cfg25: OiVelocityConfig = { scoreFactor: 25 };
      const cfg50: OiVelocityConfig = { scoreFactor: 50 };
      const snaps = makeOiPair(1000, 1010, 100, 101); // +1% OI, +1% price
      const r25 = computeOiVelocity(snaps, "BTC", cfg25);
      const r50 = computeOiVelocity(snaps, "BTC", cfg50);
      expect(r50!.oiVelocityScore).toBeCloseTo(r25!.oiVelocityScore * 2, 3);
    });

    it("custom noise thresholds filter small moves", () => {
      // OI +1% price +0.5% — default passes, high threshold filters
      const snaps = makeOiPair(1000, 1010, 100, 100.5);
      const defaultResult = computeOiVelocity(snaps, "BTC");
      expect(defaultResult?.regime).toBe("aggressive_long");

      const strictConfig: OiVelocityConfig = { minOiChangePct: 5, minPriceChangePct: 5 };
      const strictResult = computeOiVelocity(snaps, "BTC", strictConfig);
      expect(strictResult?.regime).toBe("neutral");
    });
  });

  describe("computeOiVelocity — magnitude classification", () => {
    it("weak when |oiChangePct| < 0.5", () => {
      // OI +0.3%, price +1%
      const result = computeOiVelocity(makeOiPair(1000, 1003, 100, 101), "BTC");
      expect(result?.magnitude).toBe("weak");
    });

    it("moderate when |oiChangePct| ∈ [0.5, 2)", () => {
      const result = computeOiVelocity(makeOiPair(1000, 1010, 100, 101), "BTC"); // +1%
      expect(result?.magnitude).toBe("moderate");
    });

    it("strong when |oiChangePct| ∈ [2, 5)", () => {
      const result = computeOiVelocity(makeOiPair(1000, 1030, 100, 103), "BTC"); // +3%
      expect(result?.magnitude).toBe("strong");
    });

    it("extreme when |oiChangePct| ≥ 5", () => {
      const result = computeOiVelocity(makeOiPair(1000, 1060, 100, 106), "BTC"); // +6%
      expect(result?.magnitude).toBe("extreme");
    });
  });

  describe("computeOiVelocity — output fields", () => {
    it("periodCount matches snapshot length", () => {
      const snaps: OiSnapshot[] = [
        { timestamp: 1, openInterest: 1000, price: 100 },
        { timestamp: 2, openInterest: 1010, price: 101 },
        { timestamp: 3, openInterest: 1020, price: 102 },
      ];
      const result = computeOiVelocity(snaps, "ETH");
      expect(result?.periodCount).toBe(3);
    });

    it("oiChangePct calculated correctly", () => {
      // first=1000, last=1050 → +5%
      const result = computeOiVelocity(makeOiPair(1000, 1050, 100, 105), "BTC");
      expect(result?.oiChangePct).toBeCloseTo(5, 2);
    });

    it("priceChangePct calculated correctly", () => {
      // price 100 → 102 → +2%
      const result = computeOiVelocity(makeOiPair(1000, 1050, 100, 102), "BTC");
      expect(result?.priceChangePct).toBeCloseTo(2, 2);
    });
  });

  describe("computeOiVelocityWindow", () => {
    it("uses last windowSize snapshots", () => {
      const snaps: OiSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        openInterest: 1000 + i * 10,
        price: 100 + i,
      }));
      const windowed = computeOiVelocityWindow(snaps, "BTC", 3);
      // window [7,8,9]: OI 1070→1090, price 107→109 → aggressive_long
      expect(windowed?.regime).toBe("aggressive_long");
      expect(windowed?.periodCount).toBe(3);
    });

    it("null on empty array", () => {
      expect(computeOiVelocityWindow([], "BTC")).toBeNull();
    });

    it("min window 2 even if windowSize=1 requested", () => {
      const snaps = [
        { timestamp: 1, openInterest: 1000, price: 100 },
        { timestamp: 2, openInterest: 1010, price: 101 },
      ];
      const result = computeOiVelocityWindow(snaps, "BTC", 1);
      expect(result).not.toBeNull();
    });
  });

  describe("oiVelocityScoreOrZero", () => {
    it("returns 0 for null", () => {
      expect(oiVelocityScoreOrZero(null)).toBe(0);
    });

    it("returns oiVelocityScore from result", () => {
      const result = computeOiVelocity(makeOiPair(1000, 1020, 100, 102), "BTC");
      expect(oiVelocityScoreOrZero(result)).toBe(result!.oiVelocityScore);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SCORE ENGINE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

describe("Score Engine — alternative data integration", () => {
  describe("oiVelocityScore → total contribution", () => {
    it("oiVelocityScore=+5 increases total by 5 vs baseline", () => {
      const baseline = computeScore(makeMinimalScoreInput());
      const withOi = computeScore(makeMinimalScoreInput({ oiVelocityScore: 5 }));
      // total may be clamped at 100 — difference proportional unless already at 100
      const diff = withOi.total - baseline.total;
      expect(diff).toBeCloseTo(5, 0);
    });

    it("oiVelocityScore=-5 decreases total by 5 vs baseline", () => {
      const baseline = computeScore(makeMinimalScoreInput());
      const withOi = computeScore(makeMinimalScoreInput({ oiVelocityScore: -5 }));
      expect(baseline.total - withOi.total).toBeCloseTo(5, 0);
    });

    it("oiVelocityScore=undefined treated as 0 (no change)", () => {
      const baseline = computeScore(makeMinimalScoreInput());
      const withUndefined = computeScore(makeMinimalScoreInput({ oiVelocityScore: undefined }));
      expect(withUndefined.total).toBe(baseline.total);
    });

    it("oiVelocityScore=null treated as 0 (no change)", () => {
      const baseline = computeScore(makeMinimalScoreInput());
      const withNull = computeScore(makeMinimalScoreInput({ oiVelocityScore: null }));
      expect(withNull.total).toBe(baseline.total);
    });

    it("total clamped at 100 even with +10 oiVelocityScore", () => {
      // Set srModifier high to push toward 100
      const highInput = makeMinimalScoreInput({ srModifier: 30, oiVelocityScore: 10 });
      const result = computeScore(highInput);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it("total clamped at 0 even with -10 oiVelocityScore", () => {
      const lowInput = makeMinimalScoreInput({ srModifier: -50, oiVelocityScore: -10 });
      const result = computeScore(lowInput);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe("score field types and ranges", () => {
    it("score is integer (Math.round applied)", () => {
      const result = computeScore(makeMinimalScoreInput({ oiVelocityScore: 3.7 }));
      expect(Number.isInteger(result.score)).toBe(true);
    });

    it("total is between 0 and 100", () => {
      for (const oi of [10, -10, 0, 7, -5]) {
        const result = computeScore(makeMinimalScoreInput({ oiVelocityScore: oi }));
        expect(result.total).toBeGreaterThanOrEqual(0);
        expect(result.total).toBeLessThanOrEqual(100);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// composeScoreInput INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

describe("composeScoreInput — alt data passthrough", () => {
  /** Minimal geçerli candle array (OKX format) */
  function makeCandles(n: number): import("@/lib/okx/candles").Candle[] {
    return Array.from({ length: n }, (_, i) => [
      String(1_700_000_000_000 + i * 3_600_000), // ts
      "50000", // open
      "50100", // high
      "49900", // low
      "50000", // close
      "1000",  // vol
      "50000000", // volCcy
      "50000000", // volCcyQuote
      "1",     // confirm
    ] as unknown as import("@/lib/okx/candles").Candle);
  }

  const base4h = makeCandles(200);
  const base1h = makeCandles(200);
  const base15m = makeCandles(100);

  const baseComposeInput: ComposeInput = {
    pair: "BTC",
    livePrice: 50000,
    candles4h: base4h,
    candles1h: base1h,
    candles15m: base15m,
    fg: 50,
    eventSkipUntil: null,
    btcCooldownUntil: null,
    btcCooldownReason: "",
    btcSelfCooldownUntil: null,
    lockReleasedAt: null,
    openPositions: [],
    drawdownProtocol: { tier: "normal", minScore: 80, label: "Normal", reason: "" },
    trades: [],
    srModifier: 0,
    sweep15m: { type: null, strength: 0 },
    timeQuality: { quality: 1, reason: "ok" },
    now: 1_700_000_000_000,
  };

  it("oiVelocityScore passes through to ScoreInput", () => {
    const result = composeScoreInput({ ...baseComposeInput, oiVelocityScore: 7 });
    expect(result?.oiVelocityScore).toBe(7);
  });

  it("oiVelocityScore=null passes through as null", () => {
    const result = composeScoreInput({ ...baseComposeInput, oiVelocityScore: null });
    expect(result?.oiVelocityScore).toBeNull();
  });

  it("oiVelocityScore undefined → null in ScoreInput", () => {
    const result = composeScoreInput({ ...baseComposeInput });
    expect(result?.oiVelocityScore).toBeNull();
  });

  it("ScoreInput with alt data feeds into computeScore without error", () => {
    const scoreInput = composeScoreInput({
      ...baseComposeInput,
      oiVelocityScore: 4,
    });
    expect(scoreInput).not.toBeNull();
    const result = computeScore(scoreInput!);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("null when livePrice is null (unchanged guard)", () => {
    const result = composeScoreInput({ ...baseComposeInput, livePrice: null, oiVelocityScore: 5 });
    expect(result).toBeNull();
  });

  it("null when candles4h < 200 (unchanged guard)", () => {
    const result = composeScoreInput({ ...baseComposeInput, candles4h: makeCandles(100), oiVelocityScore: 5 });
    expect(result).toBeNull();
  });
});
