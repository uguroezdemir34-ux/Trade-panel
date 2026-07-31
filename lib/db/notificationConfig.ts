/**
 * NOTIFICATION CONFIG — Supabase'deki tek-satırlık `notification_config`
 * tablosu (bkz. supabase/migrations/011_notification_config.sql) için tipli
 * erişim. Değerler ŞİFRELİ saklanır — bu dosya ham okuma/yazmayı yapar,
 * encrypt/decrypt çağıranın sorumluluğunda (bkz. lib/crypto/serverSecrets.ts,
 * lib/notify/telegram/config.ts'teki resolveTelegramConfig()/
 * resolvePublicChatId(), ve app/api/admin/notification-config/route.ts).
 */

import { dbSelect, dbUpsert, isDbConfigured } from "@/lib/db/server";

export interface NotificationConfigRow {
  id: number;
  telegram_bot_token_enc: string | null;
  telegram_vip_chat_id_enc: string | null;
  telegram_public_chat_id_enc: string | null;
  updated_at: string;
}

/** Supabase yapılandırılmamışsa veya satır hiç yoksa null döner — throw etmez. */
export async function getNotificationConfigRow(): Promise<NotificationConfigRow | null> {
  if (!isDbConfigured()) return null;
  const rows = await dbSelect<NotificationConfigRow>("notification_config", "id=eq.1&select=*");
  return rows[0] ?? null;
}

export interface NotificationConfigPatch {
  telegram_bot_token_enc?: string;
  telegram_vip_chat_id_enc?: string;
  telegram_public_chat_id_enc?: string;
}

/** Kısmi güncelleme — sadece patch'te verilen kolonlar değişir (upsert, id=1 sabit). */
export async function saveNotificationConfigRow(patch: NotificationConfigPatch): Promise<void> {
  await dbUpsert("notification_config", { id: 1, ...patch, updated_at: new Date().toISOString() }, "id");
}
