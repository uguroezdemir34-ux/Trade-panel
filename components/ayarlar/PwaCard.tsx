"use client";

import { useState, useCallback } from "react";
import { usePwaStore } from "@/lib/store/pwaStore";
import { useT } from "@/lib/i18n/context";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PwaCard(): React.ReactElement {
  const t = useT();
  const registration = usePwaStore((s) => s.registration);
  const installPrompt = usePwaStore((s) => s.installPrompt);
  const pushPermission = usePwaStore((s) => s.pushPermission);
  const setInstallPrompt = usePwaStore((s) => s.setInstallPrompt);
  const setPushPermission = usePwaStore((s) => s.setPushPermission);

  const [installing, setInstalling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(pushPermission === "granted");
  const [error, setError] = useState<string | null>(null);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      // BeforeInstallPromptEvent standart DOM lib'inde yok (non-standard
      // PWA install API) — installPrompt'un gerçek store tipi (Event) bu
      // shape'le yeterince örtüşmüyor, unknown üzerinden double-cast
      // gerekiyor (aynı desen: tests/integration/memory-pruning.test.ts).
      const prompt = installPrompt as unknown as { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } catch {
      // ignore
    } finally {
      setInstalling(false);
    }
  }, [installPrompt, setInstallPrompt]);

  const handlePushToggle = useCallback(async () => {
    setError(null);

    if (pushEnabled) {
      // Unsubscribe
      if (!registration) return;
      setSubscribing(true);
      try {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscription: sub.toJSON(),
              action: "unsubscribe",
            }),
          });
        }
        setPushEnabled(false);
        setPushPermission("default");
      } catch {
        setError(t("settings.pwa.errorUnsubscribe"));
      } finally {
        setSubscribing(false);
      }
      return;
    }

    // Subscribe
    if (!("Notification" in window)) {
      setError(t("settings.pwa.notSupported"));
      return;
    }
    if (!registration) {
      setError(t("settings.pwa.swNotReady"));
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError(t("settings.pwa.vapidNotConfigured"));
      return;
    }

    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== "granted") {
        setError(t("settings.pwa.permDenied"));
        setSubscribing(false);
        return;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), action: "subscribe" }),
      });

      if (!res.ok) throw new Error("Server error");
      setPushEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.pwa.errorSubscribe"));
    } finally {
      setSubscribing(false);
    }
  }, [pushEnabled, registration, setPushPermission, t]);

  const isInstalled =
    !installPrompt ||
    (typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches);

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <p className="font-mono text-sm font-semibold text-text-t1">
        {t("settings.pwa.title")}
      </p>
      <p className="mt-0.5 font-mono text-xs text-text-t3">
        {t("settings.pwa.subtitle")}
      </p>

      <div className="mt-4 space-y-3">
        {/* Install button */}
        {!isInstalled && installPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="w-full rounded border border-brand bg-brand/10 py-2 font-mono text-xs font-semibold text-brand hover:bg-brand/20 disabled:opacity-40 transition-colors"
          >
            {installing ? t("settings.pwa.installing") : t("settings.pwa.install")}
          </button>
        )}

        {isInstalled && (
          <div className="flex items-center gap-2 rounded border border-green-500/30 bg-green-950/20 px-3 py-2">
            <span className="font-mono text-xs text-green-400">
              ✓ {t("settings.pwa.installed")}
            </span>
          </div>
        )}

        {/* Push notifications */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-text-t2">
              {t("settings.pwa.pushTitle")}
            </p>
            <p className="font-mono text-xs text-text-t3">
              {t("settings.pwa.pushSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePushToggle}
            disabled={subscribing || pushPermission === "denied"}
            className={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40",
              pushEnabled ? "bg-brand" : "bg-surface-s2",
            ].join(" ")}
            role="switch"
            aria-checked={pushEnabled}
          >
            <span
              className={[
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                pushEnabled ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>
        </div>

        {pushPermission === "denied" && (
          <p className="font-mono text-xs text-red-400">
            {t("settings.pwa.permDenied")}
          </p>
        )}

        {error && (
          <p className="font-mono text-xs text-red-400">{error}</p>
        )}

        {!VAPID_PUBLIC_KEY && (
          <p className="font-mono text-xs text-text-t3">
            {t("settings.pwa.vapidNotConfigured")}
          </p>
        )}
      </div>
    </div>
  );
}
