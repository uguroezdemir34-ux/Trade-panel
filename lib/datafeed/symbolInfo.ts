/**
 * Symbol helpers — resolveSymbol + searchSymbols logic.
 *
 * pricescale is derived from the current live price in marketStore so TV's
 * axis precision matches what the rest of the panel uses (formatTickPrice tiers).
 */

import type { LibrarySymbolInfo, SearchSymbolResultItem } from "./types";
import { SUPPORTED_RESOLUTIONS } from "./resolution";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useMarketStore } from "@/lib/store/marketStore";

/** "BTCUSDT.P" | "BTCUSDT" | "BTC/USDT" | "BTC" → "BTC" | null */
export function parsePair(symbolName: string): Pair | null {
  const upper = symbolName
    .toUpperCase()
    .replace(/\/USDT\.P$/, "")
    .replace(/USDT\.P$/, "")
    .replace(/\/USDT$/, "")
    .replace(/USDT$/, "")
    .replace(/\.P$/, "")
    .trim();
  return (PAIRS as readonly string[]).includes(upper) ? (upper as Pair) : null;
}

/**
 * Mirrors formatTickPrice tiers from lib/i18n/format.ts.
 * Returns pricescale = 10^precision for TV LibrarySymbolInfo.
 */
function pricescaleFor(price: number): number {
  if (price < 0.001)  return 100_000_000; // 8 decimals
  if (price < 0.01)   return 1_000_000;   // 6 decimals
  if (price < 1)      return 10_000;       // 4 decimals
  if (price < 100)    return 1_000;        // 3 decimals
  if (price < 10_000) return 100;          // 2 decimals
  return 1;                                // 0 decimals
}

/**
 * Build a LibrarySymbolInfo for the given pair.
 * Called synchronously from resolveSymbol — marketStore.getState() works
 * outside React context via Zustand's static API.
 */
export function buildSymbolInfo(pair: Pair): LibrarySymbolInfo {
  const ticker = `${pair}USDT.P`;
  const lastPrice = useMarketStore.getState().prices[pair]?.last ?? 1_000;
  const pricescale = pricescaleFor(lastPrice);

  return {
    name: ticker,
    full_name: `${pair}/USDT Perpetual`,
    description: `${pair}/USDT Perpetual (OKX)`,
    type: "crypto",
    session: "24x7",
    timezone: "Etc/UTC",
    exchange: "OKX",
    listed_exchange: "OKX",
    format: "price",
    pricescale,
    minmov: 1,
    volume_precision: 2,
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: false,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    data_status: "streaming",
    ticker,
  };
}

/**
 * Filter PAIRS by user input for TV's searchSymbols.
 * Matches on pair name prefix or full "PAIRUSDT" prefix.
 */
export function buildSearchResults(userInput: string): SearchSymbolResultItem[] {
  const q = userInput.trim().toUpperCase();
  if (q.length === 0) {
    return PAIRS.map(toResultItem);
  }
  return PAIRS
    .filter((p) => p.startsWith(q) || `${p}USDT`.startsWith(q) || `${p}USDT.P`.startsWith(q))
    .map(toResultItem);
}

function toResultItem(p: Pair): SearchSymbolResultItem {
  return {
    symbol: `${p}USDT.P`,
    full_name: `${p}/USDT Perpetual`,
    description: `${p}/USDT Perpetual (OKX)`,
    exchange: "OKX",
    type: "crypto",
    ticker: `${p}USDT.P`,
  };
}
