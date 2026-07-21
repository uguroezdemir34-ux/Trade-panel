/**
 * SCORE ORCHESTRATOR — v55.51 panel ile birebir.
 * Kaynak: panel_v55_51.html satır 7166-8014 (computeScoreForPair).
 *
 * Bu modül paket #5 serisinin kapatma taşı. Aşağıdaki modülleri
 * tek pipeline'da birleştirir:
 *   #5a — S/R modifier (detectSRLevels)
 *   #5c — bucket stats
 *   #5d-i — direction, scorers, sweep bonus, regime bonus
 *   #5d-ii — hard + soft blocks
 *
 * MİMARİ KARARI: Panel'in `ST` global state'i yerine her şey input olarak
 * geliyor. Bu, test edilebilirliği ve Faz 2 UI entegrasyonunu kolaylaştırıyor.
 * Real-time veri akışı: store → orchestrator → UI/Telegram.
 */

import { inferDirection, type Direction, type DirectionInput } from "./direction";
import {
  scoreTrend,
  scoreAdx,
  scoreRsi,
  scoreVolume,
  scoreBb,
  scoreVwap,
  scoreFunding,
  scoreMacro,
  scoreSweepBonus,
  scoreRegimeBonus,
  type SweepInput,
  type VwapInput,
  type Regime,
} from "./scorers";

// Diğer modüllerin (forward test vs.) kullanabilmesi için re-export
export type { Direction } from "./direction";
export type { SignalType } from "./pullback";
import {
  checkVolBreakoutOverride,
  checkOverextended,
  checkNeutralDirection,
  checkCounterTrend,
  checkAdxWeakOrTired,
  checkRsiExtreme,
  checkBbOutOfBand,
  checkVwapExtreme,
  checkSrHardBlock,
  type SrProximity,
  checkVolumeLow,
  checkFundingExtreme,
  checkTimeQuality,
  checkEventSkip,
  checkBtcCooldown,
  checkBtcSelfCooldown,
  checkFundingCrowded,
  checkLockReleaseRamp,
  checkCorrelationCluster,
  checkAtrRegime,
  checkDailyTrendOpposite,
} from "./blocks";
import { getBucketStats, type Trade } from "@/lib/bucket/stats";
import {
  detectRegimeForWeights,
  computeAdaptiveWeights,
  composeScorerWeights,
} from "./adaptiveWeights";
import {
  detectPullbackSetup,
  type SignalType,
  PULLBACK_CONSTANTS,
} from "./pullback";
import type { MtfTrendResult } from "@/lib/market/mtfTrend";
import { computeOiDivergence } from "@/lib/market/oi-divergence";
import type { OiVelocityResult } from "@/lib/market/oi-velocity";
import type { PocResult } from "@/lib/indicators/poc";

// ═══════════════════════════════════════════════════════════════════
// INPUT/OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ScoreInput {
  pair: string;

  // Fiyatlar
  px: number;
  px4h: number;
  px15: number;

  // EMA'lar
  ema21_15m: number | null;
  ema50_1h: number | null;
  ema200_1h: number | null;
  ema50_4h: number | null;
  ema200_4h: number | null;
  ema50_1d: number | null;

  // İndikatörler
  rsi: number | null;
  adx: number | null;
  bbPct: number | null;
  vwap: VwapInput | null;
  volRatio: number | null;
  fundingRate: number | null;
  atrPercentile: number | null;

  // Pullback engine için ek veri (paket #5e)
  /** 4H ADX değeri */
  adx4h: number | null;
  /** 1H EMA21 */
  ema21_1h: number | null;
  /** 1H mum kapanışları (en yenisi sonda) — en az 8 mum */
  closes1h: readonly number[];
  /** 1H hacim verisi (en yenisi sonda) — en az 11 mum */
  volumes1h: readonly number[];

  // S/R modifier (paket #5a output)
  srModifier: number;

  // Sweep input (paket #5b output - "type: bullish_sweep/bearish_sweep")
  sweep15m: SweepInput;

  // Macro
  fg: number;

  // 4H mum hareket bilgisi (volBreakout için)
  last4hMovePct: number | null;

  // Time quality (panel timeQuality() çıktısı)
  timeQuality: { quality: number; reason: string };

  // State (orchestrator'a dışarıdan geliyor — store'dan)
  eventSkipUntil: number | null;
  btcCooldownUntil: number | null;
  btcCooldownReason: string;
  btcSelfCooldownUntil: number | null;
  lockReleasedAt: number | null;
  openPositions: ReadonlyArray<{ pair: string; direction: Direction }>;

  // Drawdown protocol (paket #4 output)
  drawdownProtocol: {
    tier: "normal" | "caution" | "restricted" | "locked";
    minScore: number;
    label: string;
    reason: string;
  };

  // Bucket stats için trade history
  trades: readonly Trade[];

  // Şu an (test edilebilirlik)
  now: number;

  /**
   * OI velocity skoru [-10, +10] — oi-velocity.ts çıktısından beslenir.
   * null/undefined → 0 (tarafsız, alternatif veri yoksa atlanır).
   */
  oiVelocityScore?: number | null;

  /**
   * BTC 1H ADX — piyasa geneli chop tespiti için.
   * ADX < 20 → BTC range/chop modunda → goThreshold +8 (chop gate).
   * null/undefined → chop gate uygulanmaz.
   */
  btcAdx1h?: number | null;

  /**
   * Ham OI velocity sonucu — computeOiDivergence için.
   * Faz 2: direction × OI rejimi → +3 (confirm) / -6 (diverge) katkısı.
   * null/undefined → katkı 0.
   */
  oiVelocityResult?: OiVelocityResult | null;

  /**
   * BTC kendi S/R seviyesine ≤%0.5 yakınsa true — altcoin goThreshold +8.
   * BTC pair'in kendisine uygulanmaz. undefined/false → gate atlanır.
   */
  btcNearSR?: boolean;

  /**
   * ATR ratio = current ATR / son 20 bar ATR ortalaması.
   * %80 altı (sıkışma) veya %120 üstü (genişleme) → goThreshold +5.
   * null/undefined → gate atlanır.
   */
  atrRatio?: number | null;

  /**
   * POC (Point of Control) — 7 günlük hacim profili zirve fiyatı.
   * Fiyat < POC + LONG → kurumsal maliyet direnci → soft block.
   * Fiyat > POC + SHORT → kurumsal maliyet desteği → soft block.
   */
  poc?: PocResult | null;

  /** Scorer ağırlık çarpanları — ayarlar sayfasından gelir. Default: tümü 1.0 */
  scorerWeights?: ScorerWeights | null;

  /** MTF trend gate (1h/4h/1d EMA20 — computeMtfTrend çıktısı). no_data → gate atlanır. */
  mtfResult?: MtfTrendResult | null;

  /**
   * Bir önceki cycle'da/bar'da hesaplanan verdict — hysteresis smoothing için.
   * undefined/null → smoothing atlanır (geriye dönük uyumlu, davranış değişmez).
   * Kaynağı caller'a göre değişir: browser'da scoreStore.results[pair]?.verdict,
   * backtest'te runBacktest() içindeki fonksiyon-lokal değişken, server-cron'da
   * scorePrevBar()'ın zaten hesapladığı değer.
   */
  prevVerdict?: Verdict | null;

  /**
   * S/R hard block (checkSrHardBlock, bkz. blocks.ts) için ham detay —
   * srModifier ile AYNI detectSRLevels() çağrısından gelir ama caller
   * (useScoreEngine.ts / signalEngine.ts) direction hesaplandıktan SONRA
   * srModifier'ı nasıl override-spread ediyorsa (composeScoreInput'un
   * kendisi bu alanları hiç bilmez, chicken-and-egg: detectSRLevels()
   * direction'a bağımlı, direction composeScoreInput'un ÇIKTISINA bağımlı)
   * bunlar da AYNI şekilde son computeScore() çağrısına spread ile eklenir.
   * undefined → gate atlanır (btcNearSR/atrRatio ile aynı "opsiyonel dış
   * girdi" deseni).
   */
  srNearestResistance?: SrProximity | null;
  srNearestSupport?: SrProximity | null;
  srBreakoutOverride?: boolean;
}

export interface ScorerWeights {
  trend: number;
  adx: number;
  rsi: number;
  vol: number;
  bb: number;
  vwap: number;
  funding: number;
  macro: number;
}

export const DEFAULT_SCORER_WEIGHTS: ScorerWeights = {
  trend: 1, adx: 1, rsi: 1, vol: 1, bb: 1, vwap: 1, funding: 1, macro: 1,
};

const BASE_MAX: ScorerWeights = {
  trend: 25, adx: 15, rsi: 10, vol: 15, bb: 10, vwap: 10, funding: 8, macro: 7,
};

export type Verdict = "go" | "wait" | "no";

/**
 * Hysteresis tamponu (puan) — PLACEHOLDER değer, kullanıcı netleştirene kadar geçici.
 * "go" verdict'i, total effectiveThreshold'un bu kadar altına düşene kadar (VE
 * blocks/softBlocks yokken) "wait"e geçmez. bkz. applyHysteresis().
 */
export const HYSTERESIS_MARGIN = 4;

/**
 * Hysteresis smoothing — SADECE "go → wait" geçişini, skor eşiğe hâlâ (margin
 * içinde) yakınken yumuşatır. Hard/soft block kaynaklı wait/no ASLA ezilmez —
 * bu bir güvenlik bypass'ı değil, sadece skor gürültüsünü söndürme mekanizması.
 *
 * Saf fonksiyon olarak computeScore()'un DIŞINA çıkarıldı ki tam skorlama
 * pipeline'ına (8 kategori scorer + SR + sweep + regime) bağımlı olmadan,
 * doğrudan total/effectiveThreshold/blocks/softBlocks değerleriyle test edilebilsin.
 */
export function applyHysteresis(
  rawVerdict: Verdict,
  prevVerdict: Verdict | null | undefined,
  total: number,
  effectiveThreshold: number,
  blocks: readonly string[],
  softBlocks: readonly string[],
): { verdict: Verdict; smoothed: boolean } {
  if (
    rawVerdict === "wait" &&
    prevVerdict === "go" &&
    blocks.length === 0 &&
    softBlocks.length === 0 &&
    total >= effectiveThreshold - HYSTERESIS_MARGIN
  ) {
    return { verdict: "go", smoothed: true };
  }
  return { verdict: rawVerdict, smoothed: false };
}

export interface ScoreSubScores {
  trend: number;
  adx: number;
  rsi: number;
  vol: number;
  bb: number;
  vwap: number;
  funding: number;
  macro: number;
}

export interface ScoreReasons {
  trend: string;
  adx: string;
  rsi: string;
  vol: string;
  bb: string;
  vwap: string;
  funding: string;
  macro: string;
  sweep?: string;
  regime?: string;
  regimeRelax?: string;
  volBreakout?: string;
  atrRegime?: string;
  chopGate?: string;
  oiDivergence?: string;
  btcSrGate?: string;
  atrRatioGate?: string;
  pocBlock?: string;
  drawdownGate?: string;
  adaptiveCut?: string;
  softBlock?: string;
  lockRamp?: string;
  pullback?: string;
  pullbackThreshold?: string;
  hysteresis?: string;
  srHardBlock?: string;
}

export interface ScoreResult {
  pair: string;
  score: number;
  baseScore: number;
  total: number;
  verdict: Verdict;
  direction: Direction;
  dirConfidence: number;
  counterTrend: boolean;
  sub: ScoreSubScores;
  reasons: ScoreReasons;
  blocks: string[];
  softBlocks: string[];
  sweepBonus: number;
  regimeBonus: number;
  regime: Regime;
  goThreshold: number;
  bucket: ReturnType<typeof getBucketStats>;
  // Modifiers
  srModifier: number;
  atrRegimeAdj: number;
  volBreakoutActive: boolean;
  oiDivergenceContrib: number;
  // Pullback engine (paket #5e)
  signalType: SignalType;
  pullbackActive: boolean;
  pullbackThreshold: number;
  /** Etkin eşik: pullback aktifse pullbackThreshold, değilse goThreshold */
  effectiveThreshold: number;
  // Overextended detail (UI için)
  overextFlags: number;
  /** Gölge kapılar: tetiklendi ama threshold/score'a ETKİSİ YOK — sadece gözlem */
  triggeredShadowGates: string[];
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Bir pair için score, verdict ve tüm metadata'yı hesapla.
 *
 * Pipeline:
 *   1. Direction inference (3 TF EMA)
 *   2. 8 kategori puanı + counterTrend tespit
 *   3. baseScore = Σ kategoriler
 *   4. SR modifier ekle (paket #5a)
 *   5. Sweep bonus (baseScore≥75 gate)
 *   6. Regime bonus (baseScore≥75 gate)
 *   7. total = clamp(0, 100, base + sweep + regime + srMod)
 *   8. Hard blocks (13 kural)
 *   9. Soft blocks (6 kural)
 *  10. Bucket lookup + goThreshold hesabı
 *  11. Drawdown protocol min score gate
 *  12. ATR regime adj
 *  13. Verdict: hard block → 'no', soft block + skor → 'wait', skor yeterli → 'go'
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const {
    pair,
    px,
    px4h,
    px15,
    ema21_15m,
    ema50_1h,
    ema200_1h,
    ema50_4h,
    ema200_4h,
    rsi,
    adx,
    bbPct,
    vwap,
    volRatio,
    fundingRate,
    atrPercentile,
    adx4h,
    ema21_1h,
    closes1h,
    volumes1h,
    srModifier,
    sweep15m,
    fg,
    last4hMovePct,
    timeQuality,
    eventSkipUntil,
    btcCooldownUntil,
    btcCooldownReason,
    btcSelfCooldownUntil,
    lockReleasedAt,
    openPositions,
    drawdownProtocol,
    trades,
    now,
  } = input;

  // ───── 1. Direction ─────
  const dirInput: DirectionInput = {
    px15,
    px1h: px,
    px4h,
    ema21_15m,
    ema50_1h,
    ema200_1h,
    ema50_4h,
  };
  const { direction, confidence: dirConfidence } = inferDirection(dirInput);

  // ───── 2. Skor kategorileri ─────
  const trendResult = scoreTrend(direction, dirConfidence, px4h, ema200_4h);
  const counterTrend = trendResult.counterTrend;
  const adxResult = scoreAdx(adx);
  const rsiResult = scoreRsi(rsi, direction);
  const volResult = scoreVolume(volRatio);
  const bbResult = scoreBb(bbPct, direction);
  const vwapResult = scoreVwap(vwap, px, direction);
  const fundingResult = scoreFunding(fundingRate, direction);
  const macroResult = scoreMacro(fg, direction);

  const sub: ScoreSubScores = {
    trend: trendResult.score,
    adx: adxResult.score,
    rsi: rsiResult.score,
    vol: volResult.score,
    bb: bbResult.score,
    vwap: vwapResult.score,
    funding: fundingResult.score,
    macro: macroResult.score,
  };

  // Adaptive regime-based weights composed with user-configured weights.
  // Regime detected pre-baseScore (no baseScore gate) so weights shape the score.
  // User weights from settings multiply on top: final = adaptive × user.
  const adaptiveRegime = detectRegimeForWeights(adx, dirConfidence, counterTrend, bbPct, direction);
  const adaptiveBase = computeAdaptiveWeights(adaptiveRegime, atrPercentile, fg);
  const userWeights = input.scorerWeights
    ? { ...DEFAULT_SCORER_WEIGHTS, ...input.scorerWeights }
    : DEFAULT_SCORER_WEIGHTS;
  const w = composeScorerWeights(adaptiveBase, userWeights);
  const maxWeighted =
    BASE_MAX.trend * w.trend + BASE_MAX.adx * w.adx + BASE_MAX.rsi * w.rsi +
    BASE_MAX.vol * w.vol + BASE_MAX.bb * w.bb + BASE_MAX.vwap * w.vwap +
    BASE_MAX.funding * w.funding + BASE_MAX.macro * w.macro;
  const rawWeighted =
    sub.trend * w.trend + sub.adx * w.adx + sub.rsi * w.rsi +
    sub.vol * w.vol + sub.bb * w.bb + sub.vwap * w.vwap +
    sub.funding * w.funding + sub.macro * w.macro;
  const baseScore = maxWeighted > 0 ? (rawWeighted / maxWeighted) * 100 : 0;

  // ───── 3. Sweep bonus ─────
  const sweepRes = scoreSweepBonus(sweep15m, direction, baseScore);

  // ───── 4. Regime bonus ─────
  const regimeRes = scoreRegimeBonus({
    adx,
    dirConfidence,
    counterTrend,
    bbPct,
    baseScore,
    direction,
  });

  // ───── 5. Total ─────
  const oiBonus = input.oiVelocityScore ?? 0;

  // OI Divergence Faz 2: direction × OI rejimi → +3 (confirm) / -6 (diverge)
  const oiDivResult = computeOiDivergence(input.oiVelocityResult ?? null, direction);
  const oiDivergenceContrib =
    oiDivResult === "confirm" ? 3 : oiDivResult === "diverge" ? -6 : 0;

  // OI divergence gölge modda — total'e katılmıyor, sadece reasons/log için hesaplandı
  const total = Math.min(
    100,
    Math.max(0, baseScore + sweepRes.bonus + regimeRes.bonus + srModifier + oiBonus),
  );
  const score = Math.round(total);

  // ───── 6. Reasons obj baseline ─────
  const reasons: ScoreReasons = {
    trend: trendResult.reason,
    adx: adxResult.reason,
    rsi: rsiResult.reason,
    vol: volResult.reason,
    bb: bbResult.reason,
    vwap: vwapResult.reason,
    funding: fundingResult.reason,
    macro: macroResult.reason,
  };
  if (sweepRes.reason) reasons.sweep = sweepRes.reason;
  if (regimeRes.reason) reasons.regime = regimeRes.reason;
  if (oiDivResult === "confirm") {
    reasons.oiDivergence = `✅ OI onaylıyor (${(input.oiVelocityResult?.regime ?? "").replace(/_/g, " ")}) → +3`;
  } else if (oiDivResult === "diverge") {
    reasons.oiDivergence = `⚠️ OI diverjans (${(input.oiVelocityResult?.regime ?? "").replace(/_/g, " ")}) → -6`;
  }
  if (regimeRes.regime === "trending_strong" && (direction === "LONG" || direction === "SHORT")) {
    reasons.regimeRelax = `🔥 Trending strong regime · RSI threshold ${direction === "LONG" ? "75→80" : "25→20"} relaxed`;
  }

  // ───── 7. VolBreakout override (BB hard iptal için) ─────
  const trend4hUp = ema50_4h !== null && px4h > ema50_4h;
  const trend4hDown = ema50_4h !== null && px4h < ema50_4h;
  const volBreakout = checkVolBreakoutOverride({
    direction,
    volRatio,
    adx,
    baseScore,
    last4hMovePct,
    trend4hUp,
    trend4hDown,
  });
  if (volBreakout.reason) reasons.volBreakout = volBreakout.reason;

  // ───── 8. Hard blocks ─────
  const blocks: string[] = [];
  const overext = checkOverextended({ direction, rsi, bbPct, vwap, px });
  if (overext) blocks.push(overext);
  const neutral = checkNeutralDirection(direction);
  if (neutral) blocks.push(neutral);
  const ct = checkCounterTrend(counterTrend);
  if (ct) blocks.push(ct);
  const adxBlock = checkAdxWeakOrTired(adx);
  if (adxBlock) blocks.push(adxBlock);
  const rsiBlock = checkRsiExtreme({ rsi, direction, regime: regimeRes.regime });
  if (rsiBlock) blocks.push(rsiBlock);
  const bbBlocks = checkBbOutOfBand(bbPct, volBreakout.active);
  for (const b of bbBlocks) blocks.push(b);
  const vwapBlock = checkVwapExtreme(vwap, px);
  if (vwapBlock) blocks.push(vwapBlock);
  const srHardBlockMsg = checkSrHardBlock({
    direction,
    rsi,
    nearestResistance: input.srNearestResistance ?? null,
    nearestSupport: input.srNearestSupport ?? null,
    breakoutOverride: input.srBreakoutOverride ?? false,
  });
  if (srHardBlockMsg) {
    blocks.push(srHardBlockMsg);
    reasons.srHardBlock = srHardBlockMsg;
  }
  const volBlock = checkVolumeLow(volRatio);
  if (volBlock) blocks.push(volBlock);
  const fundingBlock = checkFundingExtreme(fundingRate);
  if (fundingBlock) blocks.push(fundingBlock);
  const tqBlock = checkTimeQuality(timeQuality);
  if (tqBlock) blocks.push(tqBlock);
  const eventBlock = checkEventSkip({ eventSkipUntil, now });
  if (eventBlock) blocks.push(eventBlock);
  const btcCdBlock = checkBtcCooldown({
    pair,
    btcCooldownUntil,
    btcCooldownReason,
    now,
  });
  if (btcCdBlock) blocks.push(btcCdBlock);
  const btcSelfCd = checkBtcSelfCooldown({
    pair,
    btcSelfCooldownUntil,
    btcCooldownReason,
    now,
  });
  if (btcSelfCd) blocks.push(btcSelfCd);

  // ───── 9. Soft blocks ─────
  const softBlocks: string[] = [];
  const fundingCrowded = checkFundingCrowded(fundingRate, direction);
  if (fundingCrowded) softBlocks.push(fundingCrowded);
  const lockRamp = checkLockReleaseRamp({ lockReleasedAt, now });
  if (lockRamp.message) softBlocks.push(lockRamp.message);
  const corrCluster = checkCorrelationCluster({
    pair,
    direction,
    openPositions,
  });
  if (corrCluster) softBlocks.push(corrCluster);
  const atrReg = checkAtrRegime({ percentile: atrPercentile });
  if (atrReg.softBlock) softBlocks.push(atrReg.softBlock);
  if (atrReg.reason) reasons.atrRegime = atrReg.reason;

  const dailyOpposite = checkDailyTrendOpposite({ direction, px, ema50_1d: input.ema50_1d });
  if (dailyOpposite) {
    softBlocks.push(dailyOpposite);
  } else if (input.ema50_1d === null) {
    softBlocks.push("📅 Günlük trend bilinmiyor — 1D veri yok (EMA50_1D hesaplanamadı)");
  }

  // ───── MTF trend gate ─────
  // 1h/4h/1d EMA20 trendi sinyalle net şekilde çelişiyorsa GO → WAIT.
  // mixed / no_data → geçir (blok yok).
  if (input.mtfResult) {
    const { cls } = input.mtfResult;
    const mtfOpposite =
      (direction === "LONG" && (cls === "down" || cls === "strong_down")) ||
      (direction === "SHORT" && (cls === "up" || cls === "strong_up"));
    if (mtfOpposite) {
      softBlocks.push("📅 MTF ters trend — günlük trend sinyale karşı");
    }
  }

  // POC (Point of Control) — gölge modda: soft block'a eklenmez, sadece reason'a kaydedilir
  if (input.poc && direction !== "NEUTRAL") {
    const poc = input.poc;
    if (direction === "LONG" && !poc.abovePoc) {
      const dist = Math.abs(poc.distancePct).toFixed(1);
      reasons.pocBlock = `📊 POC direnci — fiyat kurumsal maliyet altında (POC: ${poc.poc.toFixed(0)}, -%${dist}) (gölge)`;
    } else if (direction === "SHORT" && poc.abovePoc) {
      const dist = Math.abs(poc.distancePct).toFixed(1);
      reasons.pocBlock = `📊 POC desteği — fiyat kurumsal maliyet üstünde (POC: ${poc.poc.toFixed(0)}, +%${dist}) (gölge)`;
    }
  }

  // ───── 10. Bucket + goThreshold ─────
  // Panel davranışı (satır 7903): bucket baseScore üzerinden hesaplanır
  const bucket = getBucketStats(baseScore, trades);
  let goThreshold = bucket.isCut ? Math.min(96, bucket.max + 1) : 80;
  if (lockRamp.active) {
    goThreshold = Math.min(96, goThreshold + 5);
  }

  // ATR regime adj (panel satır 7937)
  goThreshold = Math.max(60, Math.min(96, goThreshold + atrReg.adj));

  // ── GÖLGE KAPILARI — threshold'u DEĞİŞTİRMEZ, sadece loglama için ──

  // BTC chop gate (gölge)
  const btcAdx = input.btcAdx1h ?? null;
  if (btcAdx !== null && btcAdx < 20) {
    reasons.chopGate = `📉 BTC chop rejimi — ADX ${btcAdx.toFixed(0)} < 20 (gölge)`;
  }

  // ATR optimal pencere kapısı (gölge) — atrReg.adj === 0 koşulu korunur
  const atrRatio = input.atrRatio ?? null;
  if (atrRatio !== null && atrReg.adj === 0) {
    if (atrRatio > 1.20) {
      reasons.atrRatioGate = `📊 ATR genişleme (${(atrRatio * 100).toFixed(0)}% > 120%) — dur mesafesi geniş (gölge)`;
    } else if (atrRatio < 0.80) {
      reasons.atrRatioGate = `📊 ATR sıkışma (${(atrRatio * 100).toFixed(0)}% < 80%) — mean-reversion rejimi (gölge)`;
    }
  }

  // NOT: Eski shadow-only "zaman kalitesi kapısı" (00:00-04:00 UTC Asya +
  // 12:00 UTC Londra→NY geçişi, reasons.timeGate) buradan KALDIRILDI —
  // checkTimeQuality() artık lib/market/timeQuality.ts ile beslenip GERÇEK bir
  // hard block olarak aktif (bkz. §8 hard block bloğu, satır ~535 civarı).
  // İkisini paralel tutmak, farklı saat sınırlarına sahip iki ayrı "zaman
  // sinyali" göstererek kafa karıştırırdı (biri artık gerçekten bloklarken
  // diğeri hâlâ sadece gölge/log olurdu) — eski shadow gate'in tek amacı zaten
  // "gerçek blok yapmaya değer mi" diye gözlemlemekti, bu amaç artık gerçek
  // hard block ile karşılandı. Londra→NY geçişi (12:00 UTC) sinyali bu
  // kaldırmayla kayboldu — hiçbir yerde bloklamıyordu, salt gözlem amaçlıydı.

  // BTC S/R proximity gate (gölge)
  if (input.btcNearSR && pair !== "BTC") {
    reasons.btcSrGate = `⚡ BTC S/R yakını (≤%0.5) (gölge)`;
  }

  // Drawdown protocol min score gate (panel satır 7947-7952)
  if (drawdownProtocol.tier !== "normal" && drawdownProtocol.minScore > goThreshold) {
    const oldThreshold = goThreshold;
    goThreshold = Math.min(96, drawdownProtocol.minScore);
    reasons.drawdownGate = `${drawdownProtocol.label} ${drawdownProtocol.reason} → threshold ${oldThreshold}→${goThreshold}`;
  }

  // ── Gölge kapı tetiklenme logu ──
  const triggeredShadowGates: string[] = [];
  if (reasons.chopGate) triggeredShadowGates.push("chopGate");
  if (reasons.atrRatioGate) triggeredShadowGates.push("atrRatioGate");
  if (reasons.btcSrGate) triggeredShadowGates.push("btcSrGate");
  if (reasons.pocBlock) triggeredShadowGates.push("pocBlock");
  if (oiDivResult === "diverge") triggeredShadowGates.push("oiDivergence:diverge");
  else if (oiDivResult === "confirm") triggeredShadowGates.push("oiDivergence:confirm");

  // ───── 10b. Pullback engine (paket #5e) ─────
  const pullback = detectPullbackSetup({
    direction,
    px4h,
    ema50_4h,
    ema50_1h,
    ema21_1h,
    closes1h,
    volumes1h,
    adx4h,
    rsi1h: rsi,
    sweep15m,
    fg,
    baseScore,
  });
  if (pullback.reason) reasons.pullback = pullback.reason;

  // pullbackThreshold hesabı (panel satır 7958-7966)
  // Formül: max(65, min(96, 72 + atrAdj + (drawdown delta) + (lockRamp ? 5 : 0)))
  let pullbackThreshold = goThreshold;
  if (pullback.active) {
    const drawdownDelta =
      drawdownProtocol.tier !== "normal" ? drawdownProtocol.minScore - 80 : 0;
    pullbackThreshold = Math.max(
      65,
      Math.min(
        96,
        PULLBACK_CONSTANTS.PULLBACK_THRESHOLD +
          atrReg.adj +
          drawdownDelta +
          (lockRamp.active ? 5 : 0),
      ),
    );
    reasons.pullbackThreshold = `🔄 Pullback threshold ${pullbackThreshold} (classic ${goThreshold})`;
  }

  // Etkin eşik
  const effectiveThreshold = pullback.active ? pullbackThreshold : goThreshold;

  // ───── 11. Verdict ─────
  let verdict: Verdict;
  if (blocks.length > 0) {
    verdict = "no";
  } else if (softBlocks.length > 0 && total >= effectiveThreshold) {
    verdict = "wait";
  } else if (total >= effectiveThreshold) {
    verdict = "go";
  } else if (total >= 65) {
    verdict = "wait";
  } else {
    verdict = "no";
  }

  // ───── 11b. Hysteresis smoothing (bkz. applyHysteresis, HYSTERESIS_MARGIN placeholder) ─────
  const hysteresisResult = applyHysteresis(verdict, input.prevVerdict, total, effectiveThreshold, blocks, softBlocks);
  verdict = hysteresisResult.verdict;
  if (hysteresisResult.smoothed) {
    reasons.hysteresis = `🔁 Hysteresis: prevVerdict=go, total ${total.toFixed(1)} (eşik ${effectiveThreshold}, tampon ${HYSTERESIS_MARGIN}) → go korundu`;
  }

  // ───── 12. Adaptive cut explanation (panel satır 7985) ─────
  if (
    bucket.isCut &&
    baseScore >= 80 &&
    baseScore < goThreshold &&
    bucket.wr !== null
  ) {
    reasons.adaptiveCut = `Skor ${baseScore} ama ${bucket.min}-${bucket.max} bucket WR ${bucket.wr.toFixed(0)}% (n=${bucket.n}) weak → ${goThreshold}+ needed`;
  }

  // Soft block summary
  if (softBlocks.length > 0 && total >= effectiveThreshold) {
    reasons.softBlock = softBlocks.join(" · ");
  }

  // Lock ramp mesajı (panel satır 7997-8000) — düşük skorda da göster
  if (lockRamp.active && lockReleasedAt !== null) {
    const hoursSince = ((now - lockReleasedAt) / 3600000).toFixed(1);
    reasons.lockRamp = `🔓 Lock released ${hoursSince}h ago — score ${goThreshold}+ needed (normal: 80, ramp: +5)`;
  }

  // Overextended detail (UI için)
  let overextFlags = 0;
  if (overext) {
    const flagsCount = (overext.match(/,/g) || []).length + 1;
    overextFlags = flagsCount;
  }

  return {
    pair,
    score,
    baseScore,
    total,
    verdict,
    direction,
    dirConfidence,
    counterTrend,
    sub,
    reasons,
    blocks,
    softBlocks,
    sweepBonus: sweepRes.bonus,
    regimeBonus: regimeRes.bonus,
    regime: regimeRes.regime,
    goThreshold,
    bucket,
    srModifier,
    atrRegimeAdj: atrReg.adj,
    volBreakoutActive: volBreakout.active,
    oiDivergenceContrib,
    signalType: pullback.signalType,
    pullbackActive: pullback.active,
    pullbackThreshold,
    effectiveThreshold,
    overextFlags,
    triggeredShadowGates,
  };
}
