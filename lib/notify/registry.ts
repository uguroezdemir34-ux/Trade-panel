/**
 * NOTIFY REGISTRY — Channel factory.
 *
 * Telegram: ✓ DOLU (paket #9)
 * Discord: ✓ DOLU (Adım 3.2 — önceden sendDiscordMessage() vardı ama buraya
 *   hiç bağlanmamıştı, "discord" isteği hep StubChannel'a düşüyordu)
 * Webhook: ✓ DOLU (Adım 3.2 — yeni, genel outbound webhook kanalı)
 * Email: iskelet (gelecek)
 */

import type {
  NotifyChannel,
  ChannelName,
  BaseChannelConfig,
  NotifyMessage,
  NotifyResult,
} from "./types";
import { notImplementedResult } from "./types";
import { TelegramChannel } from "./telegram/channel";
import { DiscordChannel } from "./discord/channel";
import { WebhookChannel } from "./webhook/channel";

/**
 * Boş iskelet channel — sadece Email için (henüz implement edilmedi).
 */
class StubChannel implements NotifyChannel {
  readonly name: ChannelName;
  readonly isImplemented = false;

  constructor(name: ChannelName) {
    this.name = name;
  }

  isConfigured(): boolean {
    return false;
  }

  async send(_msg: NotifyMessage): Promise<NotifyResult> {
    return notImplementedResult(this.name);
  }
}

export function createChannel(
  name: ChannelName,
  config: BaseChannelConfig = {},
): NotifyChannel {
  switch (name) {
    case "telegram":
      return new TelegramChannel({
        fetchFn: config.fetchFn,
        configOverride: config.telegramConfigOverride,
      });
    case "discord":
      return new DiscordChannel({ fetchFn: config.fetchFn, webhookUrl: config.webhookUrl });
    case "webhook":
      return new WebhookChannel({ fetchFn: config.fetchFn, webhookUrl: config.webhookUrl });
    case "email":
      return new StubChannel(name);
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown channel: ${_exhaustive}`);
    }
  }
}

/**
 * "production-ready + configured" channel'lar.
 *
 * `configs` — kanal başına per-request config (Layer 2 Telegram creds,
 * Discord/webhook URL'leri). Bunlar olmadan (örn. server-side, env-only
 * bağlamda) çağrılırsa sadece env-tabanlı Telegram konfigürasyonu görülür.
 */
export function getActiveChannels(
  configs: Partial<Record<ChannelName, BaseChannelConfig>> = {},
): ChannelName[] {
  return SUPPORTED_CHANNELS_ORDER.filter((name) => {
    const c = createChannel(name, configs[name] ?? {});
    return c.isImplemented && c.isConfigured();
  });
}

const SUPPORTED_CHANNELS_ORDER: readonly ChannelName[] = ["telegram", "discord", "webhook", "email"];

export function isValidChannel(name: string): name is ChannelName {
  return name === "telegram" || name === "discord" || name === "webhook" || name === "email";
}
