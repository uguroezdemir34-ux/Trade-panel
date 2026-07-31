"use client";

/**
 * NOTIFICATION CONFIG CARD — admin-only, Telegram bot token/chat ID'lerini
 * Vercel Environment Variables yerine doğrudan uygulama içinden (Supabase'e
 * AES-256-GCM şifreli) kaydeder.
 *
 * Neden: Vercel'e elle env var girmek hataya çok açık çıktı (kullanıcı
 * token'ı doğru girdiğini düşünse de env listesinde hiç görünmeyebiliyor,
 * ya da yanlış environment'a/isimle eklenebiliyor). Bu kart, admin bir kez
 * kurulduktan sonra bot token/chat ID rotasyonunu tamamen uygulama içinden
 * yapabilsin diye eklendi — STATE_ENCRYPTION_KEY (şifreleme anahtarı) hâlâ
 * Vercel'de duruyor ama ona bir daha dokunmaya gerek yok.
 *
 * Admin kontrolü AdminPanelCard.tsx ile AYNI desen (/api/admin/whoami
 * round-trip — ADMIN_USER_IDS client'a hiç sızmaz). Kaydedilen değerler
 * ASLA geri okunmuyor/gösterilmiyor (mevcut OKX/Telegram Layer 2
 * kartlarıyla aynı write-only pratik, kullanıcı kararı) — sadece
 * "yapılandırıldı" boolean'ı gösteriliyor.
 *
 * BİLEREK useT() KULLANMIYOR — AdminPanelCard.tsx'teki aynı gerekçe: bu
 * admin-only bir kontrol, tek admin (kurucu) Türkçe okuyor.
 */

import { useEffect, useState } from "react";

interface ConfigStatus {
  telegramBotToken: boolean;
  telegramVipChatId: boolean;
  telegramPublicChatId: boolean;
}

type SaveStatus = "idle" | "loading" | "success" | "error";

export function NotificationConfigCard(): React.ReactElement | null {
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [botToken, setBotToken] = useState("");
  const [vipChatId, setVipChatId] = useState("");
  const [publicChatId, setPublicChatId] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/whoami")
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => {
        if (!cancelled) setIsAdmin(data.isAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/api/admin/notification-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConfigStatus | null) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function handleSave(): Promise<void> {
    setSaveStatus("loading");
    try {
      const body: Record<string, string> = {};
      if (botToken.trim()) body.telegramBotToken = botToken.trim();
      if (vipChatId.trim()) body.telegramVipChatId = vipChatId.trim();
      if (publicChatId.trim()) body.telegramPublicChatId = publicChatId.trim();

      const res = await fetch("/api/admin/notification-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");

      setBotToken("");
      setVipChatId("");
      setPublicChatId("");
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);

      const statusRes = await fetch("/api/admin/notification-config");
      if (statusRes.ok) setStatus((await statusRes.json()) as ConfigStatus);
    } catch {
      setSaveStatus("error");
    }
  }

  if (!isAdmin) return null;

  const nothingToSave = !botToken.trim() && !vipChatId.trim() && !publicChatId.trim();

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-text-t1 text-sm font-medium">Telegram Yapılandırması (DB)</h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          Bot token ve chat ID&apos;ler Vercel env yerine buradan, şifreli olarak
          kaydedilir. Env değişkenleri hâlâ yedek olarak çalışmaya devam eder.
        </p>
      </div>

      {status && (
        <div className="mb-3 flex flex-col gap-1 font-mono text-2xs text-text-t3">
          <span>Bot Token: {status.telegramBotToken ? "✓ Yapılandırıldı" : "— Yok"}</span>
          <span>VIP Chat ID: {status.telegramVipChatId ? "✓ Yapılandırıldı" : "— Yok"}</span>
          <span>Public Chat ID: {status.telegramPublicChatId ? "✓ Yapılandırıldı" : "— Yok"}</span>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
            Bot Token
          </label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456789:AAE..."
            className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
            VIP Chat ID
          </label>
          <input
            type="text"
            value={vipChatId}
            onChange={(e) => setVipChatId(e.target.value)}
            placeholder="-100..."
            className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="text-text-t3 font-mono text-2xs tracking-wider block mb-1">
            Public Chat ID (opsiyonel)
          </label>
          <input
            type="text"
            value={publicChatId}
            onChange={(e) => setPublicChatId(e.target.value)}
            placeholder="-100..."
            className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none focus:border-text-t3"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveStatus === "loading" || nothingToSave}
          className="border-border hover:bg-bg-page disabled:opacity-40 rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors"
        >
          {saveStatus === "loading" ? "Kaydediliyor..." : "Kaydet"}
        </button>
        {saveStatus === "success" && (
          <p className="text-signal-green font-mono text-2xs">✓ Kaydedildi</p>
        )}
        {saveStatus === "error" && (
          <p className="text-signal-red font-mono text-2xs">✗ Kaydetme başarısız</p>
        )}
      </div>
    </div>
  );
}
