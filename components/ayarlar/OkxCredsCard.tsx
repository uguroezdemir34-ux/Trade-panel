"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useCredentialStore, type OkxCreds } from "@/lib/store/credentialStore";
import { EXECUTION_ENABLED } from "@/lib/config/execution";

export function OkxCredsCard(): React.ReactElement {
  const t = useT();
  const { okxProd, okxDemo, setOkxProd, setOkxDemo, _loaded } = useCredentialStore();

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="font-mono text-sm font-semibold text-text-t1">
          {t("settings.okx.title")}
        </h3>
        <p className="font-mono text-xs text-text-t3 mt-0.5">
          {t("settings.okx.description")}
        </p>
        {!EXECUTION_ENABLED && (
          <p className="mt-1 font-mono text-xs text-amber-400/80">
            ⚙ Sinyal modu: API key yalnızca bakiye ve pozisyon görüntüleme için kullanılır.
            Emir gönderme izni gerekmez — <strong>read-only</strong> key yeterlidir.
          </p>
        )}
      </div>

      {_loaded && (
        <>
          <KeySection
            label={t("settings.okx.prodKeys")}
            current={okxProd}
            onSave={setOkxProd}
            onClear={() => setOkxProd(null)}
            t={t}
          />
          <KeySection
            label={t("settings.okx.demoKeys")}
            current={okxDemo}
            onSave={setOkxDemo}
            onClear={() => setOkxDemo(null)}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function KeySection({
  label,
  current,
  onSave,
  onClear,
  t,
}: {
  label: string;
  current: OkxCreds | null;
  onSave: (c: OkxCreds) => Promise<void>;
  onClear: () => Promise<void>;
  t: ReturnType<typeof useT>;
}) {
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [pass, setPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!key.trim() || !secret.trim() || !pass.trim()) return;
    setSaving(true);
    await onSave({ key: key.trim(), secret: secret.trim(), pass: pass.trim() });
    setSaving(false);
    setKey(""); setSecret(""); setPass("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-text-t3 tracking-wider uppercase">{label}</p>

      {current ? (
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
