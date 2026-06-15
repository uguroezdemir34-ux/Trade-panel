export const PAIRS = [
  "BTC",  // Bitcoin — market anchor
  "ETH",  // Ethereum — DeFi anchor
  "XRP",  // Ripple — global liquidity
  "SOL",  // Solana — high-vol technicals
  "BNB",  // Binance Coin — exchange locomotive
  "ADA",  // Cardano — long-term trend
  "AVAX", // Avalanche — cycle patterns
  "DOT",  // Polkadot — clean structure
  "LINK", // Chainlink — AI/data aligned
  "POL",  // Polygon — L2 volume
  "DOGE", // Dogecoin — momentum spikes
  "SHIB", // Shiba Inu — whale flows
  "SUI",  // Sui — emerging breakouts
  "NEAR", // Near Protocol — AI-aligned
  "TRX",  // TRON — top-5 OKX perp volume, strong trend structure
] as const;

export type Pair = (typeof PAIRS)[number];
