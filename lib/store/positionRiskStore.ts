/**
 * POSITION RISK STORE — positionGuardrails.ts sonuçlarını tutar +
 * "hangi ihlaller için Telegram zaten gönderildi" dedup state'i.
 *
 * warnedKeys localStorage'a PERSIST EDİLİR (kullanıcı kararı, chat'te
 * gerekçelendirildi): mobilde uygulama arka plana atılınca OS'un JS
 * context'ini öldürmesi sık — module-level bir Set kullansaydık her
 * arka-plan-dönüşünde sıfırlanıp aynı ihlal için tekrar tekrar Telegram
 * bildirimi giderdi (secure-storage kilit sorununda görülen aynı mekanizma).
 *
 * "Düzelene/kapanana kadar bir kez" garantisi: applyViolations() her
 * çağrıldığında, artık ihlal listesinde OLMAYAN key'ler warnedKeys'ten
 * otomatik temizlenir (pozisyon kapandı VEYA ihlal düzeldi) — böylece
 * gelecekte AYNI pozisyon TEKRAR ihlal ederse yeniden uyarılabilir.
 */

import { create } from "zustand";
import { z } from "zod";
import { loadFromStorage, saveToStorage } from "@/lib/store/persist";
import type { PositionViolation } from "@/lib/risk/positionGuardrails";

const WARNED_KEYS_STORAGE_KEY = "position_risk_warned_v1";
const warnedKeysSchema = z.array(z.string());

function readWarnedKeys(): Set<string> {
  return new Set(loadFromStorage<string[]>(WARNED_KEYS_STORAGE_KEY, [], warnedKeysSchema));
}

function writeWarnedKeys(keys: Set<string>): void {
  const arr: string[] = [];
  keys.forEach((k: string) => arr.push(k));
  saveToStorage(WARNED_KEYS_STORAGE_KEY, arr);
}

interface PositionRiskState {
  /** Banner bunu okur — GÜNCEL tüm ihlaller (uyarılmış olsun olmasın). */
  violations: PositionViolation[];
  warnedKeys: Set<string>;

  /** AppShell mount'ta bir kez çağrılır — localStorage'dan warnedKeys'i yükler.
   *  Modül-scope'ta değil, açık bir action olarak (hydration mismatch riskini
   *  önlemek için — bkz. useWatchlistStore'daki aynı desen). */
  hydrateWarnedKeys: () => void;

  /**
   * usePositionPoller her fetch'te çağırır. Store'u günceller, YENİ
   * (henüz warnedKeys'te olmayan) ihlalleri döner — caller bunlar için
   * Telegram gönderir. Zaten uyarılmış ihlaller tekrar dönmez.
   */
  applyViolations: (violations: PositionViolation[]) => PositionViolation[];
}

export const usePositionRiskStore = create<PositionRiskState>((set, get) => ({
  violations: [],
  warnedKeys: new Set<string>(),

  hydrateWarnedKeys: () => {
    set({ warnedKeys: readWarnedKeys() });
  },

  applyViolations: (violations: PositionViolation[]) => {
    const currentKeys = new Set<string>(violations.map((v) => v.key));
    const prevWarned: Set<string> = get().warnedKeys;

    // Artık ihlal listesinde olmayan key'leri temizle (kapandı/düzeldi).
    // Array.from(Set) yerine elle döngü — bkz. commit mesajı: bu sandbox'ta
    // node_modules yok, zustand'ın gerçek .d.ts'i olmadan bazı generic
    // inference zincirleri (Array.from<Set<string>>) bozulabiliyor; elle
    // döngü buna bağımlı değil, hem burada hem gerçek ortamda aynı çalışır.
    const nextWarned = new Set<string>();
    prevWarned.forEach((k: string) => {
      if (currentKeys.has(k)) nextWarned.add(k);
    });

    const newlyViolated = violations.filter((v: PositionViolation) => !nextWarned.has(v.key));
    for (const v of newlyViolated) nextWarned.add(v.key);

    writeWarnedKeys(nextWarned);
    set({ violations, warnedKeys: nextWarned });
    return newlyViolated;
  },
}));
