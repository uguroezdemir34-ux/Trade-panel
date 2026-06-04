"use client";

/**
 * BROWSER NOTIFICATIONS — Web Notification API wrapper.
 *
 * Usage:
 *   browserNotify("Title", "Body text") — shows notification if permission granted
 *   requestBrowserPermission()           — requests permission (call once on user gesture)
 */

const ICON = "/icon-192.png"; // PWA icon (falls back gracefully if missing)

export function canNotify(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function notifyPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestBrowserPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function browserNotify(title: string, body: string): void {
  if (!canNotify()) return;
  try {
    const n = new Notification(title, { body, icon: ICON, tag: title, silent: false });
    // Auto-close after 6s
    setTimeout(() => n.close(), 6_000);
  } catch {
    // Ignore — some browsers block from non-user-gesture contexts
  }
}
