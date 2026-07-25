/**
 * SIGNAL CONFIRM STORE — useSignalFirehose.ts'in içindeki pendingConfirmAt
 * ref'ini (CONFIRM_DELAY_MS bekleme durumu) UI'a görünür kılan salt-gözlem
 * katmanı.
 *
 * Bilinçli olarak PERSIST EDİLMİYOR — useSignalFirehose.ts'teki asıl ref'ler
 * de sadece bellekte (useRef) tutuluyor, sayfa yenilenince sıfırlanıyor. Bu
 * store aynı ömrü paylaşmalı: yenileme sonrası "hâlâ bekliyormuş gibi" veya
 * "zaten teyitliymiş gibi" göstermek, gerçek durumu bilmediğimiz halde
 * biliyormuş gibi davranmak olur (bkz. CLAUDE.md §0.1 madde 3). UI tarafı
 * (VerdictBadge) store'da hiç kayıt yoksa "bilinmiyor" göstermeli, "confirmed"
 * değil.
 *
 * Bu store SADECE görüntüleme amaçlı — useSignalFirehose.ts'in kendi
 * pendingConfirmAt/prevVerdicts/lastFiredAt ref'leri tetikleme mantığının tek
 * gerçek kaynağı olmaya devam ediyor, buraya yazmak sadece bir yansıtma.
 */

import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";

export interface SignalConfirmEntry {
  /** epoch ms — bu zamana kadar hâlâ GO ise sinyal atılır. null = bekleme yok. */
  pendingUntil: number | null;
  /** epoch ms — fireSignal() bu an tetiklendi. null = henüz teyitlenmedi. */
  confirmedAt: number | null;
}

interface SignalConfirmState {
  entries: Partial<Record<Pair, SignalConfirmEntry>>;
  setPending: (pair: Pair, until: number) => void;
  setConfirmed: (pair: Pair, at: number) => void;
  clear: (pair: Pair) => void;
}

export const useSignalConfirmStore = create<SignalConfirmState>((set) => ({
  entries: {},
  setPending: (pair, until) =>
    set((s) => ({
      entries: { ...s.entries, [pair]: { pendingUntil: until, confirmedAt: null } },
    })),
  setConfirmed: (pair, at) =>
    set((s) => ({
      entries: { ...s.entries, [pair]: { pendingUntil: null, confirmedAt: at } },
    })),
  clear: (pair) =>
    set((s) => {
      const next = { ...s.entries };
      delete next[pair];
      return { entries: next };
    }),
}));

export type ConfirmStatus = "pending" | "confirmed" | "unknown";

/**
 * "now"a bağlı OLMAYAN yapısal durum — VerdictBadge.tsx (canlı, tick'li) ve
 * ShareButton.tsx (tek seferlik, tıklama anı) AYNI kararı versin diye tek
 * yerde. "pending" adayı gerçekten hâlâ gelecekte mi (pendingUntil > now),
 * onu çağıran kendi "now"ıyla ayrıca kontrol etmeli — bkz. kullanım yerleri.
 */
export function deriveConfirmStructural(
  entry: SignalConfirmEntry | undefined,
): ConfirmStatus {
  if (entry?.confirmedAt != null) return "confirmed";
  if (entry?.pendingUntil != null) return "pending";
  return "unknown";
}

/**
 * Tam durum — verdict/demoMode/entry/now hepsi birlikte. trackingApplies
 * false ise (demoMode) veya verdict "go" değilse null döner — rozet/kart
 * o durumda hiç uygulanmaz.
 */
export function resolveConfirmStatus(
  verdict: "go" | "wait" | "no",
  trackingApplies: boolean,
  entry: SignalConfirmEntry | undefined,
  now: number,
): ConfirmStatus | null {
  if (verdict !== "go" || !trackingApplies) return null;
  const structural = deriveConfirmStructural(entry);
  if (structural !== "pending") return structural;
  if (entry!.pendingUntil! > now) return "pending";
  // süre doldu ama confirmedAt henüz gelmedi — bkz. deriveConfirmStructural yorumu
  return "unknown";
}
