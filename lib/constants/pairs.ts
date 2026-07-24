export const PAIRS = [
  "BTC",  // Bitcoin — market anchor
  "ETH",  // Ethereum — DeFi anchor
  "SOL",  // Solana — high-vol technicals
  "BNB",  // Binance Coin — exchange locomotive
  "LINK", // Chainlink — AI/data aligned
  "SUI",  // Sui — emerging breakouts
  "AVAX", // Avalanche — cycle patterns
  "NEAR", // Near Protocol — AI-aligned
  "XRP",  // Ripple — high liquidity, cross-border
] as const;

export type Pair = (typeof PAIRS)[number];

/**
 * Borsadan gelen ham bir sembolün skorlanan pariteler arasında olup olmadığını
 * kontrol eder. Position.pair artık string (bkz. lib/okx/positions.ts) —
 * borsada açık her pozisyon panelde GÖRÜNÜR (guardrail dahil), ama sadece
 * bu kontrolden geçenler skor/AI-karşılaştırma alır.
 */
export function isSupportedPair(pair: string): pair is Pair {
  return (PAIRS as readonly string[]).includes(pair);
}
