"use client";

/**
 * CAPACITOR APP LIFECYCLE HOOK
 *
 * Native ortamda:
 *   - Arka plandan ön plana gelinince veri yenile
 *   - Android back button'da uygulamayı kapat (eğer geçmiş yoksa)
 *   - URL deep link'lerini yönet
 *   - StatusBar + SplashScreen konfigürasyonu
 *
 * Web'de: sessizce no-op.
 */

import { useEffect } from "react";
import { isNativePlatform } from "@/lib/mobile/platform";

export function useCapacitorApp(): void {
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cleanupFns: Array<() => void> = [];

    void (async () => {
      try {
        // App lifecycle
        const { App } = await import("@capacitor/app");
        const appStateListener = await App.addListener(
          "appStateChange",
          ({ isActive }) => {
            if (isActive) {
              // Ön plana gelince location.reload() yerine soft refresh
              // Store'lar zaten reactive — sadece SW cache'i bypass et
              window.dispatchEvent(new CustomEvent("quantix:foreground"));
            }
          },
        );

        // Android geri tuşu
        const backListener = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            void App.exitApp();
          }
        });

        // Deep link / URL aç
        const urlListener = await App.addListener("appUrlOpen", ({ url }) => {
          const parsed = new URL(url);
          const path = parsed.pathname;
          if (path && path !== "/") {
            window.history.pushState({}, "", path);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        });

        cleanupFns = [
          () => void appStateListener.remove(),
          () => void backListener.remove(),
          () => void urlListener.remove(),
        ];

        // StatusBar — koyu tema
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0A0A0A" });

        // SplashScreen gizle
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 300 });
      } catch {
        // Plugin yüklü değil — sessizce devam et
      }
    })();

    return () => {
      cleanupFns.forEach((fn) => {
        try { fn(); } catch { /* ignore cleanup errors */ }
      });
    };
  }, []);
}
