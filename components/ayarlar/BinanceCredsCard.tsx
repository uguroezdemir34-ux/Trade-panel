"use client";

import { useState } from "react";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useT } from "@/lib/i18n/context";
import { EXECUTION_ENABLED } from "@/lib/config/execution";

export function BinanceCredsCard(): React.ReactElement {
  const t = useT();
  const bnbFutures = useCredentialStore((s) => s.bnbFutures);
  const setBnbFutures = useCredentialStore((s) => s.setBnbFutures);
  const activeExchange = useSettingsStore((s) => s.activeExchange);
  const setActiveExchange = useSettingsStore((s) => s.setActiveExchange);

  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!key.trim() || !secret.trim()) return;
    setSaving(true);
    await setBnbFutures({ key: key.trim(), secret: secret.trim() });
    setSaving(false);
    setSaved(true);
    setKey("");
    setSecret("");
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await setBnbFutures(null);
    if (activeExchange === "binance") setActiveExchange("okx");
  }

  const isActive = activeExchange === "binance";

  return (
    <div
      className={[
        "rounded-lg border p-4 transition-colors",
        isActive ? "border-yellow-500/60 bg-yellow-950/10" : "border-border bg-bg-card",
      ].join(" ")}
    >
      {/* Header + exchange selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-text-t1">
            {t("settings.binanceCreds.title")}
          </p>
          <p className="mt-0.5 font-mono text-xs text-text-t3">
            {t("settings.binanceCreds.subtitle")}
          </p>
          {!EXECUTION_ENABLED && (
            <p className="mt-1 font-mono text-[10px] text-amber-400/70">
              {t("settings.signalModeBalanceOnly")}
            </p>
          )}
        </div>
        {bnbFutures && (
          <button
            type="button"
            onClick={() => setActiveExchange(isActive ? "okx" : "binance")}
            className={[
              "rounded px-3 py-1 font-mono text-xs font-semibold transition-colors",
              isActive
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                : "bg-surface-2 text-text-t3 border border-border",
            ].join(" ")}
          >
            {isActive ? t("settings.binanceCreds.active") : t("settings.binanceCreds.setActive")}
          </button>
        )}
      </div>

      {/* Status */}
      {bnbFutures ? (
        <div className="mt-3 flex items-center justify-between rounded border border-green-500/30 bg-green-950/20 px-3 py-2">
          <span className="font-mono text-xs text-green-400">
            ✓ {t("settings.binanceCreds.saved")}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="font-mono text-xs text-text-t3 hover:text-red-400 transition-colors"
          >
            {t("settings.binanceCreds.clear")}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="password"
            placeholder={t("settings.binanceCreds.keyPlaceholder")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.binanceCreds.secretPlaceholder")}
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
            {saved ? "✓ " + t("settings.binanceCreds.saveSuccess") : t("settings.binanceCreds.save")}
          </button>
        </div>
      )}

      {/* Hedge mode warning */}
      <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-950/20 p-2">
        <p className="font-mono text-xs text-yellow-500">
          ⚠ {t("settings.binanceCreds.hedgeWarning")}
        </p>
      </div>
    </div>
  );
}
