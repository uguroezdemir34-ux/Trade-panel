"use client";

/**
 * HAPTICS HOOK — Dokunsal geri bildirim soyutlama katmanı.
 *
 * Web (PWA): navigator.vibrate API
 * Native (Capacitor): @capacitor/haptics plugin (dynamic import)
 *
 * Kullanım:
 *   const haptics = useHaptics();
 *   haptics.success();   // İşlem başarılı
 *   haptics.error();     // İşlem başarısız
 *   haptics.light();     // Hafif dokunuş (button press)
 *   haptics.medium();    // Orta dokunuş (tab change)
 *   haptics.heavy();     // Güçlü dokunuş (kritik eylem)
 */

import { useCallback } from "react";
import { isNativePlatform } from "@/lib/mobile/platform";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "error" | "warning";

const WEB_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 20,
  heavy: [25, 10, 25],
  success: [10, 5, 10, 5, 15],
  error: [80, 30, 80],
  warning: [20, 10, 20, 10],
};

function webVibrate(style: HapticStyle): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(WEB_PATTERNS[style]);
  }
}

async function nativeHaptic(style: HapticStyle): Promise<void> {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import(
      "@capacitor/haptics"
    );
    if (style === "success") {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (style === "error") {
      await Haptics.notification({ type: NotificationType.Error });
    } else if (style === "warning") {
      await Haptics.notification({ type: NotificationType.Warning });
    } else {
      const impactMap: Record<string, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: impactMap[style] ?? ImpactStyle.Medium });
    }
  } catch {
    // Plugin yüklü değil veya desteklenmiyor — sessizce devam et
  }
}

export function useHaptics() {
  const trigger = useCallback((style: HapticStyle) => {
    if (isNativePlatform()) {
      void nativeHaptic(style);
    } else {
      webVibrate(style);
    }
  }, []);

  return {
    light: () => trigger("light"),
    medium: () => trigger("medium"),
    heavy: () => trigger("heavy"),
    success: () => trigger("success"),
    error: () => trigger("error"),
    warning: () => trigger("warning"),
  };
}
