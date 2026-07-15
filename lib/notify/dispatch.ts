/**
 * NOTIFY DISPATCH — tüm bildirim-gönderen hook'ların kullandığı TEK merkezi
 * orkestratör (Adım 3.2 — SaaS/Sinyal Dönüşüm ve Bildirim Konsolidasyonu).
 *
 * ÖNCEDEN: 3 farklı, birbirinden bağımsız kod yolu vardı:
 *   1. useGoAlerts.ts / useSignalFirehose.ts — fetch("/api/telegram/signal")
 *      + doğrudan sendDiscordMessage() çağrısı, HER İKİ dosyada neredeyse
 *      birebir kopyalanmış olarak.
 *   2. usePositionPoller.ts / useEmergencyStopGuard.ts / useSlProximityAlert.ts
 *      — createChannel("telegram") DOĞRUDAN client-side çağrılıyordu. Bu,
 *      SESSİZCE HİÇBİR ZAMAN ÇALIŞMIYORDU: TelegramChannel env'den okuyor
 *      (process.env.TELEGRAM_BOT_TOKEN), ama Next.js client bundle'ında
 *      NEXT_PUBLIC_ olmayan env değişkenleri hiç resolve olmaz — yani bu 3
 *      hook'ta isConfigured() hep false dönüyordu (Adım 3.2 araştırmasında
 *      bulundu, önceden hiç fark edilmemiş bir bug).
 *
 * ŞİMDİ: Tüm 5 hook TEK `dispatchNotification(msg)` çağırıyor:
 *   - Telegram → /api/telegram/signal route'una fetch (DEĞİŞMEDİ, zaten
 *     çalışıyordu — server-side olduğu için Layer 1 env + Layer 2 client
 *     creds'i doğru resolve ediyor). Bilerek registry.ts/NotifyChannel
 *     ÜZERİNDEN DEĞİL — Telegram'ın Layer 1 sırrı client bundle'ına asla
 *     giremeyeceği için bu mimari olarak mümkün değil (bkz. types.ts
 *     BaseChannelConfig.telegramConfigOverride yorumu).
 *   - Discord + Webhook → registry.ts'in createChannel()/NotifyChannel
 *     soyutlaması üzerinden, DOĞRUDAN client-side (ikisi de CORS-dostu,
 *     server round-trip gerektirmiyor — Discord'un halihazırda kanıtlanmış
 *     deseni).
 *
 * lib/score/'a hiç dokunmuyor — sadece bildirim gönderme orkestrasyonu.
 */

import { useCredentialStore, type TelegramCreds } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { createChannel } from "./registry";
import type { NotifyMessage, NotifyResult } from "./types";

export interface DispatchResult {
  telegram?: NotifyResult;
  discord?: NotifyResult;
  webhook?: NotifyResult;
}

/**
 * Bir NotifyMessage'ı yapılandırılmış TÜM kanallara (Telegram + varsa
 * Discord + varsa genel Webhook) paralel gönderir. Yapılandırılmamış
 * kanallar (URL yok) sessizce atlanır — hata sayılmaz.
 *
 * Caller'lar fire-and-forget kullanabilir (`void dispatchNotification(msg)`)
 * veya sonucu inceleyebilir — hiçbir kanal hatası throw etmez, hepsi
 * DispatchResult içinde `{ ok: false, errorMessage }` olarak döner.
 */
export async function dispatchNotification(msg: NotifyMessage): Promise<DispatchResult> {
  const tgCreds = useCredentialStore.getState().telegram;
  const discordUrl = useSettingsStore.getState().discordWebhookUrl;
  const webhookUrl = useSettingsStore.getState().genericWebhookUrl;

  const [telegram, discord, webhook] = await Promise.all([
    sendViaTelegramRoute(msg, tgCreds),
    discordUrl
      ? createChannel("discord", { webhookUrl: discordUrl }).send(msg)
      : Promise.resolve(undefined),
    webhookUrl
      ? createChannel("webhook", { webhookUrl }).send(msg)
      : Promise.resolve(undefined),
  ]);

  return {
    telegram,
    ...(discord ? { discord } : {}),
    ...(webhook ? { webhook } : {}),
  };
}

/**
 * Telegram — server-side /api/telegram/signal route'u üzerinden gönderir.
 * Layer 1 (env, route içinde resolve edilir) > Layer 2 (buradan geçilen
 * client creds) — route'un kendi önceliklendirmesi (bkz. route.ts).
 */
async function sendViaTelegramRoute(
  msg: NotifyMessage,
  tgCreds: TelegramCreds | null,
): Promise<NotifyResult> {
  try {
    const body: Record<string, unknown> = { msg };
    if (tgCreds?.botToken) body.botToken = tgCreds.botToken;
    if (tgCreds?.chatId) body.chatId = tgCreds.chatId;

    const res = await fetch("/api/telegram/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return { ok: true, channel: "telegram" };
    }

    let errorMessage = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) errorMessage = data.error;
    } catch {
      // JSON parse edilemedi — HTTP status yeterli
    }
    return { ok: false, channel: "telegram", errorMessage };
  } catch (e) {
    return {
      ok: false,
      channel: "telegram",
      errorMessage: e instanceof Error ? e.message : "Network error",
    };
  }
}
