"use client";

/**
 * PWA STORE — Service worker kayıt durumu + install prompt.
 * Zustand (in-memory, persist gerekmez).
 */

import { create } from "zustand";

interface PwaStoreState {
  /** Kayıtlı SW (null = henüz kayıt yok veya desteklenmiyor) */
  registration: ServiceWorkerRegistration | null;
  /** PWA install prompt (null = zaten kurulu veya desteklenmiyor) */
  installPrompt: Event | null;
  /** Push notification izni durumu */
  pushPermission: NotificationPermission;
  setRegistration: (r: ServiceWorkerRegistration | null) => void;
  setInstallPrompt: (e: Event | null) => void;
  setPushPermission: (p: NotificationPermission) => void;
}

export const usePwaStore = create<PwaStoreState>((set) => ({
  registration: null,
  installPrompt: null,
  pushPermission:
    typeof Notification !== "undefined"
      ? Notification.permission
      : "default",

  setRegistration: (r) => set({ registration: r }),
  setInstallPrompt: (e) => set({ installPrompt: e }),
  setPushPermission: (p) => set({ pushPermission: p }),
}));
