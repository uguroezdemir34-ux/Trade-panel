/**
 * ADAPTIVE SCORER WEIGHTS — Regime + volatility + macro overlay.
 *
 * Motivation: the 8 scoring categories have fixed default weights (1.0 each),
 * but their predictive reliability changes by market phase:
 *   - Trending markets: Trend/ADX alignment is most reliable
 *   - Ranging markets: BB/VWAP mean-reversion signals are most reliable
 *   - Volatility compression: pre-breakout setup — BB/VWAP > Volume
 *   - Extreme F&G: contrarian funding signal becomes stronger
 *
 * Academic basis: regime-conditional factor performance (Asness, Moskowitz &
 * Pedersen 2013; AQR style-timing research). ADX 25 as trend/range boundary
 * is the quantitative finance industry standard.
 *
 * Max baseScore stays 100 in all regimes — normalization in orchestrator
 * ensures this. Only the COMPOSITION of how the score is achieved changes.
 *
 * Design rule: adjustments stay within [0.7, 1.4] for the regime table,
 * overlays multiply on top but are clamped to [0.1, 3.0] total.
 */

import type { Regime } from "./scorers";

type Weights = {
  trend: number; adx: number; rsi: number; vol: number;
  bb: number; vwap: number; funding: number; macro: number;
};

/**
 * Detect market regime from pre-baseScore signals.
 *
 * Intentionally separate from scoreRegimeBonus in scorers.ts:
 * scoreRegimeBonus requires baseScore ≥ 75 to award a bonus (preventing
 * double-counting on weak setups). This function has no such gate — regime
 * must be known BEFORE weights are applied to compute baseScore.
 */
export function detectRegimeForWeights(
  adx: number | null,
  dirConfidence: number,
  counterTrend: boolean,
  bbPct: number | null,
  direction: "LONG" | "SHORT" | "NEUTRAL",
): Regime {
  if (adx === null || direction === "NEUTRAL") return "unknown";
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (adx >= 30 && dirConfidence === 3 && !counterTrend) return "trending_strong";
  if (adx >= 20 && adx < 30 && dirConfidence >= 2 && !counterTrend) return "trending_weak";
  if (adx < 20 && bbPct !== null) {
    if ((isLong && bbPct <= 0.25) || (isShort && bbPct >= 0.75)) return "ranging_meanrev";
    return "ranging";
  }
  if (adx >= 20 && adx < 25 && dirConfidence < 2) return "transitioning";
  return "mixed";
}

// ─── Regime weight tables ───────────────────────────────────────────────────
// Each row shifts category emphasis for that phase while keeping symmetry
// (trending boost = ranging penalty and vice versa).
const REGIME_WEIGHTS: Record<Regime, Weights> = {
  //                        trend  adx   rsi   vol   bb    vwap  fund  macro
  trending_strong: { trend: 1.4, adx: 1.3, rsi: 1.0, vol: 1.0, bb: 0.7, vwap: 0.7, funding: 1.0, macro: 0.9 },
  trending_weak:   { trend: 1.2, adx: 1.1, rsi: 1.0, vol: 1.0, bb: 0.8, vwap: 0.8, funding: 1.0, macro: 1.0 },
  ranging_meanrev: { trend: 0.7, adx: 0.8, rsi: 1.1, vol: 0.9, bb: 1.4, vwap: 1.3, funding: 1.0, macro: 1.0 },
  ranging:         { trend: 0.8, adx: 0.9, rsi: 1.0, vol: 0.9, bb: 1.2, vwap: 1.1, funding: 1.0, macro: 1.0 },
  transitioning:   { trend: 1.0, adx: 1.0, rsi: 1.0, vol: 1.0, bb: 1.0, vwap: 1.0, funding: 1.0, macro: 1.0 },
  mixed:           { trend: 1.0, adx: 1.0, rsi: 1.0, vol: 1.0, bb: 1.0, vwap: 1.0, funding: 1.0, macro: 1.0 },
  unknown:         { trend: 1.0, adx: 1.0, rsi: 1.0, vol: 1.0, bb: 1.0, vwap: 1.0, funding: 1.0, macro: 1.0 },
};

function clamp(v: number): number {
  return Math.max(0.1, Math.min(3.0, v));
}

/**
 * Compute adaptive base weights from regime + volatility regime + macro state.
 * Returns a weight object with the same shape as ScorerWeights.
 */
export function computeAdaptiveWeights(
  regime: Regime,
  atrPercentile: number | null,
  fg: number,
): Weights {
  const w = { ...REGIME_WEIGHTS[regime] };

  // ATR volatility overlay
  if (atrPercentile !== null) {
    if (atrPercentile < 20) {
      // Compression: mean-reversion setup forming — BB/VWAP up, volume unreliable
      w.vol  = clamp(w.vol  * 0.8);
      w.bb   = clamp(w.bb   * 1.2);
      w.vwap = clamp(w.vwap * 1.2);
    } else if (atrPercentile > 95) {
      // Extreme expansion: liquidation cascade risk — funding most informative
      w.funding = clamp(w.funding * 1.3);
    } else if (atrPercentile > 80) {
      // Expansion: trend continuation likely — trend stronger, volume noisier
      w.trend = clamp(w.trend * 1.1);
      w.vol   = clamp(w.vol   * 0.9);
    }
  }

  // F&G overlay: extreme readings amplify contrarian funding + macro signal
  if (fg < 20 || fg > 80) {
    w.funding = clamp(w.funding * 1.3);
    w.macro   = clamp(w.macro   * 1.2);
  }

  return w;
}

/**
 * Compose adaptive base weights with user-configured scorer weights.
 * User weights act as a multiplier ON TOP: final = adaptive × user.
 * Preserves user customization while regime adaptation applies as the base.
 */
export function composeScorerWeights(adaptive: Weights, user: Weights): Weights {
  return {
    trend:   clamp(adaptive.trend   * user.trend),
    adx:     clamp(adaptive.adx     * user.adx),
    rsi:     clamp(adaptive.rsi     * user.rsi),
    vol:     clamp(adaptive.vol     * user.vol),
    bb:      clamp(adaptive.bb      * user.bb),
    vwap:    clamp(adaptive.vwap    * user.vwap),
    funding: clamp(adaptive.funding * user.funding),
    macro:   clamp(adaptive.macro   * user.macro),
  };
}
