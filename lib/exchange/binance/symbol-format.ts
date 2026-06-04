import type { Pair } from "@/lib/constants/pairs";

/**
 * Binance FAPI symbol format: BTCUSDT, ETHUSDT, etc.
 * POL (Polygon) → POLUSDT (Binance uses POL, not MATIC since renaming)
 */
export function pairToSymbol(pair: Pair): string {
  return `${pair}USDT`;
}
