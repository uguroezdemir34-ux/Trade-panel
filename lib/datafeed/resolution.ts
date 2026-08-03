/**
 * Resolution mapper — TradingView ↔ OKX ↔ App Timeframe.
 *
 * TV uses numeric minute strings for intraday ("1", "5", "15", "60", "240")
 * and "1D" for daily. OKX uses "1m", "5m", "15m", "1H", "4H", "1D".
 */

import type { Timeframe } from "@/lib/okx/candles";

/** TV resolution string → OKX bar parameter */
const TV_TO_OKX: Record<string, string> = {
  "1":   "1m",
  "5":   "5m",
  "15":  "15m",
  "60":  "1H",
  "240": "4H",
  "1D":  "1D",
};

/** TV resolution string → App Timeframe */
const TV_TO_TF: Record<string, Timeframe> = {
  "1":   "1m",
  "5":   "5m",
  "15":  "15m",
  "60":  "1h",
  "240": "4h",
  "1D":  "1d",
};

/** App Timeframe → TV resolution string */
const TF_TO_TV: Record<Timeframe, string> = {
  "1m":  "1",
  "5m":  "5",
  "15m": "15",
  "1h":  "60",
  "4h":  "240",
  "1d":  "1D",
  // Bu datafeed modülü şu an hiçbir yerde kullanılmıyor (grep ile doğrulandı —
  // grafik sayfası PriceChart.tsx/lightweight-charts'ı doğrudan kullanıyor,
  // bu TradingView UDF datafeed'i değil) — sadece Record<Timeframe,...>
  // zorunluluğunu (TS derleyicisi) karşılamak için eklendi, TV'nin gerçek
  // "1W" haftalık resolution konvansiyonuyla tutarlı.
  "1w":  "1W",
};

/** Milliseconds per bar for each TV resolution (used for countBack → fromMs). */
const MS_PER_TV: Record<string, number> = {
  "1":   60_000,
  "5":   300_000,
  "15":  900_000,
  "60":  3_600_000,
  "240": 14_400_000,
  "1D":  86_400_000,
};

/** All resolutions this datafeed declares as supported. */
export const SUPPORTED_RESOLUTIONS: string[] = ["1", "5", "15", "60", "240", "1D"];

/**
 * Convert TV resolution → OKX bar string.
 * Returns null for unsupported resolutions.
 */
export function toOkxBar(tvResolution: string): string | null {
  return TV_TO_OKX[tvResolution] ?? null;
}

/**
 * Convert TV resolution → App Timeframe.
 * Returns null for unsupported resolutions.
 */
export function toTimeframe(tvResolution: string): Timeframe | null {
  return TV_TO_TF[tvResolution] ?? null;
}

/** Convert App Timeframe → TV resolution string. */
export function toTvResolution(tf: Timeframe): string {
  return TF_TO_TV[tf];
}

/**
 * Milliseconds per bar for a given TV resolution.
 * Falls back to 60_000 (1m) for unknown resolutions.
 */
export function msPerBar(tvResolution: string): number {
  return MS_PER_TV[tvResolution] ?? 60_000;
}

/**
 * OKX candle WS channel name for a TV resolution.
 * e.g. "60" → "candle1H"
 */
export function toOkxWsChannel(tvResolution: string): string | null {
  const bar = TV_TO_OKX[tvResolution];
  if (!bar) return null;
  // OKX WS channel prefix: "candle" + bar
  // "1m" → "candle1m", "1H" → "candle1H", "1D" → "candle1D"
  return `candle${bar}`;
}
