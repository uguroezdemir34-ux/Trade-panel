"use client";
/**
 * CREDENTIAL STORE
 *
 * OKX credentials are stored server-side in Clerk privateMetadata,
 * encrypted with EXCHANGE_CREDS_KEY (AES-256-GCM, separate key).
 * The client never holds OKX key/secret/pass — only configured-status flags.
 *
 * Telegram / Binance / Bybit credentials remain in localStorage
 * (AES-256-GCM via secure-storage) as they are lower-sensitivity.
 *
 * OKX API call credential priority (resolved in /api/okx/[...path]):
 *   Layer 1: Vercel env vars
 *   Layer 2: Clerk privateMetadata (fetched & decrypted server-side)
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

export interface BybitCreds {
  key: string;
  secret: string;
}

export interface TelegramCreds {
  botToken: string;
  chatId: string;
}

interface CredentialStoreState {
  /** Always null — OKX credentials live server-side. Use okxProdConfigured for UI. */
  okxProd: null;
  okxDemo: null;
  /** True when server confirms credentials are saved in Clerk metadata. */
  okxProdConfigured: boolean;
  okxDemoConfigured: boolean;
  telegram: TelegramCreds | null;
  bnbFutures: BinanceCreds | null;
  bybitFutures: BybitCreds | null;
  _loaded: boolean;
  setOkxProd: (c: OkxCreds | null) => Promise<void>;
  setOkxDemo: (c: OkxCreds | null) => Promise<void>;
  setTelegram: (c: TelegramCreds | null) => Promise<void>;
  setBnbFutures: (c: BinanceCreds | null) => Promise<void>;
  setBybitFutures: (c: BybitCreds | null) => Promise<void>;
  load: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const tgSchema = z
  .object({ botToken: z.string().min(1), chatId: z.string().min(1) })
  .nullable();

const bnbSchema = z
  .object({ key: z.string().min(1), secret: z.string().min(1) })
  .nullable();

const bybitSchema = z
  .object({ key: z.string().min(1), secret: z.string().min(1) })
  .nullable();

const K = {
  telegram: "creds_telegram",
  bnbFutures: "creds_bnb_futures",
  bybitFutures: "creds_bybit_futures",
} as const;

export const useCredentialStore = create<CredentialStoreState>((set) => ({
  okxProd: null,
  okxDemo: null,
  okxProdConfigured: false,
  okxDemoConfigured: false,
  telegram: null,
  bnbFutures: null,
  bybitFutures: null,
  _loaded: false,

  /** Saves OKX prod credentials to Clerk privateMetadata via server API. */
  setOkxProd: async (c) => {
    if (c === null) {
      await fetch("/api/credentials/okx?mode=prod", { method: "DELETE" });
      set({ okxProdConfigured: false });
    } else {
      const res = await fetch("/api/credentials/okx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: c.key, secret: c.secret, pass: c.pass, isDemo: false }),
      });
      if (res.ok) set({ okxProdConfigured: true });
    }
  },

  /** Saves OKX demo credentials to Clerk privateMetadata via server API. */
  setOkxDemo: async (c) => {
    if (c === null) {
      await fetch("/api/credentials/okx?mode=demo", { method: "DELETE" });
      set({ okxDemoConfigured: false });
    } else {
      const res = await fetch("/api/credentials/okx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: c.key, secret: c.secret, pass: c.pass, isDemo: true }),
      });
      if (res.ok) set({ okxDemoConfigured: true });
    }
  },

  setTelegram: async (c) => {
    set({ telegram: c });
    await saveSecure(K.telegram, c);
  },

  setBnbFutures: async (c) => {
    set({ bnbFutures: c });
    await saveSecure(K.bnbFutures, c);
  },

  setBybitFutures: async (c) => {
    set({ bybitFutures: c });
    await saveSecure(K.bybitFutures, c);
  },

  load: async () => {
    if (useCredentialStore.getState()._loaded) return;

    // OKX: fetch configured status from server (no actual keys returned)
    let okxProdConfigured = false;
    let okxDemoConfigured = false;
    try {
      const res = await fetch("/api/credentials/okx");
      if (res.ok) {
        const data = (await res.json()) as { okxProd?: boolean; okxDemo?: boolean };
        okxProdConfigured = !!data.okxProd;
        okxDemoConfigured = !!data.okxDemo;
      }
    } catch {
      // Network error or Clerk not configured — treated as absent
    }

    // Telegram / Binance / Bybit remain in localStorage
    const [telegram, bnbFutures, bybitFutures] = await Promise.all([
      loadSecure(K.telegram, null, { schema: tgSchema }),
      loadSecure(K.bnbFutures, null, { schema: bnbSchema }),
      loadSecure(K.bybitFutures, null, { schema: bybitSchema }),
    ]);

    set({ okxProdConfigured, okxDemoConfigured, telegram, bnbFutures, bybitFutures, _loaded: true });
  },

  clearAll: async () => {
    await Promise.all([
      fetch("/api/credentials/okx?mode=prod", { method: "DELETE" }).catch(() => {}),
      fetch("/api/credentials/okx?mode=demo", { method: "DELETE" }).catch(() => {}),
      saveSecure(K.telegram, null),
      saveSecure(K.bnbFutures, null),
      saveSecure(K.bybitFutures, null),
    ]);
    set({ okxProdConfigured: false, okxDemoConfigured: false, telegram: null, bnbFutures: null, bybitFutures: null });
  },
}));
