/**
 * BTC COOLDOWN WIRING — Onaylanan kapsam A: useScoreEngine.ts + backtest/engine.ts
 * tetikleyici bağlantısı (lib/risk/btc-cooldown.ts daha önce dormant'tı, hiçbir
 * üretim kodu evaluateBtcMovement()/BtcCooldown.applyMovement()'ı çağırmıyordu).
 *
 * Kapsam:
 *   - deriveBtcMovementInput(): yeni saf yardımcı (lib/risk/btc-cooldown.ts) —
 *     doğrudan, mock'suz test edilebilir.
 *   - runBacktest()'in yeni opsiyonel btcCandles1h/4h parametreleri — computeScore()
 *     mock'lanarak (gerçek skorlayıcı pipeline'ının belirsizliğine bağımlı olmadan)
 *     her bar'da HANGİ btcCooldownUntil/btcSelfCooldownUntil değerinin geçirildiği
 *     doğrudan yakalanır ve doğrulanır.
 *
 * NOT: Bu repoda daha önce vi.mock() ile modül mock'lama örneği yoktu (sadece
 * vi.fn() callback spy'ları vardı, bkz. risk-locks-drawdown.test.ts) — bu dosya
 * yeni bir test kalıbı tanıtıyor. vitest'in resmi vi.hoisted() deseni kullanıldı
 * (mock factory'nin dışarıdaki değişkenlere referans vermesi gerektiğinde şart).
 * Sandbox'ta node_modules yüklü değil, bu yüzden bu dosya çalıştırılarak DOĞRULANAMADI
 * — CLAUDE.md §Ortam Notları'ndaki kabul edilen kısıtla aynı, kod okuma ile
 * doğrulandı. Gerçek bağımlılıklar kurulduğunda `npx vitest run
 * tests/integration/btc-cooldown-wiring.test.ts` ile çalıştırılıp teyit edilmeli.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateBtcMovement, deriveBtcMovementInput, BTC_COOLDOWN_CONSTANTS } from "@/lib/risk/btc-cooldown";
import type { Candle } from "@/lib/okx/candles";
import { getBucketStats } from "@/lib/bucket/stats";
import type { ScoreResult } from "@/lib/score/orchestrator";

// ─────────────────────────────────────────────────────────────
// deriveBtcMovementInput() — saf fonksiyon, mock gerekmez
// ─────────────────────────────────────────────────────────────

describe("deriveBtcMovementInput()", () => {
  const c = (close: number, high = close + 50, low = close - 50): Candle => ({
    ts: 0, open: close, high, low, close, volume: 1000, confirm: true,
  });

  it("eksik mum (undefined) → null", () => {
    expect(deriveBtcMovementInput(undefined, c(100), c(100), c(100))).toBeNull();
    expect(deriveBtcMovementInput(c(100), undefined, c(100), c(100))).toBeNull();
    expect(deriveBtcMovementInput(c(100), c(100), undefined, c(100))).toBeNull();
    expect(deriveBtcMovementInput(c(100), c(100), c(100), undefined)).toBeNull();
  });

  it("prev1h.close <= 0 → null (sıfıra bölme guard'ı)", () => {
    expect(deriveBtcMovementInput(c(100), c(0), c(100), c(100))).toBeNull();
  });

  it("prev4h.close <= 0 → null", () => {
    expect(deriveBtcMovementInput(c(100), c(100), c(100), c(0))).toBeNull();
  });

  it("last1h.low <= 0 → null", () => {
    expect(deriveBtcMovementInput(c(100, 150, 0), c(100), c(100), c(100))).toBeNull();
  });

  it("düz veri → tüm yüzdeler ~0", () => {
    const r = deriveBtcMovementInput(c(50000), c(50000), c(50000), c(50000));
    expect(r).not.toBeNull();
    expect(r!.lastClosePct).toBeCloseTo(0, 5);
    expect(r!.lastRangePct).toBeCloseTo(0.2, 1); // (h-l)/l = 100/49950 ≈ %0.2
    expect(r!.last4hPct).toBeCloseTo(0, 5);
  });

  it("1H kapanış %5 sıçrama → lastClosePct ≈ 5", () => {
    const r = deriveBtcMovementInput(c(52500), c(50000), c(50000), c(50000));
    expect(r!.lastClosePct).toBeCloseTo(5, 1);
  });

  it("evaluateBtcMovement ile birlikte: %5 sıçrama tetiklenir (eşik %2.0)", () => {
    const r = deriveBtcMovementInput(c(52500), c(50000), c(50000), c(50000))!;
    expect(evaluateBtcMovement(r).triggered).toBe(true);
  });

  it("küçük dalgalanma (%0.5) → tetiklenmez", () => {
    const r = deriveBtcMovementInput(c(50250), c(50000), c(50000), c(50000))!;
    expect(evaluateBtcMovement(r).triggered).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// runBacktest() wiring — computeScore() mock'lanır, gerçek skorlayıcının
// sayısal belirsizliğine bağımlı olmadan SADECE "hangi btcCooldownUntil/
// btcSelfCooldownUntil değeri geçirildi" doğrulanır.
// ─────────────────────────────────────────────────────────────

const { capturedInputs, computeScoreMock } = vi.hoisted(() => {
  const capturedInputs: Array<{ btcCooldownUntil: unknown; btcSelfCooldownUntil: unknown; now: number }> = [];
  const computeScoreMock = vi.fn();
  return { capturedInputs, computeScoreMock };
});

vi.mock("@/lib/score/orchestrator", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/score/orchestrator");
  return { ...actual, computeScore: computeScoreMock };
});

import { runBacktest } from "@/lib/backtest/engine";

function makeStubResult(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    pair: "ETH",
    score: 0,
    baseScore: 0,
    total: 0,
    verdict: "no",
    direction: "NEUTRAL",
    dirConfidence: 0,
    counterTrend: false,
    sub: { trend: 0, adx: 0, rsi: 0, vol: 0, bb: 0, vwap: 0, funding: 0, macro: 0 },
    reasons: { trend: "", adx: "", rsi: "", vol: "", bb: "", vwap: "", funding: "", macro: "" },
    blocks: [],
    softBlocks: [],
    sweepBonus: 0,
    regimeBonus: 0,
    regime: "ranging",
    adaptiveRegime: "ranging",
    atrPercentile: null,
    goThreshold: 80,
    bucket: getBucketStats(0, []),
    srModifier: 0,
    atrRegimeAdj: 0,
    volBreakoutActive: false,
    oiDivergenceContrib: 0,
    oiBonus: 0,
    signalType: "classic",
    pullbackActive: false,
    pullbackThreshold: 80,
    effectiveThreshold: 80,
    overextFlags: 0,
    triggeredShadowGates: [],
    ...overrides,
  };
}

const BASE_TS = 1_700_000_000_000;
const HOUR = 3_600_000;
const FOUR_H = 4 * HOUR;

/** Monoton, düşük varyanslı 1h mum serisi — RSI/EMA sıfır-varyans kenar durumunu önler. */
function makeTradedPair1h(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: BASE_TS + i * HOUR,
    open: 3000 + i,
    high: 3000 + i + 20,
    low: 3000 + i - 20,
    close: 3000 + i + 2,
    volume: 500 + i,
    confirm: true,
  }));
}

/** 4h referans mumlar — ptr4h'nin backtest başlangıcında ≥199 olmasını garantiler. */
function makeTradedPair4h(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: BASE_TS - count * FOUR_H + i * FOUR_H,
    open: 3000 + i,
    high: 3000 + i + 30,
    low: 3000 + i - 30,
    close: 3000 + i + 3,
    volume: 500 + i,
    confirm: true,
  }));
}

/** BTC 1H mumları — spikeAtIndex'ten itibaren düz bir %5 basamak (tek seferlik tetikleme). */
function makeBtc1h(count: number, spikeAtIndex: number | null): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = spikeAtIndex !== null && i >= spikeAtIndex ? 52500 : 50000;
    return {
      ts: BASE_TS + i * HOUR,
      open: close,
      high: close + 50,
      low: close - 50,
      close,
      volume: 1000,
      confirm: true,
    };
  });
}

/** BTC 4H mumları — kasıtlı olarak DÜZ (sadece 1H koşulunu izole test etmek için). */
function makeBtc4h(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: BASE_TS - count * FOUR_H + i * FOUR_H,
    open: 50000,
    high: 50050,
    low: 49950,
    close: 50000,
    volume: 1000,
    confirm: true,
  }));
}

const WARMUP = 210; // lib/backtest/engine.ts:43 ile birebir (export edilmiyor, burada tekrarlandı)
const TOTAL_1H = 230; // WARMUP + 20 değerlendirilen bar
const SPIKE_INDEX = 220; // WARMUP'tan 10 bar sonra — öncesinde/sonrasında gözlem payı bırakır

describe("runBacktest() — BTC cooldown wiring", () => {
  beforeEach(() => {
    capturedInputs.length = 0;
    computeScoreMock.mockReset();
    computeScoreMock.mockImplementation((input: { btcCooldownUntil: unknown; btcSelfCooldownUntil: unknown; now: number }) => {
      capturedInputs.push({
        btcCooldownUntil: input.btcCooldownUntil,
        btcSelfCooldownUntil: input.btcSelfCooldownUntil,
        now: input.now,
      });
      return makeStubResult();
    });
  });

  it("btcCandles1h/4h VERİLMEDİYSE → mevcut davranış korunur, her bar'da btcCooldownUntil/btcSelfCooldownUntil null", async () => {
    const candles1h = makeTradedPair1h(TOTAL_1H);
    const candles4h = makeTradedPair4h(300);

    await runBacktest(candles1h, candles4h, {
      pair: "ETH",
      dataMonths: 3,
      frozenFg: 50,
    });

    expect(capturedInputs.length).toBeGreaterThan(0);
    for (const c of capturedInputs) {
      expect(c.btcCooldownUntil).toBeNull();
      expect(c.btcSelfCooldownUntil).toBeNull();
    }
  });

  it("btcCandles1h VERİLDİ + alt pair (ETH) → spike bar'ında btcCooldownUntil dolu, öncesinde/çok sonrasında null", async () => {
    const candles1h = makeTradedPair1h(TOTAL_1H);
    const candles4h = makeTradedPair4h(300);
    const btcCandles1h = makeBtc1h(TOTAL_1H, SPIKE_INDEX);
    const btcCandles4h = makeBtc4h(300);

    await runBacktest(
      candles1h,
      candles4h,
      { pair: "ETH", dataMonths: 3, frozenFg: 50 },
      undefined,
      btcCandles1h,
      btcCandles4h,
    );

    // capturedInputs[k] index'i loop bar'ı (WARMUP + k)'a karşılık gelir (composeScoreInput
    // hiç null dönmediği sürece — düz/monoton veri ile bu guard'lara takılmaz).
    const spikeCallIdx = SPIKE_INDEX - WARMUP;
    expect(capturedInputs[spikeCallIdx].btcCooldownUntil).not.toBeNull();
    // self-cooldown alt pair'e UYGULANMAZ (sadece BTC'nin kendisine)
    expect(capturedInputs[spikeCallIdx].btcSelfCooldownUntil).toBeNull();

    // Spike'tan önceki bar → henüz tetiklenmedi
    expect(capturedInputs[spikeCallIdx - 1].btcCooldownUntil).toBeNull();

    // Spike'tan yeterince sonra (60dk'lık ALT_COOLDOWN penceresi çoktan kapandı) → null'a döner
    const wellAfterIdx = spikeCallIdx + 5;
    expect(capturedInputs[wellAfterIdx].btcCooldownUntil).toBeNull();

    // Tetiklenen değer gerçekten ALT_COOLDOWN_MS ile tutarlı (spike bar ts + 60dk civarı)
    const spikeTs = capturedInputs[spikeCallIdx].now;
    expect(capturedInputs[spikeCallIdx].btcCooldownUntil).toBe(spikeTs + BTC_COOLDOWN_CONSTANTS.ALT_COOLDOWN_MS);
  });

  it("btcCandles1h VERİLDİ + BTC'nin KENDİSİ (config.pair='BTC', kendi mumları BTC referansı olarak geçirildi) → self-cooldown tetiklenir, alt cooldown DEĞİL", async () => {
    const btcCandles1h = makeBtc1h(TOTAL_1H, SPIKE_INDEX);
    const btcCandles4h = makeBtc4h(300);
    // BTC'yi backtest ederken traded-pair candle'ları = BTC candle'larının ta kendisi
    // (useBacktest.ts'teki "pair==='BTC' ise ayrı fetch yok" kararıyla tutarlı).
    const candles4hRef = makeTradedPair4h(300);

    await runBacktest(
      btcCandles1h,
      candles4hRef,
      { pair: "BTC", dataMonths: 3, frozenFg: 50 },
      undefined,
      btcCandles1h,
      btcCandles4h,
    );

    const spikeCallIdx = SPIKE_INDEX - WARMUP;
    expect(capturedInputs[spikeCallIdx].btcSelfCooldownUntil).not.toBeNull();
    expect(capturedInputs[spikeCallIdx].btcCooldownUntil).toBeNull(); // BTC'ye alt-cooldown uygulanmaz
    const spikeTs = capturedInputs[spikeCallIdx].now;
    expect(capturedInputs[spikeCallIdx].btcSelfCooldownUntil).toBe(spikeTs + BTC_COOLDOWN_CONSTANTS.SELF_COOLDOWN_MS);
  });

  it("spike YOKSA (spikeAtIndex=null, BTC tamamen düz) → hiçbir bar'da tetiklenmez", async () => {
    const candles1h = makeTradedPair1h(TOTAL_1H);
    const candles4h = makeTradedPair4h(300);
    const btcCandles1h = makeBtc1h(TOTAL_1H, null);
    const btcCandles4h = makeBtc4h(300);

    await runBacktest(
      candles1h,
      candles4h,
      { pair: "ETH", dataMonths: 3, frozenFg: 50 },
      undefined,
      btcCandles1h,
      btcCandles4h,
    );

    for (const c of capturedInputs) {
      expect(c.btcCooldownUntil).toBeNull();
    }
  });
});
