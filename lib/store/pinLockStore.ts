"use client";

/**
 * PIN LOCK STORE — `secure-storage.ts`'teki `isUnlocked()`/`hasPinConfigured()`
 * modül-seviyesi (Zustand DIŞI) durumunun reaktif bir aynası.
 *
 * `secure-storage.ts` kasıtlı olarak Zustand/React'e bağımlı DEĞİL (saf,
 * test edilebilir bir crypto katmanı) — ama UI'ın (MasterPinModal + credential
 * kartları) kilit durumu DEĞİŞTİĞİNDE yeniden render olması gerekiyor. Bu
 * ince katman o köprüyü kurar; kriptografik mantığın kendisine dokunmaz.
 */

import { create } from "zustand";
import { isUnlocked, hasPinConfigured } from "./secure-storage";

interface PinLockState {
  /** İlk client-side okuma yapıldı mı (SSR/hydration mismatch'i önlemek için). */
  checked: boolean;
  unlocked: boolean;
  pinConfigured: boolean;
  /** localStorage'dan (hasPinConfigured) ve bellekten (isUnlocked) taze durumu oku. */
  refresh: () => void;
  /** unlock() başarılı olduğunda çağrılır — PIN artık kesinlikle kurulu. */
  setUnlocked: (v: boolean) => void;
}

export const usePinLockStore = create<PinLockState>((set) => ({
  checked: false,
  unlocked: false,
  pinConfigured: false,
  refresh: () => set({ checked: true, unlocked: isUnlocked(), pinConfigured: hasPinConfigured() }),
  setUnlocked: (v) => set({ unlocked: v, pinConfigured: true }),
}));
