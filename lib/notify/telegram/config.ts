/**
 * TELEGRAM CONFIG — Bot token + chat ID okuma.
 *
 * Tüm bilgi server-side environment'tan gelir (`.env.local`).
 * Asla client bundle'ına girmez.
 */

export interface TelegramConfig {
  /** Bot token — BotFather'dan alınır, format: "<digits>:<base64ish>" */
  botToken: string;
  /** VIP grup veya kanal ID — sayı (grup için "-100..." formatlı) */
  chatId: string;
}

/**
 * Env'den config oku — eksikse null döner (channel "not configured").
 *
 * Test'te `env` parametresi inject edilir (process.env mock).
 */
export function loadTelegramConfigFromEnv(
  env: Record<string, string | undefined> = (typeof process !== "undefined" ? process.env : {}),
): TelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_VIP_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    if (typeof console !== "undefined") {
      console.warn("[QUANTIX ENV] ⚠️  TELEGRAM_BOT_TOKEN veya TELEGRAM_VIP_CHAT_ID eksik — bildirimler devre dışı.");
    }
    return null;
  }
  if (!botToken.includes(":")) {
    if (typeof console !== "undefined") {
      console.warn("[QUANTIX ENV] ⚠️  TELEGRAM_BOT_TOKEN formatı geçersiz (beklenen: '<id>:<token>').");
    }
    return null;
  }

  return { botToken, chatId };
}

/**
 * Config tam doğruluk kontrolü.
 * Network'e bağlanmaz, sadece syntax kontrolü.
 */
export function isValidTelegramConfig(config: TelegramConfig | null): boolean {
  if (!config) return false;
  if (!config.botToken || !config.chatId) return false;
  if (!config.botToken.includes(":")) return false;
  return true;
}

/**
 * DB-ÖNCELİKLİ ÇÖZÜMLEME — resolveTelegramConfig() / resolvePublicChatId()
 *
 * loadTelegramConfigFromEnv()'e (yukarıda) KASITLI OLARAK dokunulmadı —
 * senkron kalıyor, mevcut çağıranlar (özellikle lib/notify/telegram/
 * channel.ts'teki TelegramChannel'ın constructor'ı — constructor'lar asla
 * async olamaz) hiç etkilenmiyor. DB sorgusu doğası gereği asenkron olduğu
 * için "aynı fonksiyon imzasıyla DB'yi de dene" mümkün değildi — bunun
 * yerine bu İKİ YENİ fonksiyon eklendi, sadece bunları açıkça `await` eden
 * çağıranlar (şu an: iki cron route'u) DB-farkında oluyor.
 *
 * Önce Supabase'deki notification_config satırını dener (şifreli kolonlar,
 * lib/crypto/serverSecrets.ts ile decrypt edilir) — orada değer yoksa, DB
 * yapılandırılmamışsa veya herhangi bir hata olursa (network, decrypt
 * başarısızlığı vb.) SESSİZCE process.env'e düşer — env hâlâ set edilmiş
 * durumdaysa hiçbir şey kırılmaz, sadece console.error ile loglanır.
 */
import * as Sentry from "@sentry/nextjs";
import { getNotificationConfigRow } from "@/lib/db/notificationConfig";
import { decryptSecret } from "@/lib/crypto/serverSecrets";

export async function resolveTelegramConfig(): Promise<TelegramConfig | null> {
  try {
    const row = await getNotificationConfigRow();
    const botToken = row?.telegram_bot_token_enc ? decryptSecret(row.telegram_bot_token_enc) : null;
    const chatId = row?.telegram_vip_chat_id_enc ? decryptSecret(row.telegram_vip_chat_id_enc) : null;
    if (botToken && chatId && botToken.includes(":")) {
      return { botToken, chatId };
    }
  } catch (err) {
    // "Yapılandırma eksik" durumu burada HİÇ throw etmez (yukarıdaki
    // botToken/chatId kontrolü sessizce env'e düşer) — bu catch sadece
    // gerçek DB/decrypt arızalarını yakalıyor, her zaman gerçek bir hata.
    console.error("[resolveTelegramConfig] DB okuma/decrypt başarısız, env'e düşülüyor:", err);
    Sentry.captureMessage("Telegram config DB okuma/decrypt başarısız", {
      level: "warning",
      extra: { err: err instanceof Error ? err.message : String(err) },
    });
  }
  return loadTelegramConfigFromEnv();
}

export async function resolvePublicChatId(): Promise<string | null> {
  try {
    const row = await getNotificationConfigRow();
    const id = row?.telegram_public_chat_id_enc ? decryptSecret(row.telegram_public_chat_id_enc) : null;
    if (id) return id;
  } catch (err) {
    // resolveTelegramConfig() ile aynı gerekçe — her zaman gerçek hata.
    console.error("[resolvePublicChatId] DB okuma/decrypt başarısız, env'e düşülüyor:", err);
    Sentry.captureMessage("Telegram public chat ID DB okuma/decrypt başarısız", {
      level: "warning",
      extra: { err: err instanceof Error ? err.message : String(err) },
    });
  }
  const envId = process.env.TELEGRAM_PUBLIC_CHAT_ID?.trim();
  return envId || null;
}
