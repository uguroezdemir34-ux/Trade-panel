"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useCredentialStore, type OkxCreds } from "@/lib/store/credentialStore";
import { useAuthStub } from "@/lib/auth/stubs";

export function OkxCredsCard(): React.ReactElement {
  const t = useT();
  const { userId } = useAuthStub();
  const { okxProdConfigured, okxDemoConfigured, setOkxProd, setOkxDemo, _loaded } =
    useCredentialStore();

  // Not logged in — no insecure fallback, show explicit warning
  if (!userId) {
    return (
      <div className="border-border bg-bg-card rounded-lg border p-4 space-y-3">
        <h3 className="font-mono text-sm font-semibold text-text-t1">
          {t("settings.okx.title")}
        </h3>
        <div className="rounded border border-amber-500/40 bg-amber-950/25 px-3 py-2.5">
          <p className="font-mono text-xs text-amber-400">
            ⚠ {t("settings.okx.noAuthWarning")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="font-mono text-sm font-semibold text-text-t1">
          {t("settings.okx.title")}
        </h3>
        <p className="font-mono text-xs text-text-t3 mt-0.5">
          {t("settings.okx.description")}
        </p>
        {/* Withdrawal security warning */}
        <div className="mt-2 rounded border border-signal-red/30 bg-signal-red/8 px-2.5 py-2">
          <p className="font-mono text-xs text-signal-red/90">
            🔒 {t("settings.okx.withdrawalNote")}
          </p>
        </div>
      </div>

      {_loaded && (
        <>
          <KeySection
            label={t("settings.okx.prodKeys")}
            configured={okxProdConfigured}
            onSave={(c) => setOkxProd(c)}
            onClear={() => setOkxProd(null)}
            isDemo={false}
            t={t}
          />
          <KeySection
            label={t("settings.okx.demoKeys")}
            configured={okxDemoConfigured}
            onSave={(c) => setOkxDemo(c)}
            onClear={() => setOkxDemo(null)}
            isDemo={true}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function KeySection({
  label,
  configured,
  onSave,
  onClear,
  t,
}: {
  label: string;
  configured: boolean;
  onSave: (c: OkxCreds) => Promise<void>;
  onClear: () => Promise<void>;
  isDemo: boolean;
  t: ReturnType<typeof useT>;
}) {
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [pass, setPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!key.trim() || !secret.trim() || !pass.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ key: key.trim(), secret: secret.trim(), pass: pass.trim() });
      setKey(""); setSecret(""); setPass("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Save failed — check server logs.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-text-t3 tracking-wider uppercase">{label}</p>

      {configured ? (
        <div className="flex items-center justify-between rounded border border-green-500/30 bg-green-950/20 px-3 py-2">
          <span className="font-mono text-xs text-green-400">
            ✓ {t("settings.okx.keyActive")}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-xs text-text-t3 hover:text-red-400 transition-colors"
          >
            {t("settings.okx.clearKeys")}
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder={t("settings.okx.apiKey")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.okx.apiSecret")}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.okx.passphrase")}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t3 focus:border-brand focus:outline-none"
          />
          {error && (
            <p className="font-mono text-xs text-signal-red">{error}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !key.trim() || !secret.trim() || !pass.trim()}
            className="w-full rounded bg-brand py-2 font-mono text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saved ? "✓ " + t("settings.okx.keySaved") : t("settings.okx.saveKeys")}
          </button>
        </>
      )}
    </div>
  );
}
