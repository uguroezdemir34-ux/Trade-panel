import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";

const STORAGE_KEY = "quantix_pair_notes_v1";

function load(): Partial<Record<Pair, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<Pair, string>>) : {};
  } catch {
    return {};
  }
}

function save(notes: Partial<Record<Pair, string>>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {}
}

interface PairNotesState {
  notes: Partial<Record<Pair, string>>;
  setNote: (pair: Pair, note: string) => void;
  clearNote: (pair: Pair) => void;
}

export const usePairNotesStore = create<PairNotesState>((set, get) => ({
  notes: load(),
  setNote: (pair, note) => {
    const next = { ...get().notes, [pair]: note };
    save(next);
    set({ notes: next });
  },
  clearNote: (pair) => {
    const { [pair]: _removed, ...rest } = get().notes;
    save(rest as Partial<Record<Pair, string>>);
    set({ notes: rest as Partial<Record<Pair, string>> });
  },
}));
