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

/**
 * Notları tek blok olarak değil, kayıt kayıt doğrular — tek bir bozuk/eski
 * şemalı not tüm trade notu koleksiyonunu silmesin diye. Eskiden
 * notesMapSchema.safeParse(wholeObject) tüm-ya-da-hiç çalışıyordu (tradesStore
 * ile aynı risk); bunun yerine yalnızca geçersiz olan TEK kaydı düşürür.
 */
function parseNotesLenient(raw: unknown): Record<string, TradeNote> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, TradeNote> = {};
  for (const [tradeId, value] of Object.entries(raw as Record<string, unknown>)) {
    const r = tradeNoteSchema.safeParse(value);
    if (r.success) out[tradeId] = r.data;
  }
  return out;
}

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
    const raw = loadFromStorage<unknown>(STORAGE_KEY, {});
    set({ notes: parseNotesLenient(raw) });
  },
}));
