"use client";

/**
 * PWA SETUP HOOK — Service worker kaydı + push izni yönetimi.
 *
 * AppShell'de bir kez mount edilir. Sonuç:
 *   - SW /sw.js kaydedilir (install/activate tetiklenir)
 *   - swRegistration store'a yazılır (PwaCard okur)
 *   - Daha önce izin verilmişse subscription otomatik yenilenir
 */

import { useEffect } from "react";
import { usePwaStore } from "@/lib/store/pwaStore";

export function usePwaSetup(): void {
  const setRegistration = usePwaStore((s) => s.setRegistration);
  const setInstallPrompt = usePwaStore((s) => s.setInstallPrompt);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // SW kayıt
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        setRegistration(registration);
      })
      .catch((err) => {
        console.warn("[PWA] SW kayıt hatası:", err);
      });

    // Install prompt'u yakala (beforeinstallprompt)
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, [setRegistration, setInstallPrompt]);
}

// TypeScript tip tanımı (standart kütüphanede yok)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
