/**
 * SKOR HESAPLAYICILARI — v55.51 panel ile birebir.
 * Kaynak: panel_v55_51.html satır 7335-7592.
 *
 * 8 ana kategori (toplam 100 pts):
 *   A) Trend (25)    — MTF EMA alignment, dirConfidence'a bağlı
 *   B) ADX   (15)    — 1H ADX gücü
 *   C) RSI   (10)    — Momentum, direction-aware
 *   D) Volume (15)   — Hacim teyidi
 *   E) BB    (10)    — Bollinger pozisyonu
 *   F) VWAP  (10)    — Sigma uzaklık
 *   G) Funding (8)   — Contrarian sinyal
 *   H) Macro (7)     — F&G index
 *
 * + 2 bonus (additive, baseScore ≥ 75 gate'i):
 *   - Sweep bonus (0-3) — 15m sweep + yön + strength
 *   - Regime synergy bonus (0-3) — rejim tespiti + setup uyumu
 *
 * Her scorer saf fonksiyon. Reason string ayrı döner — UI/Telegram'da kullanılır.
 *
 * KRİTİK: Her eşik DEĞİŞTİRİLMEMELİ. Bunlar panelin uzun süre kalibrasyonu.
 */

import type { Direction } from "./direction";

export interface ScoreReason {
  score: number;
  reason: string;
}

// ───────── A) MTF TREND (25 pts) ─────────

export function scoreTrend(
  direction: Direction,
  dirConfidence: number,
  px4h: number,
  ema200_4h: number | null,
): { score: number; reason: string; counterTrend: boolean } {
  let score = 0;
  let reason = "—";
  let counterTrend = false;

  if (dirConfidence === 3) {
    score = 25;
    reason = direction === "LONG" ? "Full Bull (4H+1H+15M)" : "Full Bear (4H+1H+15M)";
  } else if (dirConfidence === 2) {
    score = 18;
    reason = direction === "LONG" ? "Bull (4H+1H)" : "Bear (4H+1H)";
  } else if (direction === "NEUTRAL") {
    score = 0;
    reason = "Mixed / Sideways";
  }

  // 4H EMA200 counter-trend tespiti
  if (ema200_4h !== null && (direction === "LONG" || direction === "SHORT")) {
    const above200 = px4h > ema200_4h;
    if (direction === "LONG" && !above200) {
      counterTrend = true;
      reason = `${reason} 🚫 4H EMA200 below (counter-trend)`;
    } else if (direction === "SHORT" && above200) {
      counterTrend = true;
      reason = `${reason} 🚫 4H EMA200 above (counter-trend)`;
    } else {
      reason = `${reason} ✓ 4H EMA200 aligned`;
    }
  }
  return { score, reason, counterTrend };
}

// ───────── B) ADX (15 pts) ─────────

export function scoreAdx(adx: number | null): ScoreReason {
  if (adx === null) return { score: 0, reason: "—" };
  if (adx >= 25 && adx <= 40)
    return { score: 15, reason: `Strong (${adx.toFixed(0)})` };
  if (adx >= 20 && adx < 25)
    return { score: 9, reason: `Developing (${adx.toFixed(0)})` };
  if (adx > 40 && adx <= 50)
    return { score: 0, reason: `⚠️ Tired (${adx.toFixed(0)}) - late` };
  if (adx < 20) return { score: 0, reason: `Weak (${adx.toFixed(0)}) - range` };
  return { score: 0, reason: `⚠️ Over-extended (${adx.toFixed(0)})` };
}

// ───────── C) RSI (10 pts, direction-aware) ─────────

export function scoreRsi(
  rsi: number | null,
  direction: Direction,
): ScoreReason {
  if (rsi === null) return { score: 0, reason: "—" };
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (isLong) {
    if (rsi >= 50 && rsi <= 60)
      return { score: 10, reason: `Healthy (${rsi.toFixed(0)})` };
    if (rsi > 60 && rsi <= 65)
      return { score: 7, reason: `Strong (${rsi.toFixed(0)})` };
    if (rsi >= 45 && rsi < 50)
      return { score: 6, reason: `Tired (${rsi.toFixed(0)})` };
    if (rsi > 65 && rsi <= 70)
      return { score: 3, reason: `Near extreme (${rsi.toFixed(0)})` };
    if (rsi > 70)
      return { score: 0, reason: `⚠️ Overbought (${rsi.toFixed(0)}) - late` };
    if (rsi < 45 && rsi >= 35)
      return { score: 4, reason: `Weak (${rsi.toFixed(0)})` };
    return { score: 0, reason: `Direction conflict (${rsi.toFixed(0)})` };
  }

  if (isShort) {
    if (rsi >= 40 && rsi <= 50)
      return { score: 10, reason: `Healthy (${rsi.toFixed(0)})` };
    if (rsi >= 35 && rsi < 40)
      return { score: 7, reason: `Strong (${rsi.toFixed(0)})` };
    if (rsi > 50 && rsi <= 55)
      return { score: 6, reason: `Tired (${rsi.toFixed(0)})` };
    if (rsi >= 30 && rsi < 35)
      return { score: 3, reason: `Near extreme (${rsi.toFixed(0)})` };
    if (rsi < 30)
      return { score: 0, reason: `⚠️ Oversold (${rsi.toFixed(0)}) - late` };
    if (rsi > 55 && rsi <= 65)
      return { score: 4, reason: `Weak (${rsi.toFixed(0)})` };
    return { score: 0, reason: `Direction conflict (${rsi.toFixed(0)})` };
  }

  return { score: 0, reason: `Direction unclear (${rsi.toFixed(0)})` };
}

// ───────── D) VOLUME (15 pts) ─────────

export function scoreVolume(volRatio: number | null): ScoreReason {
  if (volRatio === null) return { score: 0, reason: "—" };
  if (volRatio >= 1.5)
    return { score: 15, reason: `Strong (${volRatio.toFixed(2)}x)` };
  if (volRatio >= 1.0)
    return { score: 10, reason: `Healthy (${volRatio.toFixed(2)}x)` };
  if (volRatio >= 0.7)
    return { score: 3, reason: `Low (${volRatio.toFixed(2)}x)` };
  return { score: 0, reason: `⚠️ Very Low (${volRatio.toFixed(2)}x) - unconfirmed` };
}

// ───────── E) BB POSITION (10 pts, direction-aware) ─────────

export function scoreBb(
  bbPct: number | null,
  direction: Direction,
): ScoreReason {
  if (bbPct === null) return { score: 0, reason: "—" };
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (bbPct >= 0.35 && bbPct <= 0.65) return { score: 10, reason: "Mid Band" };
  if (isLong && bbPct >= 0.15 && bbPct < 0.35)
    return { score: 8, reason: "Lower-Mid (LONG good)" };
  if (isShort && bbPct > 0.65 && bbPct <= 0.85)
    return { score: 8, reason: "Upper-Mid (SHORT good)" };
  if (isLong && bbPct > 0.65 && bbPct <= 0.8)
    return { score: 4, reason: "Upper-Mid (LONG late)" };
  if (isShort && bbPct < 0.35 && bbPct >= 0.2)
    return { score: 4, reason: "Lower-Mid (SHORT late)" };
  if (isLong && bbPct > 0.8 && bbPct < 0.97)
    return { score: 0, reason: "⚠️ Near Upper Band (LONG late)" };
  if (isShort && bbPct < 0.2 && bbPct > 0.03)
    return { score: 0, reason: "⚠️ Near Lower Band (SHORT late)" };
  return { score: 0, reason: "Out of Band (risk)" };
}

// ───────── F) VWAP (10 pts) ─────────

export interface VwapInput {
  vwap: number;
  stddev: number;
}

export function scoreVwap(
  vwap: VwapInput | null,
  px: number,
  direction: Direction,
): ScoreReason {
  if (vwap === null) return { score: 0, reason: "—" };
  const above = px > vwap.vwap;
  const distSigma =
    vwap.stddev > 0 ? Math.abs(px - vwap.vwap) / vwap.stddev : 0;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (isLong && above) {
    if (distSigma <= 1.0) return { score: 10, reason: "VWAP above (healthy)" };
    if (distSigma <= 1.3)
      return { score: 5, reason: `VWAP +${distSigma.toFixed(1)}σ` };
    if (distSigma <= 2.0)
      return { score: 0, reason: `⚠️ Too far +${distSigma.toFixed(1)}σ` };
    return { score: 0, reason: `🚫 Very far +${distSigma.toFixed(1)}σ` };
  }
  if (isShort && !above) {
    if (distSigma <= 1.0) return { score: 10, reason: "VWAP below (healthy)" };
    if (distSigma <= 1.3)
      return { score: 5, reason: `VWAP -${distSigma.toFixed(1)}σ` };
    if (distSigma <= 2.0)
      return { score: 0, reason: `⚠️ Too far -${distSigma.toFixed(1)}σ` };
    return { score: 0, reason: `🚫 Very far -${distSigma.toFixed(1)}σ` };
  }
  if (direction === "NEUTRAL") {
    return { score: 0, reason: above ? "VWAP above" : "VWAP below" };
  }
  // Direction VWAP ile çelişiyor
  return { score: 0, reason: "Direction conflicts with VWAP" };
}

// ───────── G) FUNDING (8 pts, contrarian) ─────────

export function scoreFunding(
  fundingRate: number | null,
  direction: Direction,
): ScoreReason {
  if (fundingRate === null) return { score: 0, reason: "N/A" };
  const fr = fundingRate * 100; // percent
  const absFr = Math.abs(fr);
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (absFr <= 0.02) {
    return {
      score: 8,
      reason: `${fr >= 0 ? "+" : ""}${fr.toFixed(3)}% (healthy)`,
    };
  }
  // Contrarian (avantaj)
  if (isLong && fr < -0.02) {
    return { score: 8, reason: `${fr.toFixed(3)}% (LONG opportunity, contrarian)` };
  }
  if (isShort && fr > 0.04) {
    return { score: 8, reason: `+${fr.toFixed(3)}% (SHORT opportunity, contrarian)` };
  }
  // Kalabalığa katılma (cezalı)
  if (isLong && fr > 0.04) {
    return { score: 1, reason: `+${fr.toFixed(3)}% (LONG crowded)` };
  }
  if (isShort && fr < -0.03) {
    return { score: 1, reason: `${fr.toFixed(3)}% (SHORT crowded)` };
  }
  return {
    score: 5,
    reason: `${fr >= 0 ? "+" : ""}${fr.toFixed(3)}% (neutral)`,
  };
}

// ───────── H) MACRO F&G (7 pts) ─────────

export function scoreMacro(
  fg: number,
  direction: Direction,
): ScoreReason {
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (fg >= 30 && fg <= 60) return { score: 7, reason: `F&G ${fg} (healthy)` };
  if (fg < 20)
    return {
      score: isLong ? 5 : 2,
      reason: `F&G ${fg} (extreme fear)`,
    };
  if (fg > 80)
    return {
      score: isShort ? 5 : 2,
      reason: `F&G ${fg} (extreme greed)`,
    };
  if (fg >= 20 && fg < 30) return { score: 4, reason: `F&G ${fg} (fear)` };
  if (fg > 60 && fg <= 80) return { score: 4, reason: `F&G ${fg} (greed)` };
  // Tam 20 değeri yukarıdaki dallara düşmez — panel davranışını koru, 0
  return { score: 0, reason: `F&G ${fg}` };
}

// ───────── BONUS 1: Sweep (0-3) ─────────

export interface SweepInput {
  /** 'bullish_sweep' | 'bearish_sweep' | null */
  type: "bullish_sweep" | "bearish_sweep" | null;
  /** Wick strength (0-1) */
  strength: number;
}

export function scoreSweepBonus(
  sweep15m: SweepInput,
  direction: Direction,
  baseScore: number,
): { bonus: number; reason: string | null; counted: boolean } {
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  const sweepDirOk =
    (sweep15m.type === "bullish_sweep" && isLong) ||
    (sweep15m.type === "bearish_sweep" && isShort);
  const sweepStrengthOk = sweep15m.strength >= 0.5;
  const sweepBaseOk = baseScore >= 75;
  const sweepConfirmed = sweep15m.type !== null;

  if (sweepDirOk && sweepStrengthOk && sweepBaseOk && sweepConfirmed) {
    const bonus = Math.round(3 * sweep15m.strength);
    const reason = isLong
      ? `Downward sweep (15m, str ${sweep15m.strength.toFixed(2)}, +${bonus} pts)`
      : `Upward sweep (15m, str ${sweep15m.strength.toFixed(2)}, +${bonus} pts)`;
    return { bonus, reason, counted: true };
  }
  if (sweepDirOk && (!sweepStrengthOk || !sweepBaseOk)) {
    const why = !sweepBaseOk
      ? `score ${baseScore}<75`
      : `weak wick str ${sweep15m.strength.toFixed(2)}<0.5`;
    const reason = isLong
      ? `Downward sweep 15m (${why}, bonus yok)`
      : `Upward sweep 15m (${why}, bonus yok)`;
    return { bonus: 0, reason, counted: false };
  }
  return { bonus: 0, reason: null, counted: false };
}

// ───────── BONUS 2: Regime Synergy (0-3) ─────────

export type Regime =
  | "trending_strong"
  | "trending_weak"
  | "ranging_meanrev"
  | "ranging"
  | "transitioning"
  | "mixed"
  | "unknown";

export interface RegimeInput {
  adx: number | null;
  dirConfidence: number;
  counterTrend: boolean;
  bbPct: number | null;
  baseScore: number;
  direction: Direction;
}

export function scoreRegimeBonus(input: RegimeInput): {
  regime: Regime;
  bonus: number;
  reason: string | null;
} {
  const { adx, dirConfidence, counterTrend, bbPct, baseScore, direction } = input;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (adx === null || !(isLong || isShort) || baseScore < 75) {
    return { regime: "unknown", bonus: 0, reason: null };
  }

  if (adx >= 30 && dirConfidence === 3 && !counterTrend) {
    return {
      regime: "trending_strong",
      bonus: 3,
      reason: `🔥 Trending strong (ADX ${adx.toFixed(0)}, 3TF aligned) · +3 synergy`,
    };
  }
  if (adx >= 20 && adx < 30 && dirConfidence >= 2 && !counterTrend) {
    return {
      regime: "trending_weak",
      bonus: 1,
      reason: `📈 Trending weak (ADX ${adx.toFixed(0)}) · +1 synergy`,
    };
  }
  if (adx < 20 && bbPct !== null) {
    const bbExtremeLong = isLong && bbPct <= 0.25;
    const bbExtremeShort = isShort && bbPct >= 0.75;
    if (bbExtremeLong || bbExtremeShort) {
      return {
        regime: "ranging_meanrev",
        bonus: 2,
        reason: `↔️ Ranging + BB extreme (ADX ${adx.toFixed(0)}) · +2 mean reversion`,
      };
    }
    return {
      regime: "ranging",
      bonus: 0,
      reason: `↔️ Ranging (ADX ${adx.toFixed(0)}) · BB mid, no bonus`,
    };
  }
  if (adx >= 20 && adx < 25 && dirConfidence < 2) {
    return {
      regime: "transitioning",
      bonus: 0,
      reason: `🔄 Transitioning (ADX ${adx.toFixed(0)}) · direction unclear, no bonus`,
    };
  }
  return { regime: "mixed", bonus: 0, reason: "⚪ Mixed regime · no bonus" };
}
