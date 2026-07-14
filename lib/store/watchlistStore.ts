import { create } from "zustand";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { loadFromStorage, saveToStorage } from "@/lib/store/persist";

function load(): Pair[] {
  if (typeof window !== "undefined") {
    try { localStorage.removeItem("quantix_watchlist_v1"); } catch {}
  }
  const loaded = loadFromStorage<Pair[]>("watchlist", []);
  // PAIRS'ten çıkarılmış bir coin localStorage'da kalmış olabilir —
  // hayalet kart olarak grid'de görünmesin diye burada eleniyor.
  return loaded.filter((p) => (PAIRS as readonly string[]).includes(p));
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
  moveToTop: (pair: Pair) => void;
  moveToBottom: (pair: Pair) => void;
  moveUp: (pair: Pair) => void;
  moveDown: (pair: Pair) => void;
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

  moveToTop: (pair) => {
    const current = get().pairs;
    if (!current.includes(pair)) return;
    const next = [pair, ...current.filter((p) => p !== pair)];
    save(next); set({ pairs: next });
  },

  moveToBottom: (pair) => {
    const current = get().pairs;
    if (!current.includes(pair)) return;
    const next = [...current.filter((p) => p !== pair), pair];
    save(next); set({ pairs: next });
  },

  moveUp: (pair) => {
    const current = get().pairs;
    const idx = current.indexOf(pair);
    if (idx <= 0) return;
    const next = [...current];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    save(next); set({ pairs: next });
  },

  moveDown: (pair) => {
    const current = get().pairs;
    const idx = current.indexOf(pair);
    if (idx < 0 || idx >= current.length - 1) return;
    const next = [...current];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    save(next); set({ pairs: next });
  },
}));
