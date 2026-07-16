"use client";

/**
 * CAPACITOR PUSH (FCM) HOOK
 *
 * Native ortamda: bildirim izni ister, FCM token'ı alır,
 * /api/push/subscribe'a { token, action: "subscribe" } olarak gönderir.
 * Web'de: sessizce no-op (isNativePlatform() false).
 *
 * NOT: bu hook `android/` projesi ve gerçek bir Firebase kurulumu
 * (google-services.json) olmadan test edilemez — kaynak hazır ama
 * doğrulanmamış (bkz. QUANTIX-PlayStore-Hazirlik-Raporu.md §3).
 */

import { useEffect } from "react";
import { isNativePlatform } from "@/lib/mobile/platform";

async function registerSubscription(token: string): Promise<void> {
  try {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "subscribe" }),
    });
  } catch {
    // Sessizce vazgeç — bir sonraki foreground'da (registration event
    // tekrar tetiklenir) yeniden denenir.
  }
}

export function useCapacitorPush(): void {
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cleanupFns: Array<() => void> = [];

    void (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") return;

        await PushNotifications.register();

        const registrationListener = await PushNotifications.addListener(
          "registration",
          (token) => void registerSubscription(token.value),
        );
        const errorListener = await PushNotifications.addListener(
          "registrationError",
          (err) => console.error("[useCapacitorPush] registration error:", err),
        );

        cleanupFns = [
          () => void registrationListener.remove(),
          () => void errorListener.remove(),
        ];
      } catch {
        // Plugin yüklü değil (android/ projesi henüz yok) — sessizce devam et.
      }
    })();

    return () => {
      cleanupFns.forEach((fn) => {
        try { fn(); } catch { /* ignore cleanup errors */ }
      });
    };
  }, []);
}
