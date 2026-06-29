import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import type { ScoreSubScores } from "@/lib/score/orchestrator";
import type { Regime } from "@/lib/score/scorers";

const MAX_ENTRIES = 200;
const STORAGE_KEY = "gosignal_log_v1";

export interface GoSignalEntry {
  ts: number;
  pair: Pair;
  direction: "LONG" | "SHORT";
  score: number;
  effectiveThreshold: number;
  triggerPriceAtGo: number;
  /** true when marketStore price was unavailable at capture time */
  priceWasStale?: boolean;
  pullbackActive: boolean;
  regime: Regime;
  sub: ScoreSubScores;
  sweepBonus: number;
  regimeBonus: number;
  blocks: string[];
  softBlocks: string[];
  /** Score engine version at signal time — undefined means pre-versioning (v0) */
  engineVersion?: string;
}

interface GoSignalLogState {
  entries: GoSignalEntry[];
  appendGoSignal: (entry: GoSignalEntry) => void;
  getAll: () => GoSignalEntry[];
  clear: () => void;
}

function loadEntries(): GoSignalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GoSignalEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: GoSignalEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full — skip persist
  }
}

export const useGoSignalLogStore = create<GoSignalLogState>((set, get) => {
  if (typeof window !== "undefined") {
    setTimeout(() => {
      const loaded = loadEntries();
      if (loaded.length > 0) set({ entries: loaded });
    }, 0);
  }

  return {
    entries: [],

    appendGoSignal: (entry) =>
      set((s) => {
        // Dedup: same pair+ts already in store (double-render guard)
        if (s.entries.some((e) => e.pair === entry.pair && e.ts === entry.ts)) return s;
        const updated = [...s.entries, entry].slice(-MAX_ENTRIES);
        saveEntries(updated);
        return { entries: updated };
      }),

    getAll: () => get().entries,

    clear: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      set({ entries: [] });
    },
  };
});
