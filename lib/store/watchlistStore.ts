import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";

const STORAGE_KEY = "quantix_watchlist_v1";

function load(): Pair[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Pair[];
  } catch {
    return [];
  }
}

function save(pairs: Pair[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs)); } catch { /* ignore */ }
}

interface WatchlistState {
  pairs: Pair[];
  toggle: (pair: Pair) => void;
  has: (pair: Pair) => boolean;
  load: () => void;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  pairs: [],

  load: () => {
    set({ pairs: load() });
  },

  toggle: (pair) => {
    const current = get().pairs;
    const next = current.includes(pair)
      ? current.filter((p) => p !== pair)
      : [...current, pair];
    save(next);
    set({ pairs: next });
  },

  has: (pair) => get().pairs.includes(pair),
}));
