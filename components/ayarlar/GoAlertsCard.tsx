"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useT } from "@/lib/i18n/context";
import { notifyPermission, requestBrowserPermission } from "@/lib/notify/browser";

export function GoAlertsCard(): React.ReactElement {
  const t = useT();
  const enabled = useSettingsStore((s) => s.goAlertsEnabled);
  const setEnabled = useSettingsStore((s) => s.setGoAlertsEnabled);
  const audioEnabled = useSettingsStore((s) => s.audioAlertsEnabled);
  const setAudioEnabled = useSettingsStore((s) => s.setAudioAlertsEnabled);
  const telegram = useCredentialStore((s) => s.telegram);

  const telegramReady = !!telegram?.botToken || true; // also works via server env vars

  const title = t("settings.goAlerts.title");

  const [browserPerm, setBrowserPerm] = useState<ReturnType<typeof notifyPermission>>("default");
  useEffect(() => {
    setBrowserPerm(notifyPermission());
  }, []);

  async function handleRequestPerm() {
    const granted = await requestBrowserPermission();
    setBrowserPerm(granted ? "granted" : "denied");
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-text-t1 text-sm font-medium">⚡ {title}</h3>
            {enabled && (
              <span className="bg-soft-green text-signal-green rounded px-1.5 py-0.5 font-mono text-2xs tracking-wider">
                {t("common.on")}
              </span>
            )}
          </div>
          <p className="text-text-t3 mt-1 text-xs leading-relaxed">
            {t("settings.goAlerts.description")}
          </p>
          {enabled && !telegramReady && (
            <p className="text-amber-400 mt-2 text-xs">
              ⚠ {t("settings.goAlerts.noTelegram")}
            </p>
          )}
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          onClick={() => setEnabled(!enabled)}
          className={[
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            enabled ? "bg-brand" : "bg-border-strong",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Browser notification permission row */}
      {browserPerm !== "unsupported" && (
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-text-t2 text-xs font-medium">🔔 Tarayıcı Bildirimleri</span>
            <span className="text-text-t4 text-2xs font-mono">
              {browserPerm === "granted"
                ? "✓ İzin verildi — sekmeden çıkınca da bildirim gelir"
                : browserPerm === "denied"
                ? "✗ Engellendi — tarayıcı ayarlarından aç"
                : "Sinyal geldiğinde masaüstü bildirimi almak için izin ver"}
            </span>
          </div>
          {browserPerm === "default" && (
            <button
              onClick={handleRequestPerm}
              className="shrink-0 rounded border border-brand/40 bg-brand/10 px-3 py-1 font-mono text-2xs text-brand hover:bg-brand/20 transition-colors"
            >
              İzin Ver
            </button>
          )}
          {browserPerm === "granted" && (
            <span className="text-signal-green font-mono text-2xs">AKTİF</span>
          )}
        </div>
      )}

      {/* Audio alerts row */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-text-t2 text-xs font-medium">🔊 Sesli Uyarılar</span>
          <span className="text-text-t4 text-2xs font-mono">
            GO, skor momentumu ve fiyat alarmı için kısa bip sesi
          </span>
        </div>
        <button
          role="switch"
          aria-checked={audioEnabled}
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={[
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            audioEnabled ? "bg-brand" : "bg-border-strong",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              audioEnabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}
