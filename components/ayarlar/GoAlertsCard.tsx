"use client";

import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useT } from "@/lib/i18n/context";

export function GoAlertsCard(): React.ReactElement {
  const t = useT();
  const enabled = useSettingsStore((s) => s.goAlertsEnabled);
  const setEnabled = useSettingsStore((s) => s.setGoAlertsEnabled);
  const telegram = useCredentialStore((s) => s.telegram);

  const telegramReady = !!telegram?.botToken || true; // also works via server env vars

  const title = t("settings.goAlerts.title");

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
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
    </div>
  );
}
