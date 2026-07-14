/**
 * NEWS STORE — Haber Akışı şeridi için sınıflandırılmış haberler.
 *
 * Ephemeral/canlı veri — localStorage persist yok (orderBookStore ile aynı
 * sınıf: her sayfa yüklemesinde poller yeniden doldurur).
 */

import { create } from "zustand";
import type { NewsItem } from "@/lib/news/types";

interface NewsState {
  items: NewsItem[];
  lastFetchedAt: number | null;
  setItems: (items: NewsItem[]) => void;
}

export const useNewsStore = create<NewsState>((set) => ({
  items: [],
  lastFetchedAt: null,
  setItems: (items) => set({ items, lastFetchedAt: Date.now() }),
}));
