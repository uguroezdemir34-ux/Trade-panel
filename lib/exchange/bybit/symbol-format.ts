import type { Pair } from "@/lib/constants/pairs";

export function pairToSymbol(pair: Pair): string {
  return `${pair}USDT`; // "BTC" → "BTCUSDT"
}
