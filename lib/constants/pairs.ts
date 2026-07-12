export const PAIRS = [
  "BTC",  // Bitcoin — market anchor
  "ETH",  // Ethereum — DeFi anchor
  "SOL",  // Solana — high-vol technicals
  "BNB",  // Binance Coin — exchange locomotive
  "LINK", // Chainlink — AI/data aligned
  "AVAX", // Avalanche — cycle patterns
  "NEAR", // Near Protocol — AI-aligned
  "SUI",  // Sui — emerging breakouts
] as const;

export type Pair = (typeof PAIRS)[number];
