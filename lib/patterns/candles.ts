/**
 * CANDLE PATTERN DETECTION — Classical single and two-candle reversal patterns.
 *
 * All patterns operate on the last 2 confirmed candles from the 1h timeframe.
 * Thresholds are tuned for crypto (higher volatility than equities).
 */

import type { Candle } from "@/lib/okx/candles";

export type PatternBias = "bullish" | "bearish" | "neutral";

export interface CandlePattern {
  name: string;
  bias: PatternBias;
  strength: "weak" | "moderate" | "strong";
  description: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function body(c: Candle): number {
  return Math.abs(c.close - c.open);
}

function range(c: Candle): number {
  return c.high - c.low;
}

function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: Candle): boolean {
  return c.close > c.open;
}

function isBearish(c: Candle): boolean {
  return c.close < c.open;
}

// ── single candle ─────────────────────────────────────────────────────────────

function detectHammer(c: Candle): CandlePattern | null {
  const b = body(c);
  const r = range(c);
  const lw = lowerWick(c);
  const uw = upperWick(c);
  if (r === 0) return null;
  // Lower wick ≥ 2× body, upper wick < 30% of body, body ≥ 5% of range
  if (lw >= 2 * b && uw < 0.3 * b && b >= 0.05 * r) {
    const strength = lw >= 3 * b ? "strong" : "moderate";
    return {
      name: isBullish(c) ? "Hammer" : "Hanging Man",
      bias: "bullish",
      strength,
      description: "Uzun alt fitil — alıcılar düşükten fiyatı yukarı çekti",
    };
  }
  return null;
}

function detectShootingStar(c: Candle): CandlePattern | null {
  const b = body(c);
  const r = range(c);
  const uw = upperWick(c);
  const lw = lowerWick(c);
  if (r === 0) return null;
  // Upper wick ≥ 2× body, lower wick < 30% of body, body ≥ 5% of range
  if (uw >= 2 * b && lw < 0.3 * b && b >= 0.05 * r) {
    const strength = uw >= 3 * b ? "strong" : "moderate";
    return {
      name: "Shooting Star",
      bias: "bearish",
      strength,
      description: "Uzun üst fitil — satıcılar yüksekten fiyatı aşağı çekti",
    };
  }
  return null;
}

function detectDoji(c: Candle): CandlePattern | null {
  const b = body(c);
  const r = range(c);
  if (r === 0) return null;
  // Body < 5% of range
  if (b < 0.05 * r) {
    const uw = upperWick(c);
    const lw = lowerWick(c);
    let name = "Doji";
    if (uw > 2 * lw) name = "Gravestone Doji";
    else if (lw > 2 * uw) name = "Dragonfly Doji";
    return {
      name,
      bias: "neutral",
      strength: "weak",
      description: "Alıcı-satıcı dengesi — trend dönüşü sinyali olabilir",
    };
  }
  return null;
}

function detectMarubozu(c: Candle): CandlePattern | null {
  const b = body(c);
  const r = range(c);
  if (r === 0) return null;
  // Body ≥ 90% of range → almost no wicks
  if (b >= 0.9 * r) {
    const bias: PatternBias = isBullish(c) ? "bullish" : "bearish";
    return {
      name: `Marubozu ${bias === "bullish" ? "Boğa" : "Ayı"}`,
      bias,
      strength: "strong",
      description:
        bias === "bullish"
          ? "Güçlü alım baskısı — kapanış en tepede"
          : "Güçlü satış baskısı — kapanış en diptе",
    };
  }
  return null;
}

// ── two candle ────────────────────────────────────────────────────────────────

function detectEngulfing(prev: Candle, curr: Candle): CandlePattern | null {
  const prevBody = body(prev);
  const currBody = body(curr);
  if (prevBody === 0 || currBody === 0) return null;

  const bullish =
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open;

  const bearish =
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open;

  if (bullish) {
    return {
      name: "Boğa Yutan",
      bias: "bullish",
      strength: currBody >= 1.5 * prevBody ? "strong" : "moderate",
      description: "Önceki düşüş mumunu tamamen kapsayan yükseliş mumu",
    };
  }
  if (bearish) {
    return {
      name: "Ayı Yutan",
      bias: "bearish",
      strength: currBody >= 1.5 * prevBody ? "strong" : "moderate",
      description: "Önceki yükseliş mumunu tamamen kapsayan düşüş mumu",
    };
  }
  return null;
}

function detectPiercingDark(prev: Candle, curr: Candle): CandlePattern | null {
  const prevBody = body(prev);
  if (prevBody === 0) return null;
  const midpoint = (prev.open + prev.close) / 2;

  // Piercing line: bearish → bullish, opens below prev low, closes above midpoint
  if (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.low &&
    curr.close > midpoint &&
    curr.close < prev.open
  ) {
    return {
      name: "Delici Çizgi",
      bias: "bullish",
      strength: "moderate",
      description: "Önceki düşüş mumunun yarısını aşan yükseliş kapanışı",
    };
  }

  // Dark cloud cover: bullish → bearish, opens above prev high, closes below midpoint
  if (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.high &&
    curr.close < midpoint &&
    curr.close > prev.open
  ) {
    return {
      name: "Kara Bulut",
      bias: "bearish",
      strength: "moderate",
      description: "Önceki yükseliş mumunun yarısını kesen düşüş kapanışı",
    };
  }

  return null;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Detect patterns from the last confirmed candles.
 * Returns all detected patterns, strongest first.
 */
export function detectPatterns(candles: readonly Candle[]): CandlePattern[] {
  // Use only confirmed candles
  const confirmed = candles.filter((c) => c.confirm);
  if (confirmed.length < 2) return [];

  const curr = confirmed[confirmed.length - 1];
  const prev = confirmed[confirmed.length - 2];

  const found: CandlePattern[] = [];

  // Two-candle patterns take priority
  const eng = detectEngulfing(prev, curr);
  if (eng) found.push(eng);

  const pd = detectPiercingDark(prev, curr);
  if (pd) found.push(pd);

  // Single-candle on the latest closed candle
  const mar = detectMarubozu(curr);
  if (mar) found.push(mar);

  const ham = detectHammer(curr);
  if (ham) found.push(ham);

  const ss = detectShootingStar(curr);
  if (ss) found.push(ss);

  const doji = detectDoji(curr);
  if (doji) found.push(doji);

  // Sort: strong > moderate > weak
  const order = { strong: 0, moderate: 1, weak: 2 };
  return found.sort((a, b) => order[a.strength] - order[b.strength]);
}
