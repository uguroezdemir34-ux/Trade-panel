"use client";

/**
 * CHANNEL CONNECTION CARD — 5 kanal için hızlı durum özeti (Telegram,
 * Discord, YouTube, TikTok, X). DiscordWebhookCard'ın YERİNE geçmiyor —
 * o kimlik bilgisi giriş/düzenleme arayüzü olarak aynen kalıyor, bu kart
 * sadece üstte bir durum özeti.
 *
 * TELEGRAM — durum /api/settings/channel-status'tan (server env,
 * TELEGRAM_BOT_TOKEN + TELEGRAM_VIP_CHAT_ID) okunuyor. Test butonu
 * BİLEREK KALDIRILDI (3 farklı Telegram yeri kafa karıştırıyordu, bkz.
 * NotificationConfigCard.tsx) — token/chat ID girişi + test artık TEK
 * yerde: NotificationConfigCard (admin-only, DB'ye şifreli yazan, gerçek
 * çalışan sistem). Burada sadece durum noktası kalıyor, sekmeler arası
 * hızlı bir genel bakış için.
 *
 * DISCORD — KASITLI OLARAK env DEĞİL, client-side store'dan okunuyor
 * (kullanıcı kararı, bkz. app/api/settings/channel-status/route.ts
 * yorumu): DISCORD_WEBHOOK_URL diye bir env var .env.example'da
 * dokümante edilmiş ama hiçbir kod bunu process.env üzerinden okumuyor —
 * gerçek konfigürasyon useSettingsStore().discordWebhookUrl (tarayıcı
 * localStorage). Bu, mevcut kullanıcı-bazlı webhook modelini bozmadan en
 * küçük/en geri-dönüşü-kolay seçenekti.
 *
 * YOUTUBE / TIKTOK / X — bilerek buton YOK, sadece "Entegre değil"
 * durumu. Fizibilite araştırmasıyla ayrı, daha büyük bir "sosyal medya
 * dağıtım" backlog maddesi olarak bırakıldı (X pay-per-use ücretli,
 * YouTube'un public API'sinde metin-postu endpoint'i hiç yok — sadece
 * video yükleme, TikTok Content Posting API onay/inceleme gerektiriyor) —
 * bu round'da hiç kod yazılmadı, kullanıcı kararı.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { sendDiscordMessage } from "@/lib/notify/discord/channel";

type TestStatus = "idle" | "loading" | "success" | "error";

function StatusDot({ ok }: { ok: boolean }): React.ReactElement {
  return <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-signal-green" : "bg-text-t4"}`} />;
}

export function ChannelConnectionCard(): React.ReactElement {
  const t = useT();
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<TestStatus>("idle");

  const discordWebhookUrl = useSettingsStore((s) => s.discordWebhookUrl);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/channel-status")
      .then((res) => (res.ok ? res.json() : { telegram: false }))
      .then((data: { telegram?: boolean }) => {
        if (!cancelled) setTelegramConfigured(data.telegram === true);
      })
      .catch(() => {
        if (!cancelled) setTelegramConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDiscordTest(): Promise<void> {
    if (!discordWebhookUrl) return;
    setDiscordStatus("loading");
    try {
      const result = await sendDiscordMessage(discordWebhookUrl, { kind: "test" });
      setDiscordStatus(result.ok ? "success" : "error");
    } catch {
      setDiscordStatus("error");
    }
  }

  // !== null değil !!(...): loadFromStorage() şema doğrulamasından geçen HER
  // string'i (boş string dahil) kabul ediyor — bugün "" kaydeden bir kod yolu
  // yok (DiscordWebhookCard boş girişi zaten engelliyor), ama ileride/geçmiş
  // bir localStorage durumunda "" olursa bile burası "yapılandırılmadı" saysın.
  const discordConfigured = !!discordWebhookUrl;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-text-t1 text-sm font-medium">{t("settings.channelStatus.title")}</h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          {t("settings.channelStatus.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {/* Telegram — sadece durum, test/kaydetme NotificationConfigCard'da (bkz. dosya başı yorumu) */}
        <div className="flex items-center justify-between gap-2 py-1">
          <div className="flex items-center gap-2">
            <StatusDot ok={telegramConfigured} />
            <span className="text-text-t2 font-mono text-xs">Telegram</span>
            <span className="text-text-t4 font-mono text-2xs">
              {telegramConfigured
                ? t("settings.channelStatus.configured")
                : t("settings.channelStatus.notConfigured")}
            </span>
          </div>
        </div>

        {/* Discord */}
        <div className="flex items-center justify-between gap-2 py-1">
          <div className="flex items-center gap-2">
            <StatusDot ok={discordConfigured} />
            <span className="text-text-t2 font-mono text-xs">Discord</span>
            <span className="text-text-t4 font-mono text-2xs">
              {discordConfigured
                ? t("settings.channelStatus.configured")
                : t("settings.channelStatus.notConfigured")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleDiscordTest()}
            disabled={!discordConfigured || discordStatus === "loading"}
            className="border-border hover:bg-bg-page disabled:opacity-50 rounded border px-2 py-1 font-mono text-2xs tracking-widest uppercase transition-colors"
          >
            {discordStatus === "loading"
              ? t("settings.discord.testing")
              : t("settings.discord.testButton")}
          </button>
        </div>
        {discordStatus === "success" && (
          <p className="text-signal-green -mt-1 font-mono text-2xs">✓ {t("settings.discord.success")}</p>
        )}
        {discordStatus === "error" && (
          <p className="text-signal-red -mt-1 font-mono text-2xs">✗ {t("settings.discord.error")}</p>
        )}

        {/* YouTube / TikTok / X — buton yok, sadece durum (bkz. dosya başı yorumu) */}
        {["YouTube", "TikTok", "X (Twitter)"].map((name) => (
          <div key={name} className="flex items-center justify-between gap-2 py-1">
            <div className="flex items-center gap-2">
              <StatusDot ok={false} />
              <span className="text-text-t2 font-mono text-xs">{name}</span>
              <span className="text-text-t4 font-mono text-2xs">
                {t("settings.channelStatus.notIntegrated")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
