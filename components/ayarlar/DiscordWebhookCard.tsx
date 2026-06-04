"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { sendDiscordMessage } from "@/lib/notify/discord/channel";

type TestStatus = "idle" | "loading" | "success" | "error";

export function DiscordWebhookCard(): React.ReactElement {
  const t = useT();
  const { discordWebhookUrl, setDiscordWebhookUrl } = useSettingsStore();

  const [urlInput, setUrlInput] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  function handleSave() {
    const url = urlInput.trim();
    if (!url) return;
    setDiscordWebhookUrl(url);
    setUrlInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setEditOpen(false);
  }

  function handleClear() {
    setDiscordWebhookUrl(null);
    setUrlInput("");
  }

  async function handleTest() {
    const url = discordWebhookUrl ?? urlInput.trim();
    if (!url) {
      setStatus("error");
      setErrorDetail(t("settings.discord.noUrl"));
      return;
    }
    setStatus("loading");
    setErrorDetail(null);
    try {
      const result = await sendDiscordMessage(url, { kind: "test" });
      if (result.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorDetail(result.errorMessage ?? "Unknown error");
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
          {t("settings.discord.title")}
        </h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          {t("settings.discord.subtitle")}
        </p>
      </div>

      {/* Status indicator */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${discordWebhookUrl ? "bg-signal-green" : "bg-text-t4"}`} />
        <span className="text-text-t2 font-mono text-2xs">
          {discordWebhookUrl
            ? t("settings.discord.configured")
            : t("settings.discord.notConfigured")}
        </span>
      </div>

      {/* URL input accordion */}
      <div className="border-border/50 rounded border mb-3">
        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-text-t2 font-mono text-xs tracking-wider">
            {t("settings.discord.urlLabel")}
          </span>
          <span className="text-text-t3 font-mono text-2xs">{editOpen ? "▲" : "▼"}</span>
        </button>

        {editOpen && (
          <div className="border-border/50 border-t px-3 pb-3 pt-2 space-y-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t("settings.discord.urlPlaceholder")}
              className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
              autoComplete="off"
            />
            <p className="text-text-t4 font-mono text-2xs">{t("settings.discord.howTo")}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={!urlInput.trim()}
                className="border-border hover:bg-bg-page disabled:opacity-40 rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors"
              >
                {t("settings.discord.save")}
              </button>
              {discordWebhookUrl && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="border-border hover:bg-bg-page rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors text-signal-red"
                >
                  {t("settings.discord.clear")}
                </button>
              )}
            </div>
            {saved && (
              <div className="text-signal-green font-mono text-2xs tracking-wider">
                ✓ {t("settings.discord.saved")}
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
        {status === "loading" ? t("settings.discord.testing") : t("settings.discord.testButton")}
      </button>

      {status === "success" && (
        <div className="text-signal-green mt-3 font-mono text-2xs tracking-wider">
          ✓ {t("settings.discord.success")}
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/8 px-3 py-2 font-mono text-xs leading-relaxed text-signal-red">
          ✗ {t("settings.discord.error")}
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
