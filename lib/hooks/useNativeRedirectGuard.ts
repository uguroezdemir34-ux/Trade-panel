"use client";

/**
 * NATIVE REDIRECT GUARD — Android app'te (Capacitor native shell) gerçek
 * hesap/pozisyon verisi gösteren sayfalara erişimi engeller, /karar'a
 * yönlendirir.
 *
 * Google Play Financial Features kapsamını daraltmak için: native app
 * salt sinyal+backtest aracı, hesap/pozisyon/P&L verisi sadece web'de
 * (quantixos.com, tarayıcıdan) sunuluyor. Bkz. components/mobile/
 * QuickTradeSheet.tsx'teki aynı desenin emir-açma tarafı.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativePlatform } from "@/lib/mobile/platform";

/** true dönerse çağıran sayfa hiçbir şey render etmemeli (redirect zaten tetiklendi). */
export function useNativeRedirectGuard(): boolean {
  const router = useRouter();
  const native = isNativePlatform();

  useEffect(() => {
    if (native) router.replace("/karar");
  }, [native, router]);

  return native;
}
