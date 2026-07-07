import type { Pair } from "./pairs";

export type PairCategory = "L1" | "DeFi" | "Meme" | "Infra";

export const PAIR_CATEGORY: Partial<Record<Pair, PairCategory>> = {
  BTC:    "L1",
  ETH:    "L1",
  XRP:    "L1",
  SOL:    "L1",
  ADA:    "L1",
  AVAX:   "L1",
  NEAR:   "L1",
  APT:    "L1",
  SUI:    "L1",
  TRX:    "L1",
  OP:     "L1",
  POL:    "L1",
  LINK:   "DeFi",
  PENDLE: "DeFi",
  DOGE:   "Meme",
  SHIB:   "Meme",
  WIF:    "Meme",
  PEPE:   "Meme",
  BNB:    "Infra",
  DOT:    "Infra",
  TAO:    "Infra",
};
