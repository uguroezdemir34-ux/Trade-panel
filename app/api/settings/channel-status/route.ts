/**
 * GET /api/settings/channel-status — sadece Telegram için server env
 * durumunu döner: {telegram: boolean}.
 *
 * Discord'u KASITLI OLARAK içermiyor — kullanıcı kararı (bkz.
 * components/ayarlar/ChannelConnectionCard.tsx header yorumu): Discord
 * konfigürasyonu bu kod tabanında server env değil, tamamen client-side
 * (useSettingsStore().discordWebhookUrl, tarayıcı localStorage) — burada
 * kontrol edilecek bir process.env değeri yok, client kendi store'undan
 * biliyor.
 *
 * Auth guard YOK (bilerek) — dönen tek bilgi bir boolean, hiçbir sır/
 * kimlik bilgisi içermiyor, /api/admin/* ile aynı sınıf değil.
 */

import { NextResponse } from "next/server";

export function GET(): NextResponse {
  const telegramConfigured =
    !!process.env.TELEGRAM_BOT_TOKEN?.trim() && !!process.env.TELEGRAM_VIP_CHAT_ID?.trim();

  return NextResponse.json({ telegram: telegramConfigured });
}
