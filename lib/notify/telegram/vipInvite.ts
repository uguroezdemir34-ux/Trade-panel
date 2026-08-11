/**
 * VIP TELEGRAM DAVET LİNKİ — Bot API `createChatInviteLink`.
 *
 * Pro abonelik satın alan kullanıcıya, sendMessage/sendPhoto'nun kullandığı
 * TELEGRAM_VIP_CHAT_ID'den (otomatik sinyal yayın kanalı, bkz.
 * lib/notify/telegram/config.ts) AYRI bir "VIP topluluk" grubuna tek
 * kullanımlık davet linki üretir. Bu ikinci grup TELEGRAM_VIP_COMMUNITY_CHAT_ID
 * ile yapılandırılır (bkz. .env.example) — 2026-08-11'de chat'te netleşti:
 * kullanıcı henüz bu grubu manuel oluşturmadı, TELEGRAM_VIP_CHAT_ID ile
 * KASITLI OLARAK aynı env var kullanılmadı (o zaten otomatik sinyal
 * yayınının hedefi, karıştırılırsa Pro-olmayan/test amaçlı o kanala
 * gerçek müşteri davet edilmiş olur).
 *
 * member_limit: 1 — link tek kullanımlık, paylaşılsa bile ikinci kişi
 * giremez (ödeme yapmayanın davet linkini bir yerden bulup katılması
 * riskine karşı).
 *
 * KAPSAM DIŞI (kullanıcıya açıkça soruldu, "otomasyonu yaz" cevabı SADECE
 * link üretimini kapsıyor): abonelik iptal/downgrade olduğunda kullanıcıyı
 * gruptan çıkarma otomasyonu YOK — bu, Telegram user ID'sini (davet linkini
 * kimin kullandığını) ayrıca izlemeyi gerektirir, burada yapılmadı.
 */

import type { TelegramConfig } from "./config";

export interface VipInviteResult {
  ok: boolean;
  inviteLink?: string;
  errorMessage?: string;
}

interface CreateChatInviteLinkResponse {
  ok: boolean;
  description?: string;
  result?: { invite_link?: string };
}

/**
 * Telegram Bot API'ye tek kullanımlık davet linki isteği atar.
 * Retry YOK (sendTelegramMessage/-Photo'nun aksine) — bu, Stripe webhook'un
 * kritik yolunda değil, best-effort bir yan etki (bkz. çağıran taraftaki
 * "webhook başarısızlığını asla Stripe'a 500 olarak yansıtma" notu).
 * Timeout: 8sn (diğer Telegram çağrılarıyla aynı varsayılan).
 */
export async function createVipInviteLink(
  config: TelegramConfig,
  opts: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<VipInviteResult> {
  const fetchImpl = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? 8000;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetchImpl(
      `https://api.telegram.org/bot${config.botToken}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          member_limit: 1,
          name: "QUANTIX VIP - Pro",
        }),
        signal: ctrl.signal,
      },
    );
    clearTimeout(tid);

    const data = (await res.json().catch(() => null)) as CreateChatInviteLinkResponse | null;
    if (res.ok && data?.ok && data.result?.invite_link) {
      return { ok: true, inviteLink: data.result.invite_link };
    }
    return { ok: false, errorMessage: data?.description ?? `HTTP ${res.status}` };
  } catch (e) {
    clearTimeout(tid);
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      errorMessage: err.name === "AbortError" ? "timeout" : (err.message ?? "network_error"),
    };
  }
}
