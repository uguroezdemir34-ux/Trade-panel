"use client";

/**
 * OKX CREDS CARD — Dual-layer credential management.
 *
 * Layer 1: Server-side Vercel env vars (highest priority, shown as ENV badge).
 * Layer 2: Browser-stored AES-256-GCM encrypted credentials (shown as BROWSER badge).
 *
 * Security: actual key values are never displayed after saving.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useCredentialStore, type OkxCreds } from "@/lib/store/credentialStore";

interface OkxEnvStatus {
  prodConfigured: boolean;
  demoConfigured: boolean;
}

export function OkxCredsCard(): React.ReactElement {
  const t = useT();
  const [envStatus, setEnvStatus] = useState<OkxEnvStatus | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState<string | null>(null);

  const { okxProd, okxDemo, setOkxProd, setOkxDemo, _loaded } =
    useCredentialStore();

  useEffect(() => {
    let cancelled = false;
    setEnvLoading(true);
    setEnvError(null);

    fetch("/api/okx/check")
      .then(async (res) => {
        if (!res.ok) throw new Error("check failed");
        return res.json() as Promise<OkxEnvStatus>;
      })
      .then((data) => {
        if (cancelled) return;
        setEnvStatus(data);
        setEnvLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEnvError(t("settings.okx.checkError"));
        setEnvLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-text-t1 text-sm font-medium">
          {t("settings.okx.title")}
        </h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          {t("settings.okx.description")}
        </p>
      </div>

      {/* Status section */}
      <div className="space-y-3 mb-4">
        {/* Layer 1 status */}
        <div>
          <div className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-1.5">
            {t("settings.okx.layer1Label")}
          </div>
          {envLoading ? (
            <div className="text-text-t3 font-mono text-2xs tracking-wider">
              {t("settings.okx.checking")}
            </div>
          ) : envError ? (
            <div className="text-signal-red font-mono text-2xs">{envError}</div>
          ) : envStatus ? (
            <div className="flex gap-3">
              <LayerBadge
                label={t("settings.okx.prodLabel")}
                active={envStatus.prodConfigured}
                badge="ENV"
              />
              <LayerBadge
                label={t("settings.okx.demoLabel")}
                active={envStatus.demoConfigured}
                badge="ENV"
              />
            </div>
          ) : null}
        </div>

        {/* Layer 2 status */}
        {_loaded && (
          <div>
            <div className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-1.5">
              {t("settings.okx.layer2Label")}
            </div>
            <div className="flex gap-3">
              <LayerBadge
                label={t("settings.okx.prodLabel")}
                active={!!okxProd}
                badge="BROWSER"
                green
              />
              <LayerBadge
                label={t("settings.okx.demoLabel")}
                active={!!okxDemo}
                badge="BROWSER"
                green
              />
            </div>
          </div>
        )}
      </div>

      {/* Key entry forms */}
      <div className="space-y-3">
        <KeyForm
          label={t("settings.okx.prodKeys")}
          current={okxProd}
          onSave={setOkxProd}
          onClear={() => setOkxProd(null)}
          t={t}
        />
        <KeyForm
          label={t("settings.okx.demoKeys")}
          current={okxDemo}
          onSave={setOkxDemo}
          onClear={() => setOkxDemo(null)}
          t={t}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function LayerBadge({
  label,
  active,
  badge,
  green = false,
}: {
  label: string;
  active: boolean;
  badge: string;
  green?: boolean;
}) {
  const dotClass = active
    ? green
      ? "bg-signal-green"
      : "bg-signal-green"
    : "bg-text-t4";
  const textClass = active
    ? green
      ? "text-signal-green"
      : "text-signal-green"
    : "text-text-t3";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className="text-text-t2 font-mono text-2xs">{label}</span>
      {active && (
        <span
          className={`font-mono text-2xs font-bold tracking-widest uppercase ${textClass}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function KeyForm({
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
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [pass, setPass] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!key.trim() || !secret.trim() || !pass.trim()) return;
    await onSave({ key: key.trim(), secret: secret.trim(), pass: pass.trim() });
    setKey("");
    setSecret("");
    setPass("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setOpen(false);
  }

  async function handleClear() {
    await onClear();
    setKey("");
    setSecret("");
    setPass("");
  }

  return (
    <div className="border-border/50 rounded border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-text-t2 font-mono text-xs tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {current && (
            <span className="text-signal-green font-mono text-2xs font-bold tracking-widest uppercase">
              {t("settings.okx.keyActive")}
            </span>
          )}
          <span className="text-text-t3 font-mono text-2xs">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-border/50 border-t px-3 pb-3 pt-2 space-y-2">
          <div>
            <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
              {t("settings.okx.apiKey")}
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="••••••••••••"
              className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
              {t("settings.okx.apiSecret")}
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••••••"
              className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
              {t("settings.okx.passphrase")}
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••••••"
              className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!key.trim() || !secret.trim() || !pass.trim()}
              className="border-border hover:bg-bg-page disabled:opacity-40 rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors"
            >
              {t("settings.okx.saveKeys")}
            </button>
            {current && (
              <button
                type="button"
                onClick={handleClear}
                className="border-border hover:bg-bg-page rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors text-signal-red"
              >
                {t("settings.okx.clearKeys")}
              </button>
            )}
          </div>
          {saved && (
            <div className="text-signal-green font-mono text-2xs tracking-wider">
              ✓ {t("settings.okx.keySaved")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
