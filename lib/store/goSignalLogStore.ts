import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";
import type { ScoreSubScores } from "@/lib/score/orchestrator";
import type { Regime } from "@/lib/score/scorers";
import type { OiDivergence } from "@/lib/market/oi-divergence";

const MAX_ENTRIES = 200;
const STORAGE_KEY = "gosignal_log_v1";

export interface GoSignalOutcome {
  /** Fiyat sinyal yönünde mi, tersine mi hareket etti */
  isAdverse: boolean;
  /** (capturePrice - entryPrice) / entryPrice * 100 */
  movePct: number;
  /** Ölçüm anındaki fiyat */
  price: number;
  /** Ölçüm yapıldığı epoch ms */
  ts: number;
}

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
  /** OI rejim diverjansı — sadece gözlem, skor motorunu etkilemez */
  oiDivergence?: OiDivergence;
  /** Gölge kapılar tetiklenme listesi (chopGate, atrRatioGate, timeGate, btcSrGate, pocBlock, oiDivergence:*) */
  triggeredGates?: string[];
  /** Sinyal sonrası 15 dakikadaki fiyat hareketi (yalnızca browser açıksa doldurulur) */
  outcome15m?: GoSignalOutcome;
  /** Sinyal sonrası 1 saatteki fiyat hareketi (yalnızca browser açıksa doldurulur) */
  outcome1h?: GoSignalOutcome;
}

interface GoSignalLogState {
  entries: GoSignalEntry[];
  appendGoSignal: (entry: GoSignalEntry) => void;
  updateOutcome: (
    pair: Pair,
    ts: number,
    field: "outcome15m" | "outcome1h",
    data: GoSignalOutcome,
  ) => void;
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

    updateOutcome: (pair, ts, field, data) =>
      set((s) => {
        const idx = s.entries.findIndex((e) => e.pair === pair && e.ts === ts);
        if (idx === -1) return s;
        const updated = [...s.entries];
        updated[idx] = { ...updated[idx], [field]: data };
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
