import type { Pair } from "./pairs";

export type PairCategory = "L1" | "DeFi" | "Meme" | "Infra";

export const PAIR_CATEGORY: Partial<Record<Pair, PairCategory>> = {
  BTC:    "L1",
  ETH:    "L1",
  SOL:    "L1",
  AVAX:   "L1",
  NEAR:   "L1",
  SUI:    "L1",
  LINK:   "DeFi",
  BNB:    "Infra",
  XRP:    "L1",
};
