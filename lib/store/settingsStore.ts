/**
 * STORE — Settings & UI Preferences.
 *
 * Panel'deki global ST objesinin **ayarlar bölümü**:
 *   - ug52_lastTab        → son açık tab
 *   - ug52_demo_mode      → demo trading modu (true = real değil, paper)
 *   - ug52_ftMode         → forward test modu (true = Telegram'a gönderme, sadece logla)
 *   - ug52_ws_url         → özel WebSocket URL (dev / fallback için)
 *
 * Tüm değişiklikler localStorage'a otomatik yazılır.
 *
 * GİZLİ VERİ YOK: OKX API key, Telegram bot token gibi sırlar bu store'da
 * DEĞİL. Onlar ayrı bir paket konusu (encrypted storage veya server-side).
 */

import { create } from "zustand";
import { z } from "zod";
import { loadFromStorage, saveToStorage } from "./persist";

// ═══════════════════════════════════════════════════════════════════
// TIP TANIMLARI
// ═══════════════════════════════════════════════════════════════════

/** v2 panelin tab kimlikleri (3 ana sekme + eski ID'ler backward compat) */
export const TAB_IDS = [
  "karar",
  "grafik",
  "analiz",
  "pozisyon",
  "piyasa",
  "risk",
  "pnl",
  "backtest",
  "ayarlar",
] as const;
export type TabId = (typeof TAB_IDS)[number];

const tabIdSchema = z.enum(TAB_IDS);

const themeSchema = z.enum(["dark", "light"]);
export type Theme = z.infer<typeof themeSchema>;

const settingsSchema = z.object({
  lastTab: tabIdSchema,
  demoMode: z.boolean(),
  forwardTestMode: z.boolean(),
  wsUrl: z.string().nullable(),
  maxTradesPerDay: z.number().int().min(1).max(20),
  defaultLeverage: z.number().int().min(1).max(125),
  defaultRiskPct: z.number().min(0.1).max(5),
  dailyGoalUsd: z.number().min(0).max(100000),
  drawdownProtocolEnabled: z.boolean(),
  theme: themeSchema,
  goAlertsEnabled: z.boolean(),
  audioAlertsEnabled: z.boolean(),
});

export type SettingsData = z.infer<typeof settingsSchema>;

// ═══════════════════════════════════════════════════════════════════
// DEFAULT DEĞERLER
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_SETTINGS: SettingsData = {
  lastTab: "karar",
  demoMode: false,
  forwardTestMode: false,
  wsUrl: null,
  maxTradesPerDay: 2,
  defaultLeverage: 10,
  defaultRiskPct: 1,
  dailyGoalUsd: 0,
  drawdownProtocolEnabled: true,
  theme: "dark",
  goAlertsEnabled: false,
  audioAlertsEnabled: true,
};

// ═══════════════════════════════════════════════════════════════════
// STORAGE KEY'LERİ (panel uyumlu)
// ═══════════════════════════════════════════════════════════════════

const KEYS = {
  lastTab: "lastTab",
  demoMode: "demo_mode",
  forwardTestMode: "ftMode",
  wsUrl: "ws_url",
  maxTradesPerDay: "max_trades_per_day",
  defaultLeverage: "default_leverage",
  defaultRiskPct: "default_risk_pct",
  dailyGoalUsd: "daily_goal_usd",
  drawdownProtocolEnabled: "dd_protocol_enabled",
  theme: "theme",
  goAlertsEnabled: "go_alerts_enabled",
  audioAlertsEnabled: "audio_alerts_enabled",
} as const;

// ═══════════════════════════════════════════════════════════════════
// STORE ARAYÜZÜ
// ═══════════════════════════════════════════════════════════════════

interface SettingsStoreState extends SettingsData {
  // Actions
  setLastTab: (tab: TabId) => void;
  setDemoMode: (on: boolean) => void;
  setForwardTestMode: (on: boolean) => void;
  setWsUrl: (url: string | null) => void;
  setMaxTradesPerDay: (n: number) => void;
  setDefaultLeverage: (n: number) => void;
  setDefaultRiskPct: (n: number) => void;
  setDailyGoalUsd: (n: number) => void;
  setDrawdownProtocolEnabled: (on: boolean) => void;
  setTheme: (theme: Theme) => void;
  setGoAlertsEnabled: (on: boolean) => void;
  setAudioAlertsEnabled: (on: boolean) => void;
  /** Tüm ayarları varsayılana sıfırla */
  reset: () => void;
  /** localStorage'tan tekrar yükle (SSR sonrası hydrate için) */
  rehydrate: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// LOAD HELPER — localStorage'tan ilk yükleme
// ═══════════════════════════════════════════════════════════════════

/**
 * localStorage'taki dağınık key'leri tek obje halinde topla.
 * Her key ayrı (panel uyumu için), v2 monolitik obje değil.
 */
export function loadSettings(): SettingsData {
  return {
    lastTab: loadFromStorage<TabId>(KEYS.lastTab, DEFAULT_SETTINGS.lastTab, tabIdSchema),
    demoMode: loadFromStorage<boolean>(
      KEYS.demoMode,
      DEFAULT_SETTINGS.demoMode,
      z.boolean(),
    ),
    forwardTestMode: loadFromStorage<boolean>(
      KEYS.forwardTestMode,
      DEFAULT_SETTINGS.forwardTestMode,
      z.boolean(),
    ),
    wsUrl: loadFromStorage<string | null>(
      KEYS.wsUrl,
      DEFAULT_SETTINGS.wsUrl,
      z.string().nullable(),
    ),
    maxTradesPerDay: loadFromStorage<number>(
      KEYS.maxTradesPerDay,
      DEFAULT_SETTINGS.maxTradesPerDay,
      z.number().int().min(1).max(20),
    ),
    defaultLeverage: loadFromStorage<number>(
      KEYS.defaultLeverage,
      DEFAULT_SETTINGS.defaultLeverage,
      z.number().int().min(1).max(125),
    ),
    defaultRiskPct: loadFromStorage<number>(
      KEYS.defaultRiskPct,
      DEFAULT_SETTINGS.defaultRiskPct,
      z.number().min(0.1).max(5),
    ),
    dailyGoalUsd: loadFromStorage<number>(
      KEYS.dailyGoalUsd,
      DEFAULT_SETTINGS.dailyGoalUsd,
      z.number().min(0).max(100000),
    ),
    drawdownProtocolEnabled: loadFromStorage<boolean>(
      KEYS.drawdownProtocolEnabled,
      DEFAULT_SETTINGS.drawdownProtocolEnabled,
      z.boolean(),
    ),
    theme: loadFromStorage<Theme>(KEYS.theme, DEFAULT_SETTINGS.theme, themeSchema),
    goAlertsEnabled: loadFromStorage<boolean>(
      KEYS.goAlertsEnabled,
      DEFAULT_SETTINGS.goAlertsEnabled,
      z.boolean(),
    ),
    audioAlertsEnabled: loadFromStorage<boolean>(
      KEYS.audioAlertsEnabled,
      DEFAULT_SETTINGS.audioAlertsEnabled,
      z.boolean(),
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════
// ZUSTAND STORE
// ═══════════════════════════════════════════════════════════════════

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  // İlk state — SSR'da default, client'ta loadSettings() değeri
  // (rehydrate() useEffect'te çağrılır, client'a gelince doğru değer set olur)
  ...DEFAULT_SETTINGS,

  setLastTab: (tab) => {
    saveToStorage(KEYS.lastTab, tab);
    set({ lastTab: tab });
  },

  setDemoMode: (on) => {
    saveToStorage(KEYS.demoMode, on);
    set({ demoMode: on });
  },

  setForwardTestMode: (on) => {
    saveToStorage(KEYS.forwardTestMode, on);
    set({ forwardTestMode: on });
  },

  setWsUrl: (url) => {
    saveToStorage(KEYS.wsUrl, url);
    set({ wsUrl: url });
  },

  setMaxTradesPerDay: (n) => {
    // Clamp to allowed range
    const safe = Math.max(1, Math.min(20, Math.round(n)));
    saveToStorage(KEYS.maxTradesPerDay, safe);
    set({ maxTradesPerDay: safe });
  },

  setDefaultLeverage: (n) => {
    const safe = Math.max(1, Math.min(125, Math.round(n)));
    saveToStorage(KEYS.defaultLeverage, safe);
    set({ defaultLeverage: safe });
  },

  setDefaultRiskPct: (n) => {
    const safe = Math.max(0.1, Math.min(5, Math.round(n * 10) / 10));
    saveToStorage(KEYS.defaultRiskPct, safe);
    set({ defaultRiskPct: safe });
  },

  setDailyGoalUsd: (n) => {
    const safe = Math.max(0, Math.min(100000, Math.round(n)));
    saveToStorage(KEYS.dailyGoalUsd, safe);
    set({ dailyGoalUsd: safe });
  },

  setDrawdownProtocolEnabled: (on) => {
    saveToStorage(KEYS.drawdownProtocolEnabled, on);
    set({ drawdownProtocolEnabled: on });
  },

  setTheme: (theme) => {
    saveToStorage(KEYS.theme, theme);
    set({ theme });
  },

  setGoAlertsEnabled: (on) => {
    saveToStorage(KEYS.goAlertsEnabled, on);
    set({ goAlertsEnabled: on });
  },

  setAudioAlertsEnabled: (on) => {
    saveToStorage(KEYS.audioAlertsEnabled, on);
    set({ audioAlertsEnabled: on });
  },

  reset: () => {
    // Sadece state'i sıfırla, localStorage'a yaz
    saveToStorage(KEYS.lastTab, DEFAULT_SETTINGS.lastTab);
    saveToStorage(KEYS.demoMode, DEFAULT_SETTINGS.demoMode);
    saveToStorage(KEYS.forwardTestMode, DEFAULT_SETTINGS.forwardTestMode);
    saveToStorage(KEYS.wsUrl, DEFAULT_SETTINGS.wsUrl);
    saveToStorage(KEYS.maxTradesPerDay, DEFAULT_SETTINGS.maxTradesPerDay);
    saveToStorage(KEYS.defaultLeverage, DEFAULT_SETTINGS.defaultLeverage);
    saveToStorage(KEYS.defaultRiskPct, DEFAULT_SETTINGS.defaultRiskPct);
    saveToStorage(KEYS.dailyGoalUsd, DEFAULT_SETTINGS.dailyGoalUsd);
    saveToStorage(
      KEYS.drawdownProtocolEnabled,
      DEFAULT_SETTINGS.drawdownProtocolEnabled,
    );
    saveToStorage(KEYS.theme, DEFAULT_SETTINGS.theme);
    saveToStorage(KEYS.goAlertsEnabled, DEFAULT_SETTINGS.goAlertsEnabled);
    saveToStorage(KEYS.audioAlertsEnabled, DEFAULT_SETTINGS.audioAlertsEnabled);
    set({ ...DEFAULT_SETTINGS });
  },

  rehydrate: () => {
    // Client'ta useEffect içinde çağrılır
    const loaded = loadSettings();
    set(loaded);
  },
}));

// ═══════════════════════════════════════════════════════════════════
// SELECTOR HELPER'LARI (tekrar kullanılabilir)
// ═══════════════════════════════════════════════════════════════════

/** Sadece lastTab — granular subscription için */
export const selectLastTab = (s: SettingsStoreState): TabId => s.lastTab;
/** Sadece demoMode */
export const selectDemoMode = (s: SettingsStoreState): boolean => s.demoMode;
/** Sadece forwardTestMode */
export const selectForwardTestMode = (s: SettingsStoreState): boolean =>
  s.forwardTestMode;
