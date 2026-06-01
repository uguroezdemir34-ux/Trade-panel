import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import type { Verdict } from "@/lib/score/orchestrator";
import type { Direction } from "@/lib/score/direction";

const MAX_SNAPSHOTS = 50;
const STORAGE_KEY = "quantix_sh_v1";

export interface ScoreSnapshot {
  score: number;
  verdict: Verdict;
  direction: Direction;
  ts: number;
}

interface ScoreHistoryState {
  history: Partial<Record<Pair, ScoreSnapshot[]>>;
  addSnapshot: (pair: Pair, snapshot: ScoreSnapshot) => void;
  clearAll: () => void;
}

function loadHistory(): Partial<Record<Pair, ScoreSnapshot[]>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<Pair, ScoreSnapshot[]>>;
  } catch {
    return {};
  }
}

function saveHistory(history: Partial<Record<Pair, ScoreSnapshot[]>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage full — skip persist
  }
}

export const useScoreHistoryStore = create<ScoreHistoryState>((set) => {
  // Hydrate from localStorage on client
  if (typeof window !== "undefined") {
    setTimeout(() => {
      const loaded = loadHistory();
      if (Object.keys(loaded).length > 0) {
        set({ history: loaded });
      }
    }, 0);
  }

  return {
    history: {},

    addSnapshot: (pair, snapshot) =>
      set((s) => {
        const prev = s.history[pair] ?? [];
        // Deduplicate: skip if last snapshot has same ts (double-render guard)
        if (prev.length > 0 && prev[prev.length - 1].ts === snapshot.ts) {
          return s;
        }
        const updated = [...prev, snapshot].slice(-MAX_SNAPSHOTS);
        const nextHistory = { ...s.history, [pair]: updated };
        // Persist every 5 new snapshots to avoid thrashing localStorage
        if (updated.length % 5 === 0) {
          saveHistory(nextHistory);
        }
        return { history: nextHistory };
      }),

    clearAll: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      set({ history: {} });
    },
  };
});
