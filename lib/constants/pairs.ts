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
