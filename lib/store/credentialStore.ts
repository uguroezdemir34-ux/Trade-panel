"use client";
/**
 * CREDENTIAL STORE — Layer 2 browser-side credentials.
 *
 * Stores OKX and Telegram credentials entered via the UI.
 * Encrypted in localStorage via AES-256-GCM (secure-storage.ts).
 *
 * Priority: Layer 1 (Vercel env vars) > Layer 2 (this store).
 * The server-handler checks Layer 2 only when Layer 1 is absent.
 */

import { create } from "zustand";
import { loadSecure, saveSecure } from "./secure-storage";
import { z } from "zod";

export interface OkxCreds {
  key: string;
  secret: string;
  pass: string;
}

export interface BinanceCreds {
  key: string;
  secret: string;
}

export interface TelegramCreds {
  botToken: string;
  chatId: string;
}

interface CredentialStoreState {
  okxProd: OkxCreds | null;
  okxDemo: OkxCreds | null;
  telegram: TelegramCreds | null;
  bnbFutures: BinanceCreds | null;
  _loaded: boolean;
  setOkxProd: (c: OkxCreds | null) => Promise<void>;
  setOkxDemo: (c: OkxCreds | null) => Promise<void>;
  setTelegram: (c: TelegramCreds | null) => Promise<void>;
  setBnbFutures: (c: BinanceCreds | null) => Promise<void>;
  load: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const okxSchema = z
  .object({
    key: z.string().min(1),
    secret: z.string().min(1),
    pass: z.string().min(1),
  })
  .nullable();

const tgSchema = z
  .object({
    botToken: z.string().min(1),
    chatId: z.string().min(1),
  })
  .nullable();

const K = {
  okxProd: "creds_okx_prod",
  okxDemo: "creds_okx_demo",
  telegram: "creds_telegram",
  bnbFutures: "creds_bnb_futures",
} as const;

const bnbSchema = z
  .object({
    key: z.string().min(1),
    secret: z.string().min(1),
  })
  .nullable();

export const useCredentialStore = create<CredentialStoreState>((set) => ({
  okxProd: null,
  okxDemo: null,
  telegram: null,
  bnbFutures: null,
  _loaded: false,

  setOkxProd: async (c) => {
    set({ okxProd: c });
    await saveSecure(K.okxProd, c);
  },

  setOkxDemo: async (c) => {
    set({ okxDemo: c });
    await saveSecure(K.okxDemo, c);
  },

  setTelegram: async (c) => {
    set({ telegram: c });
    await saveSecure(K.telegram, c);
  },

  setBnbFutures: async (c) => {
    set({ bnbFutures: c });
    await saveSecure(K.bnbFutures, c);
  },

  load: async () => {
    // Guard: skip if already loaded (idempotent — safe for StrictMode double-invocation)
    if (useCredentialStore.getState()._loaded) return;

    const [okxProd, okxDemo, telegram, bnbFutures] = await Promise.all([
      loadSecure(K.okxProd, null, { schema: okxSchema }),
      loadSecure(K.okxDemo, null, { schema: okxSchema }),
      loadSecure(K.telegram, null, { schema: tgSchema }),
      loadSecure(K.bnbFutures, null, { schema: bnbSchema }),
    ]);
    set({ okxProd, okxDemo, telegram, bnbFutures, _loaded: true });
  },

  clearAll: async () => {
    await Promise.all([
      saveSecure(K.okxProd, null),
      saveSecure(K.okxDemo, null),
      saveSecure(K.telegram, null),
      saveSecure(K.bnbFutures, null),
    ]);
    set({ okxProd: null, okxDemo: null, telegram: null, bnbFutures: null });
  },
}));
