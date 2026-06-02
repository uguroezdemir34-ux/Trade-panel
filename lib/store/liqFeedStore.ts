import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";

export interface LiqEvent {
  pair: Pair;
  price: number;
  /** USD notional — normalized across OKX / Binance / Bybit */
  notionalUsd: number;
  side: "long" | "short";
  ts: number;
  exchange?: "okx" | "binance" | "bybit";
}

const MAX_EVENTS_PER_PAIR = 900;
const EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface LiqFeedState {
  events: Partial<Record<Pair, LiqEvent[]>>;
  push: (event: LiqEvent) => void;
  prune: (now: number) => void;
}

export const useLiqFeedStore = create<LiqFeedState>((set) => ({
  events: {},

  push: (event) =>
    set((s) => {
      const prev = s.events[event.pair] ?? [];
      const updated = [...prev, event].slice(-MAX_EVENTS_PER_PAIR);
      return { events: { ...s.events, [event.pair]: updated } };
    }),

  prune: (now) =>
    set((s) => {
      const cutoff = now - EVENT_MAX_AGE_MS;
      const next: Partial<Record<Pair, LiqEvent[]>> = {};
      for (const [pair, evs] of Object.entries(s.events)) {
        const filtered = (evs as LiqEvent[]).filter((e) => e.ts >= cutoff);
        if (filtered.length > 0) next[pair as Pair] = filtered;
      }
      return { events: next };
    }),
}));
