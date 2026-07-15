/**
 * WEBHOOK CHANNEL — kullanıcının kendi dış platformuna (TradingView'a benzer
 * bir "alert webhook" hedefi — Zapier, n8n, kendi sunucusu) düz JSON POST'u.
 *
 * lib/notify/discord/channel.ts'teki sendDiscordMessage()'ın retry/rate-limit
 * deseninden BİREBİR uyarlandı — tek fark payload formatı: Discord'un
 * `{content, username}` metin sarmalayıcısı yerine, NotifyMessage'ın
 * alanlarını olduğu gibi taşıyan düz bir JSON nesnesi (üçüncü parti
 * sistemlerin ayrıştırması/eşlemesi kolay olsun diye).
 */

import type {
  NotifyMessage,
  NotifyResult,
  NotifyChannel,
  ChannelName,
  BaseChannelConfig,
} from "@/lib/notify/types";

export interface WebhookPayload {
  /** "QUANTIX_OS" — kaynağı tanımlamak için sabit işaretçi. */
  source: "QUANTIX_OS";
  event: NotifyMessage["kind"];
  pair?: string;
  direction?: "LONG" | "SHORT";
  entry?: number;
  stopPrice?: number;
  tp1?: number;
  tp2?: number;
  score?: number;
  reason?: string;
  pnl?: number;
  pnlPct?: number;
  timestamp: number;
}

/** NotifyMessage → düz JSON webhook payload'ı. */
export function buildWebhookPayload(msg: NotifyMessage): WebhookPayload {
  return {
    source: "QUANTIX_OS",
    event: msg.kind,
    pair: msg.pair,
    direction: msg.direction,
    entry: msg.entry,
    stopPrice: msg.stopPrice,
    tp1: msg.tp1,
    tp2: msg.tp2,
    score: msg.score,
    reason: msg.reasonText,
    pnl: msg.pnl,
    pnlPct: msg.pnlPct,
    timestamp: msg.timestamp ?? Date.now(),
  };
}

/**
 * Bir NotifyMessage'ı verilen genel webhook URL'ine JSON POST eder.
 * Retry/rate-limit stratejisi sendDiscordMessage() ile aynı — tek fark,
 * genel webhook alıcılarının Discord'un 429/X-RateLimit-Reset-After
 * header'ına sahip olacağı garanti değil, bu yüzden rate-limit için
 * sabit bir backoff kullanılıyor (header varsa yine de saygı gösterilir).
 */
export async function sendWebhookMessage(
  webhookUrl: string,
  msg: NotifyMessage,
  fetchFn: typeof fetch = fetch,
): Promise<NotifyResult> {
  if (!webhookUrl) {
    return { ok: false, channel: "webhook", errorMessage: "Webhook URL not configured" };
  }

  const payload = buildWebhookPayload(msg);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetchFn(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return { ok: true, channel: "webhook" };
      }

      // Rate limited — sabit backoff (header varsa ona öncelik ver)
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") ?? res.headers.get("X-RateLimit-Reset-After");
        const delay = retryAfter ? Math.min(parseFloat(retryAfter) * 1000, 10_000) : 2_000;
        await sleep(delay);
        continue;
      }

      // Kalıcı hatalar — retry yok
      if (res.status === 401 || res.status === 404) {
        return { ok: false, channel: "webhook", errorMessage: `Webhook error ${res.status} — check URL` };
      }

      // Geçici sunucu hatası — backoff ile retry
      if (attempts < maxAttempts) {
        await sleep(500 * attempts);
        continue;
      }

      return { ok: false, channel: "webhook", errorMessage: `HTTP ${res.status}` };
    } catch (e) {
      if (attempts < maxAttempts) {
        await sleep(500 * attempts);
        continue;
      }
      return { ok: false, channel: "webhook", errorMessage: e instanceof Error ? e.message : "Network error" };
    }
  }

  return { ok: false, channel: "webhook", errorMessage: "Max retries exceeded" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * WEBHOOK CHANNEL — NotifyChannel impl, sendWebhookMessage()'ı sarar.
 * DiscordChannel ile birebir aynı yapı.
 */
export class WebhookChannel implements NotifyChannel {
  readonly name: ChannelName = "webhook";
  readonly isImplemented = true;
  private readonly webhookUrl: string | null;
  private readonly fetchFn: typeof fetch;

  constructor(opts: BaseChannelConfig = {}) {
    this.webhookUrl = opts.webhookUrl ?? null;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async send(msg: NotifyMessage): Promise<NotifyResult> {
    if (!this.webhookUrl) {
      return { ok: false, channel: this.name, errorMessage: "Webhook URL not configured" };
    }
    return sendWebhookMessage(this.webhookUrl, msg, this.fetchFn);
  }
}
