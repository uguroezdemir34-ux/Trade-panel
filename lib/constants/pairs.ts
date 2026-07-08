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
  "APT",  // Aptos — high-liquidity L1
  "TAO",  // Bittensor — AI narrative
  "PENDLE", // Pendle — DeFi yield
  "OP",   // Optimism — L2
  "WIF",  // Dogwifhat — meme/Solana
  "PEPE", // Pepe — meme/Ethereum
  "HYPE", // Hyperliquid — perp DEX L1
  "ONDO", // Ondo Finance — RWA/DeFi
  "TIA",  // Celestia — modular DA layer
  "JUP",  // Jupiter — Solana DEX aggregator
  "ENA",  // Ethena — synthetic dollar protocol
  "SEI",  // Sei — high-perf L1
] as const;

export type Pair = (typeof PAIRS)[number];
