import { create } from "zustand";
import { z } from "zod";
import { loadFromStorage, saveToStorage } from "./persist";

const STORAGE_KEY = "trade_notes_v1";

export interface TradeNote {
  text: string;
  tags: string[];
  updatedAt: number;
}

const tradeNoteSchema = z.object({
  text: z.string(),
  tags: z.array(z.string()),
  updatedAt: z.number(),
});

const notesMapSchema = z.record(z.string(), tradeNoteSchema);

interface TradeNotesStoreState {
  notes: Record<string, TradeNote>;
  setNote: (tradeId: string, text: string, tags?: string[]) => void;
  deleteNote: (tradeId: string) => void;
  rehydrate: () => void;
}

export const useTradeNotesStore = create<TradeNotesStoreState>((set, get) => ({
  notes: {},

  setNote: (tradeId, text, tags = []) => {
    const next: Record<string, TradeNote> = {
      ...get().notes,
      [tradeId]: { text, tags, updatedAt: Date.now() },
    };
    saveToStorage(STORAGE_KEY, next);
    set({ notes: next });
  },

  deleteNote: (tradeId) => {
    const next = { ...get().notes };
    delete next[tradeId];
    saveToStorage(STORAGE_KEY, next);
    set({ notes: next });
  },

  rehydrate: () => {
    const loaded = loadFromStorage<Record<string, TradeNote>>(
      STORAGE_KEY,
      {},
      notesMapSchema,
    );
    set({ notes: loaded });
  },
}));
