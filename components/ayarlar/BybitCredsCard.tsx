"use client";

import { useState } from "react";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useT } from "@/lib/i18n/context";
import { EXECUTION_ENABLED } from "@/lib/config/execution";

export function BybitCredsCard(): React.ReactElement {
  const t = useT();
  const bybitFutures = useCredentialStore((s) => s.bybitFutures);
  const setBybitFutures = useCredentialStore((s) => s.setBybitFutures);
  const activeExchange = useSettingsStore((s) => s.activeExchange);
  const setActiveExchange = useSettingsStore((s) => s.setActiveExchange);

  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!key.trim() || !secret.trim()) return;
    setSaving(true);
    await setBybitFutures({ key: key.trim(), secret: secret.trim() });
    setSaving(false);
    setSaved(true);
    setKey("");
    setSecret("");
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await setBybitFutures(null);
    if (activeExchange === "bybit") setActiveExchange("okx");
  }

  const isActive = activeExchange === "bybit";

  return (
    <div
      className={[
        "rounded-lg border p-4 transition-colors",
        isActive ? "border-orange-500/60 bg-orange-950/10" : "border-border bg-bg-card",
      ].join(" ")}
    >
      {/* Header + exchange selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-text-t1">
            {t("settings.bybitCreds.title")}
          </p>
          <p className="mt-0.5 font-mono text-xs text-text-t3">
            {t("settings.bybitCreds.subtitle")}
          </p>
          {!EXECUTION_ENABLED && (
            <p className="mt-1 font-mono text-[10px] text-amber-400/70">
              ⚙ Sinyal modu — yalnızca bakiye görüntüleme, emir gönderme devre dışı
            </p>
          )}
        </div>
        {bybitFutures && (
          <button
            type="button"
            onClick={() => setActiveExchange(isActive ? "okx" : "bybit")}
            className={[
              "rounded px-3 py-1 font-mono text-xs font-semibold transition-colors",
              isActive
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                : "bg-surface-2 text-text-t3 border border-border",
            ].join(" ")}
          >
            {isActive ? t("settings.bybitCreds.active") : t("settings.bybitCreds.setActive")}
          </button>
        )}
      </div>

      {/* Status */}
      {bybitFutures ? (
        <div className="mt-3 flex items-center justify-between rounded border border-green-500/30 bg-green-950/20 px-3 py-2">
          <span className="font-mono text-xs text-green-400">
            ✓ {t("settings.bybitCreds.saved")}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="font-mono text-xs text-text-t3 hover:text-red-400 transition-colors"
          >
            {t("settings.bybitCreds.clear")}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="password"
            placeholder={t("settings.bybitCreds.keyPlaceholder")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.bybitCreds.secretPlaceholder")}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !key.trim() || !secret.trim()}
            className="w-full rounded bg-brand py-2 font-mono text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saved ? "✓ " + t("settings.bybitCreds.saveSuccess") : t("settings.bybitCreds.save")}
          </button>
        </div>
      )}

      {/* Note */}
      <div className="mt-3 rounded border border-orange-500/30 bg-orange-950/20 p-2">
        <p className="font-mono text-xs text-orange-400">
          ⚠ {t("settings.bybitCreds.note")}
        </p>
      </div>
    </div>
  );
}
