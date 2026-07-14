"use client";

import { create } from "zustand";

export type DevicePerfMode = "low" | "high";

const MIN_DWELL_MS = 5_000;
const STABLE_WINDOWS_REQUIRED = 3;
const LOW_FPS_THRESHOLD = 30;
const HIGH_FPS_MIN = 50;
const HIGH_FPS_MAX = 60;
const LOW_CORE_THRESHOLD = 4;
const LOW_MEMORY_GB_THRESHOLD = 4;

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

interface DevicePerfState {
  /** GÜVENLİ VARSAYILAN — ölçüm tamamlanana kadar hep "low" (fake-glass), asla "high" ile başlamaz. */
  mode: DevicePerfMode;
  /** matchMedia(prefers-reduced-motion) — true ise mutlak, diğer sinyalleri ezer. */
  reducedMotion: boolean;
  /** hardwareConcurrency<4 veya deviceMemory<4 (tanımlıysa) — "high"a yükselmeyi engeller. */
  staticLowSignal: boolean;
  consecutiveStableWindows: number;
  lastSwitchAt: number;
  initialized: boolean;

  /** Statik sinyalleri bir kez okur (client-only) — birden çok çağrıda no-op. */
  init: () => void;
  /** useFpsMonitor'dan her ~1sn'de bir çağrılır. */
  reportFps: (fps: number) => void;
}

function readStaticSignals(): { reducedMotion: boolean; staticLowSignal: boolean } {
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nav: NavigatorWithDeviceMemory | undefined =
    typeof navigator !== "undefined" ? navigator : undefined;

  const lowCores = (nav?.hardwareConcurrency ?? Infinity) < LOW_CORE_THRESHOLD;
  // deviceMemory API her tarayıcıda yok — undefined ise bu sinyal YOK SAYILIR (düşük varsayılmaz).
  const lowMemory = nav?.deviceMemory !== undefined && nav.deviceMemory < LOW_MEMORY_GB_THRESHOLD;

  return { reducedMotion, staticLowSignal: lowCores || lowMemory };
}

export const useDevicePerfStore = create<DevicePerfState>((set, get) => ({
  mode: "low",
  reducedMotion: false,
  staticLowSignal: false,
  consecutiveStableWindows: 0,
  lastSwitchAt: 0,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    const { reducedMotion, staticLowSignal } = readStaticSignals();
    set({ reducedMotion, staticLowSignal, initialized: true, lastSwitchAt: Date.now() });
  },

  reportFps: (fps) => {
    const state = get();

    // Kullanıcı tercihi mutlak — diğer sinyalleri ezer, debounce'a tabi değil (geri dönüş yok).
    if (state.reducedMotion) {
      if (state.mode !== "low") set({ mode: "low", lastSwitchAt: Date.now() });
      return;
    }

    const now = Date.now();
    const dwellElapsed = now - state.lastSwitchAt >= MIN_DWELL_MS;

    if (fps < LOW_FPS_THRESHOLD) {
      set({ consecutiveStableWindows: 0 });
      if (state.mode !== "low" && dwellElapsed) {
        set({ mode: "low", lastSwitchAt: now });
      }
      return;
    }

    if (fps >= HIGH_FPS_MIN && fps <= HIGH_FPS_MAX) {
      const stable = state.consecutiveStableWindows + 1;
      set({ consecutiveStableWindows: stable });
      if (
        stable >= STABLE_WINDOWS_REQUIRED &&
        !state.staticLowSignal &&
        state.mode !== "high" &&
        dwellElapsed
      ) {
        set({ mode: "high", lastSwitchAt: now });
      }
      return;
    }

    // Ara bölge (30-49 veya 60+) — kararsız, sayaç sıfırlanır, mevcut mod korunur (flapping önleme).
    set({ consecutiveStableWindows: 0 });
  },
}));
