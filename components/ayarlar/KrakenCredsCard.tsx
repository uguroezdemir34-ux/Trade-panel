"use client";

import { useState } from "react";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useT } from "@/lib/i18n/context";
import { EXECUTION_ENABLED } from "@/lib/config/execution";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { usePinLockStore } from "@/lib/store/pinLockStore";

export function KrakenCredsCard(): React.ReactElement {
  return (
    <SubscriptionGate feature="multiExchange">
      <KrakenCredsCardInner />
    </SubscriptionGate>
  );
}

function KrakenCredsCardInner(): React.ReactElement {
  const t = useT();
  const krakenFutures = useCredentialStore((s) => s.krakenFutures);
  const setKrakenFutures = useCredentialStore((s) => s.setKrakenFutures);
  const activeExchange = useSettingsStore((s) => s.activeExchange);
  const setActiveExchange = useSettingsStore((s) => s.setActiveExchange);

  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const unlocked = usePinLockStore((s) => s.unlocked);

  async function handleSave() {
    if (!key.trim() || !secret.trim()) return;
    setSaving(true);
    await setKrakenFutures({ key: key.trim(), secret: secret.trim() });
    setSaving(false);
    setSaved(true);
    setKey("");
    setSecret("");
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await setKrakenFutures(null);
    if (activeExchange === "kraken") setActiveExchange("okx");
  }

  const isActive = activeExchange === "kraken";

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
            {t("settings.krakenCreds.title")}
          </p>
          <p className="mt-0.5 font-mono text-xs text-text-t3">
            {t("settings.krakenCreds.subtitle")}
          </p>
          {!EXECUTION_ENABLED && (
            <p className="mt-1 font-mono text-[10px] text-amber-400/70">
              {t("settings.signalModeBalanceOnly")}
            </p>
          )}
        </div>
        {krakenFutures && (
          <button
            type="button"
            onClick={() => setActiveExchange(isActive ? "okx" : "kraken")}
            className={[
              "rounded px-3 py-1 font-mono text-xs font-semibold transition-colors",
              isActive
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                : "bg-surface-2 text-text-t3 border border-border",
            ].join(" ")}
          >
            {isActive ? t("settings.krakenCreds.active") : t("settings.krakenCreds.setActive")}
          </button>
        )}
      </div>

      {/* Status */}
      {krakenFutures ? (
        <div className="mt-3 flex items-center justify-between rounded border border-green-500/30 bg-green-950/20 px-3 py-2">
          <span className="font-mono text-xs text-green-400">
            ✓ {t("settings.krakenCreds.saved")}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="font-mono text-xs text-text-t3 hover:text-red-400 transition-colors"
          >
            {t("settings.krakenCreds.clear")}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="password"
            placeholder={t("settings.krakenCreds.keyPlaceholder")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.krakenCreds.secretPlaceholder")}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!unlocked || saving || !key.trim() || !secret.trim()}
            className="w-full rounded bg-brand py-2 font-mono text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {!unlocked
              ? "🔒 PIN Kilidini Açın"
              : saved
                ? "✓ " + t("settings.krakenCreds.saveSuccess")
                : t("settings.krakenCreds.save")}
          </button>
        </div>
      )}

      {/* Note */}
      <div className="mt-3 rounded border border-orange-500/30 bg-orange-950/20 p-2">
        <p className="font-mono text-xs text-orange-400">
          ⚠ {t("settings.krakenCreds.note")}
        </p>
      </div>

      {/* Ekstra uyarı — diğer 4 borsadan farklı: pozisyon büyüklüğü hesabı
          gerçek bir hesapla doğrulanmadı (bkz. lib/kraken/positions.ts
          KRİTİK DOĞRULANMAMIŞ VARSAYIM yorumu). Kullanıcının bunu bilerek
          aktif etmesi için standart notadan ayrı, daha belirgin bir uyarı. */}
      <div className="mt-2 rounded border border-red-500/30 bg-red-950/20 p-2">
        <p className="font-mono text-xs text-red-400">
          ⚠ {t("settings.krakenCreds.experimentalWarning")}
        </p>
      </div>
    </div>
  );
}
