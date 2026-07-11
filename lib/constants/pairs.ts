export const PAIRS = [
  "BTC",  // Bitcoin — market anchor
  "ETH",  // Ethereum — DeFi anchor
  "XRP",  // Ripple — global liquidity
  "SOL",  // Solana — high-vol technicals
  "BNB",  // Binance Coin — exchange locomotive
  "ADA",  // Cardano — long-term trend
  "AVAX", // Avalanche — cycle patterns
  "LINK", // Chainlink — AI/data aligned
  "DOGE", // Dogecoin — momentum spikes
  "SHIB", // Shiba Inu — whale flows
  "SUI",  // Sui — emerging breakouts
  "NEAR", // Near Protocol — AI-aligned
] as const;

export type Pair = (typeof PAIRS)[number];
