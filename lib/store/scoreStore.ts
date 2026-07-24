/**
 * SCORE STORE — Score engine sonuçlarını tutar.
 *
 * Her pair için en son ScoreResult saklanır.
 * useScoreEngine hook'u candleStore + diğer store'ları okuyarak
 * bu store'u günceller.
 */

import { create } from "zustand";
import type { ScoreResult } from "@/lib/score/orchestrator";
import type { Pair } from "@/lib/constants/pairs";

interface ScoreStoreState {
  /** Son hesaplanan score sonucu (pair başına).
   *  undefined = hiç hesaplanmadı (yeni yükleme)
   *  null      = hesaplandı ama candle yetersiz — "atlandı" sentinel
   *  ScoreResult = geçerli skor
   */
  // Anahtar bilerek string (Pair değil) — position.pair: string ile cast'siz
  // indekslenebilsin diye (bkz. marketStore.ts'teki aynı gerekçe). Yazma
  // tarafı (setResult/setSkipped) hep Pair ile çağrılıyor, PAIRS dışındaki
  // pariteler için burada hiçbir zaman bir satır OLUŞMAYACAK — sadece
  // okuma tarafının cast gerektirmemesi için tip genişletildi.
  results: Partial<Record<string, ScoreResult | null>>;
  /** Hesaplama zamanı */
  computedAt: Partial<Record<string, number>>;
  /** Hesaplama devam ediyor mu */
  computing: boolean;

  setResult: (pair: Pair, result: ScoreResult, now: number) => void;
  /** Candle yetersizliği nedeniyle hesaplanamadı — undefined'dan null'a geçirir. */
  setSkipped: (pair: Pair, now: number) => void;
  setComputing: (v: boolean) => void;
  reset: () => void;
}

export const useScoreStore = create<ScoreStoreState>((set) => ({
  results: {},
  computedAt: {},
  computing: false,

  setResult: (pair, result, now) =>
    set((s) => ({
      results: { ...s.results, [pair]: result },
      computedAt: { ...s.computedAt, [pair]: now },
    })),

  setSkipped: (pair, now) =>
    set((s) => ({
      results: { ...s.results, [pair]: null },
      computedAt: { ...s.computedAt, [pair]: now },
    })),

  setComputing: (v) => set({ computing: v }),

  reset: () => set({ results: {}, computedAt: {}, computing: false }),
}));

export const selectScoreResult =
  (pair: Pair) =>
  (s: ScoreStoreState): ScoreResult | null | undefined =>
    s.results[pair];
