import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import { loadFromStorage, saveToStorage } from "@/lib/store/persist";

function load(): Pair[] {
  if (typeof window !== "undefined") {
    try { localStorage.removeItem("quantix_watchlist_v1"); } catch {}
  }
  return loadFromStorage<Pair[]>("watchlist", []);
}

function save(pairs: Pair[]): void {
  saveToStorage("watchlist", pairs);
}

interface WatchlistState {
  pairs: Pair[];
  toggle: (pair: Pair) => void;
  remove: (pair: Pair) => void;
  reset: () => void;
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

  remove: (pair) => {
    const next = get().pairs.filter((p) => p !== pair);
    save(next);
    set({ pairs: next });
  },

  reset: () => {
    save([]);
    set({ pairs: [] });
  },

  has: (pair) => get().pairs.includes(pair),
}));
