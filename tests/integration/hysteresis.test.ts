/**
 * HYSTERESIS SMOOTHING — Onaylanan kapsam B (lib/score/orchestrator.ts'e dokunuyor,
 * bu yüzden HENÜZ COMMIT EDİLMEDİ — ayrı açık "Onaylıyorum" bekliyor).
 *
 * Kapsam:
 *   - applyHysteresis(): saf fonksiyon, tam skorlama pipeline'ından (8 kategori
 *     scorer + SR + sweep + regime) BAĞIMSIZ, doğrudan total/effectiveThreshold/
 *     blocks/softBlocks ile deterministik test edilir.
 *   - computeScore() entegrasyonu: applyHysteresis'in gerçek verdict hesaplama
 *     bloğuna doğru bağlandığını, srModifier'ı bir "kaldıraç" olarak kullanarak
 *     (8 kategori scorer'ın belirsiz iç toplamına bağımlı olmadan) doğrular —
 *     total = clamp(baseScore + sweep + regime + srModifier) formülünde srModifier
 *     DOĞRUDAN bir input, bu yüzden anchor.total/anchor.effectiveThreshold'dan
 *     türetilen bir delta ile total'ı kontrollü şekilde kaydırmak mümkün.
 *   - runBacktest() per-pair izolasyonu: prevVerdict'in fonksiyon-lokal olduğunu,
 *     iki ardışık runBacktest() çağrısı arasında SIZMADIĞINI computeScore()
 *     mock'lanarak (btc-cooldown-wiring.test.ts'teki AYNI vi.hoisted() deseniyle)
 *     kanıtlar — kullanıcının özellikle istediği test.
 *
 * NOT: Sandbox'ta node_modules yok, bu dosya ÇALIŞTIRILARAK doğrulanamadı — sadece
 * kod okuma ile doğrulandı (CLAUDE.md §Ortam Notları'ndaki kabul edilen kısıt).
 * Gerçek bağımlılıklar kurulduğunda `npx vitest run tests/integration/hysteresis.test.ts`
 * ile çalıştırılıp teyit edilmeli — özellikle computeScore() E2E testlerindeki
 * "anchor.total < 100 (clamp'e değmedi)" ön koşulu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyHysteresis, HYSTERESIS_MARGIN, computeScore } from "@/lib/score/orchestrator";
import type { ScoreInput } from "@/lib/score/orchestrator";

// ─────────────────────────────────────────────────────────────
// applyHysteresis() — saf fonksiyon, tam pipeline'dan bağımsız
// ─────────────────────────────────────────────────────────────

describe("applyHysteresis()", () => {
  const T = 80; // örnek effectiveThreshold

  it("go→wait geçişi, prevVerdict=go, total margin İÇİNDE → smoothed go", () => {
    const r = applyHysteresis("wait", "go", T - (HYSTERESIS_MARGIN - 1), T, [], []);
    expect(r.verdict).toBe("go");
    expect(r.smoothed).toBe(true);
  });

  it("tam margin sınırında (total === effectiveThreshold - MARGIN) → smoothed (>= dahil)", () => {
    const r = applyHysteresis("wait", "go", T - HYSTERESIS_MARGIN, T, [], []);
    expect(r.verdict).toBe("go");
    expect(r.smoothed).toBe(true);
  });

  it("go→wait geçişi, prevVerdict=go, total margin DIŞINDA → wait kalır", () => {
    const r = applyHysteresis("wait", "go", T - (HYSTERESIS_MARGIN + 1), T, [], []);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });

  it("prevVerdict=null → smoothing uygulanmaz", () => {
    const r = applyHysteresis("wait", null, T - 1, T, [], []);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });

  it("prevVerdict=undefined → smoothing uygulanmaz (geriye dönük uyumluluk)", () => {
    const r = applyHysteresis("wait", undefined, T - 1, T, [], []);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });

  it("prevVerdict=wait → smoothing uygulanmaz (sadece go→wait geçişini yumuşatır)", () => {
    const r = applyHysteresis("wait", "wait", T - 1, T, [], []);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });

  it("prevVerdict=no → smoothing uygulanmaz", () => {
    const r = applyHysteresis("wait", "no", T - 1, T, [], []);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });

  it("rawVerdict zaten go ise no-op (zaten go, dokunmaz)", () => {
    const r = applyHysteresis("go", "go", T + 5, T, [], []);
    expect(r.verdict).toBe("go");
    expect(r.smoothed).toBe(false);
  });

  it("rawVerdict=no ise smoothing uygulanmaz (sadece wait→go, no'yu asla go'ya çevirmez)", () => {
    const r = applyHysteresis("no", "go", T + 10, T, [], []);
    expect(r.verdict).toBe("no");
    expect(r.smoothed).toBe(false);
  });

  it("blocks doluysa → smoothing ASLA uygulanmaz (defansif: rawVerdict=wait olsa bile) — güvenlik bypass'ı değil", () => {
    const r = applyHysteresis("wait", "go", T - 1, T, ["🚨 BTC cooldown"], []);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });

  it("softBlocks doluysa → smoothing uygulanmaz", () => {
    const r = applyHysteresis("wait", "go", T - 1, T, [], ["funding crowded"]);
    expect(r.verdict).toBe("wait");
    expect(r.smoothed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// computeScore() entegrasyonu — srModifier'ı kontrollü kaldıraç olarak kullanır
// ─────────────────────────────────────────────────────────────

function makeScoreInput(overrides?: Partial<ScoreInput>): ScoreInput {
  return {
    pair: "BTC",
    px: 50000,
    px4h: 49800,
    px15: 50100,
    ema21_15m: 48000,
    ema50_1h: 47000,
    ema200_1h: 44000,
    ema50_4h: 46000,
    ema200_4h: 42000,
    ema50_1d: 41000,
    ema21_1h: 48500,
    rsi: 58,
    adx: 35,
    bbPct: 0.55,
    volRatio: 1.5,
    fundingRate: 0.0001,
    atrPercentile: 55,
    adx4h: 32,
    fg: 55,
    srModifier: 0,
    sweep15m: { type: null, strength: 0 },
    timeQuality: { quality: 1, reason: "" },
    openPositions: [],
    drawdownProtocol: { tier: "normal", minScore: 80, label: "", reason: "" },
    btcCooldownUntil: null,
    btcCooldownReason: "",
    btcSelfCooldownUntil: null,
    eventSkipUntil: null,
    lockReleasedAt: null,
    trades: [],
    closes1h: Array(12).fill(50000),
    volumes1h: Array(15).fill(1000),
    now: 1_700_000_000_000,
    last4hMovePct: 0.6,
    vwap: { vwap: 49800, stddev: 550 },
    ...overrides,
  };
}

// Doğrudan input olan srModifier'ı kaldıraç olarak kullanmak için: "çok güçlü boğa"
// senaryosunun 8-kategori scorer toplamı (baseScore) belirsiz/pipeline-bağımlı
// olduğundan (bkz. score-edge-cases.test.ts'in KENDİ "muhtemelen go" yorumu, satır
// 93-94), ekstra bir sabit srModifier boost'u anchor'ın effectiveThreshold'u AÇIKÇA
// geçmesi ihtimalini artırıyor — clamp tavanı (100) her ihtimalde anchor testinde
// ayrıca kontrol ediliyor.
const ANCHOR_SR_MODIFIER = 15;

describe("computeScore() — hysteresis entegrasyonu", () => {
  it("anchor: blocks/softBlocks boş, verdict go (ön koşul — değilse test recalibre edilmeli)", () => {
    const anchor = computeScore(makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER }));
    expect(anchor.blocks.length).toBe(0);
    expect(anchor.softBlocks.length).toBe(0);
    expect(anchor.verdict).toBe("go");
    // Clamp tavanına değmediğinden emin ol — değerse srModifier kaldıracı lineer çalışmaz
    expect(anchor.total).toBeLessThan(100);
  });

  it("go → total margin içinde düşerse ve prevVerdict=go ise → go korunur (reasons.hysteresis dolu)", () => {
    const anchor = computeScore(makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER }));
    const slack = anchor.total - anchor.effectiveThreshold; // yapısal olarak >= 0 (verdict go olduğu için)
    const dip = slack + (HYSTERESIS_MARGIN - 1);
    const result = computeScore(
      makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER - dip, prevVerdict: "go" }),
    );
    expect(result.verdict).toBe("go");
    expect(result.reasons.hysteresis).toBeDefined();
  });

  it("AYNI dip, prevVerdict YOKSA (undefined) → wait (smoothing uygulanmaz)", () => {
    const anchor = computeScore(makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER }));
    const slack = anchor.total - anchor.effectiveThreshold;
    const dip = slack + (HYSTERESIS_MARGIN - 1);
    const result = computeScore(makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER - dip }));
    expect(result.verdict).toBe("wait");
    expect(result.reasons.hysteresis).toBeUndefined();
  });

  it("dip margin'in ÖTESİNDE → prevVerdict=go olsa bile wait (smoothing sınırsız değil)", () => {
    const anchor = computeScore(makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER }));
    const slack = anchor.total - anchor.effectiveThreshold;
    const dip = slack + (HYSTERESIS_MARGIN + 1);
    const result = computeScore(
      makeScoreInput({ srModifier: ANCHOR_SR_MODIFIER - dip, prevVerdict: "go" }),
    );
    expect(result.verdict).toBe("wait");
  });

  it("hard block varken (ETH + btcCooldownUntil gelecekte) prevVerdict=go olsa bile verdict no kalır — hysteresis güvenlik bypass'ı değil", () => {
    const now = 1_700_000_000_000;
    const result = computeScore(
      makeScoreInput({
        pair: "ETH",
        btcCooldownUntil: now + 60000,
        now,
        prevVerdict: "go",
      }),
    );
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.verdict).toBe("no");
  });
});

// ─────────────────────────────────────────────────────────────
// runBacktest() per-pair izolasyonu — computeScore() mock'lanarak prevVerdict'in
// SIZMADIĞI kanıtlanır (btc-cooldown-wiring.test.ts'teki aynı vi.hoisted() deseni).
// ─────────────────────────────────────────────────────────────

const { capturedPrevVerdicts, computeScoreMock } = vi.hoisted(() => {
  const capturedPrevVerdicts: Array<string | null | undefined> = [];
  const computeScoreMock = vi.fn();
  return { capturedPrevVerdicts, computeScoreMock };
});

vi.mock("@/lib/score/orchestrator", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/score/orchestrator");
  return { ...actual, computeScore: computeScoreMock };
});

import { runBacktest } from "@/lib/backtest/engine";
import { getBucketStats } from "@/lib/bucket/stats";
import type { ScoreResult } from "@/lib/score/orchestrator";

function makeStubResult(verdict: "go" | "wait" | "no"): ScoreResult {
  return {
    pair: "BTC",
    score: 0,
    baseScore: 0,
    total: 0,
    verdict,
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
    goThreshold: 80,
    bucket: getBucketStats(0, []),
    srModifier: 0,
    atrRegimeAdj: 0,
    volBreakoutActive: false,
    oiDivergenceContrib: 0,
    signalType: "classic",
    pullbackActive: false,
    pullbackThreshold: 80,
    effectiveThreshold: 80,
    overextFlags: 0,
    triggeredShadowGates: [],
  };
}

const BASE_TS = 1_700_000_000_000;
const HOUR = 3_600_000;
const FOUR_H = 4 * HOUR;

function make1h(count: number): Array<{ ts: number; open: number; high: number; low: number; close: number; volume: number; confirm: boolean }> {
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

function make4h(count: number) {
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

describe("runBacktest() — prevVerdict per-pair izolasyonu (sızıntı yok)", () => {
  beforeEach(() => {
    capturedPrevVerdicts.length = 0;
    computeScoreMock.mockReset();
  });

  it("pair A'nın SON verdict'i 'go' olsa bile, pair B'nin İLK bar'ı prevVerdict=null görür", async () => {
    const candles1h = make1h(215); // WARMUP(210) + 5 değerlendirilen bar
    const candles4h = make4h(300);

    // Pair A: HER çağrı "go" döner → prevVerdict fonksiyon içinde "go"da kalarak biter.
    computeScoreMock.mockImplementation((input: { prevVerdict?: string | null }) => {
      capturedPrevVerdicts.push(input.prevVerdict);
      return makeStubResult("go");
    });
    await runBacktest(candles1h, candles4h, { pair: "BTC", dataMonths: 3, frozenFg: 50 });

    const callsInRunA = capturedPrevVerdicts.length;
    expect(callsInRunA).toBeGreaterThan(0);
    // Run A'nın kendi İÇİNDE sızma yok kontrolü: ilk çağrı null, sonrakiler "go".
    expect(capturedPrevVerdicts[0]).toBeNull();
    if (callsInRunA > 1) {
      expect(capturedPrevVerdicts[callsInRunA - 1]).toBe("go");
    }

    // Pair B: AYRI bir runBacktest() çağrısı — aynı computeScoreMock, ama
    // prevVerdict fonksiyon-lokal olduğu için pair A'nın "go" mirasını TAŞIMAMALI.
    await runBacktest(candles1h, candles4h, { pair: "ETH", dataMonths: 3, frozenFg: 50 });

    // Run B'nin İLK çağrısı — flat capturedPrevVerdicts dizisinde run A'dan hemen sonraki eleman.
    const firstCallOfRunB = capturedPrevVerdicts[callsInRunA];
    expect(firstCallOfRunB).toBeNull();
  });
});
