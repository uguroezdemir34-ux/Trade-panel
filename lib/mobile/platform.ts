"use client";

/**
 * PLATFORM DETECTION — Capacitor native vs web tarayıcı tespiti.
 *
 * Capacitor native app: window.Capacitor.isNativePlatform() === true
 * PWA / tarayıcı: false
 *
 * SSR safe — server'da her zaman false döner.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => "ios" | "android" | "web";
}

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** Capacitor native ortamında mı çalışıyor? */
export function isNativePlatform(): boolean {
  return getCapacitor()?.isNativePlatform?.() ?? false;
}

/** Hangi platform: ios | android | web */
export function getPlatform(): "ios" | "android" | "web" {
  return getCapacitor()?.getPlatform?.() ?? "web";
}

/** iOS native mi? */
export function isIOS(): boolean {
  return getPlatform() === "ios";
}

/** Android native mi? */
export function isAndroid(): boolean {
  return getPlatform() === "android";
}

/** Mobil tarayıcı veya native mi? */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}
