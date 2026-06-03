"use client";

/**
 * TELEGRAM TEST CARD — Dual-layer credential management + test message.
 *
 * Layer 1: Server-side Vercel env vars (TELEGRAM_BOT_TOKEN, TELEGRAM_VIP_CHAT_ID).
 * Layer 2: Browser-stored AES-256-GCM encrypted credentials via credentialStore.
 *
 * The test button sends a POST to /api/telegram/test, passing browser-stored
 * credentials when Layer 1 is not configured.
 */

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useCredentialStore, type TelegramCreds } from "@/lib/store/credentialStore";

type TestStatus = "idle" | "loading" | "success" | "not_configured" | "error";

export function TelegramTestCard(): React.ReactElement {
  const t = useT();
  const [status, setStatus] = useState<TestStatus>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const { telegram, setTelegram, _loaded } = useCredentialStore();

  // Local form state
  const [formOpen, setFormOpen] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!botToken.trim() || !chatId.trim()) return;
    const creds: TelegramCreds = {
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    };
    await setTelegram(creds);
    setBotToken("");
    setChatId("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setFormOpen(false);
  }

  async function handleClear() {
    await setTelegram(null);
    setBotToken("");
    setChatId("");
  }

  async function handleTest() {
    setStatus("loading");
    setErrorDetail(null);
    try {
      const body: Record<string, string> = {};

      // Prefer stored credentials; fall back to current form values (unsaved)
      const resolvedToken = telegram?.botToken?.trim() || botToken.trim();
      const resolvedChatId = telegram?.chatId?.trim() || chatId.trim();
      if (resolvedToken) body.botToken = resolvedToken;
      if (resolvedChatId) body.chatId = resolvedChatId;

      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data: { ok: boolean; error?: string; errorCode?: number };
      try {
        data = await res.json();
      } catch {
        setStatus("error");
        setErrorDetail(`HTTP ${res.status} — sunucu JSON dönmedi`);
        return;
      }

      if (data.ok) {
        setStatus("success");
      } else if (data.error === "not_configured") {
        setStatus("not_configured");
      } else {
        setStatus("error");
        const code = data.errorCode ? ` (${data.errorCode})` : "";
        setErrorDetail((data.error ?? "Telegram API error") + code);
      }
    } catch (e) {
      setStatus("error");
      setErrorDetail(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-text-t1 text-sm font-medium">
          {t("settings.telegram.title")}
        </h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          {t("settings.telegram.description")}
        </p>
      </div>

      {/* Layer 2 status */}
      {_loaded && (
        <div className="mb-3">
          <div className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-1.5">
            {t("settings.telegram.layer2Label")}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${telegram ? "bg-signal-green" : "bg-text-t4"}`}
            />
            <span className="text-text-t2 font-mono text-2xs">
              {t("settings.telegram.title")}
            </span>
            {telegram && (
              <span className="text-signal-green font-mono text-2xs font-bold tracking-widest uppercase">
                {t("settings.telegram.keyActive")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Credential entry form */}
      <div className="border-border/50 rounded border mb-3">
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-text-t2 font-mono text-xs tracking-wider">
            {t("settings.telegram.title")}
          </span>
          <div className="flex items-center gap-2">
            {telegram && (
              <span className="text-signal-green font-mono text-2xs font-bold tracking-widest uppercase">
                {t("settings.telegram.keyActive")}
              </span>
            )}
            <span className="text-text-t3 font-mono text-2xs">
              {formOpen ? "▲" : "▼"}
            </span>
          </div>
        </button>

        {formOpen && (
          <div className="border-border/50 border-t px-3 pb-3 pt-2 space-y-2">
            <div>
              <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
                {t("settings.telegram.botToken")}
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="••••••••••••"
                className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
                {t("settings.telegram.chatId")}
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-100••••••••"
                className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={!botToken.trim() || !chatId.trim()}
                className="border-border hover:bg-bg-page disabled:opacity-40 rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors"
              >
                {t("settings.telegram.saveKeys")}
              </button>
              {telegram && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="border-border hover:bg-bg-page rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors text-signal-red"
                >
                  {t("settings.telegram.clearKeys")}
                </button>
              )}
            </div>
            {saved && (
              <div className="text-signal-green font-mono text-2xs tracking-wider">
                ✓ {t("settings.telegram.keySaved")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test button */}
      <button
        type="button"
        onClick={handleTest}
        disabled={status === "loading"}
        className="border-border hover:bg-bg-page disabled:opacity-50 rounded border px-3 py-1.5 font-mono text-2xs tracking-widest uppercase transition-colors"
      >
        {status === "loading"
          ? t("settings.telegram.testing")
          : t("settings.telegram.testButton")}
      </button>

      {status === "success" && (
        <div className="text-signal-green mt-3 font-mono text-2xs tracking-wider">
          ✓ {t("settings.telegram.success")}
        </div>
      )}

      {status === "not_configured" && (
        <div className="mt-3 rounded border border-amber-400/30 bg-amber-400/8 px-3 py-2 font-mono text-2xs leading-relaxed text-signal-amber">
          ⚠ Bot token veya Chat ID girilmedi.
          <div className="text-text-t3 mt-1">
            Formu doldurup önce &ldquo;SAVE&rdquo; tuşuna bas, sonra tekrar dene.
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/8 px-3 py-2 font-mono text-xs leading-relaxed text-signal-red">
          ✗ Telegram API hatası
          {errorDetail && (
            <div className="mt-1 break-all font-mono text-2xs text-text-t3">
              {errorDetail}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
