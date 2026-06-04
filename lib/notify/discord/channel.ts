/**
 * DISCORD CHANNEL — POSTs messages to a Discord webhook URL.
 *
 * No server-side proxy needed — Discord webhooks support browser CORS.
 * Rate limit: 429 → respects X-RateLimit-Reset-After header.
 */

import { formatDiscordMessage } from "./formatter";
import type { NotifyMessage, NotifyResult } from "@/lib/notify/types";

interface DiscordPayload {
  content: string;
  username: string;
}

/**
 * Send a NotifyMessage to a Discord webhook URL.
 * Retries up to 3× on transient errors; immediate failure on 401/404.
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  msg: NotifyMessage,
  fetchFn: typeof fetch = fetch,
): Promise<NotifyResult> {
  if (!webhookUrl) {
    return { ok: false, channel: "discord", errorMessage: "Discord webhook URL not configured" };
  }

  const payload: DiscordPayload = {
    content: formatDiscordMessage(msg),
    username: "QUANTIX",
  };

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

      // Discord returns 204 No Content on success
      if (res.status === 204 || res.status === 200) {
        return { ok: true, channel: "discord" };
      }

      // Rate limited — wait and retry
      if (res.status === 429) {
        const retryAfter = res.headers.get("X-RateLimit-Reset-After");
        const delay = retryAfter ? Math.min(parseFloat(retryAfter) * 1000, 10_000) : 2_000;
        await sleep(delay);
        continue;
      }

      // Permanent failures — no retry
      if (res.status === 401 || res.status === 404) {
        return { ok: false, channel: "discord", errorMessage: `Webhook error ${res.status} — check URL` };
      }

      // Transient server error — retry with backoff
      if (attempts < maxAttempts) {
        await sleep(500 * attempts);
        continue;
      }

      return { ok: false, channel: "discord", errorMessage: `HTTP ${res.status}` };
    } catch (e) {
      if (attempts < maxAttempts) {
        await sleep(500 * attempts);
        continue;
      }
      return { ok: false, channel: "discord", errorMessage: e instanceof Error ? e.message : "Network error" };
    }
  }

  return { ok: false, channel: "discord", errorMessage: "Max retries exceeded" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
