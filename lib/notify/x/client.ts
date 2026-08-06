/**
 * X (TWITTER) HTTP CLIENT — API v2 POST /2/tweets.
 *
 * Telegram client'ının (lib/notify/telegram/client.ts) aksine BİLEREK
 * retry/rate-limit backoff YOK — task kapsamı "best-effort, Telegram'ı hiç
 * etkilemesin" diyor, cron'un 10sn bütçesini (Vercel Hobby) X'in olası
 * yavaşlığıyla zorlamamak için tek deneme + timeout yeterli. Telegram zaten
 * birincil kanal ve kendi retry mantığına sahip — X ikincil, başarısız
 * olursa bir sonraki sinyalde/outcome'da tekrar denenmiş olur (ayrı bir
 * queue/retry state'i YOK, kasıtlı — Telegram'ın "retry yok, DB satırı
 * zaten captured_at dolu" felsefesiyle aynı basitlik).
 *
 * ⚠️ CANLI DOĞRULANMADI — bkz. oauth1.ts dosya başı uyarısı.
 */

import type { XConfig } from "./config";
import { buildOAuth1Header } from "./oauth1";

const X_API_URL = "https://api.x.com/2/tweets";

export interface PostTweetResult {
  ok: boolean;
  tweetId?: string;
  errorMessage?: string;
}

interface XClientOptions {
  fetchFn?: typeof fetch;
  /** Tek istek timeout ms (default 8000 — Telegram client'ıyla aynı varsayılan). */
  timeoutMs?: number;
}

interface XApiResponse {
  data?: { id?: string; text?: string };
  /** X API v2 hata gövdesi — RFC 7807 problem+json benzeri (title/detail). */
  title?: string;
  detail?: string;
  errors?: Array<{ message?: string }>;
}

export async function postTweet(
  config: XConfig,
  text: string,
  opts: XClientOptions = {},
): Promise<PostTweetResult> {
  const fetchImpl = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? 8000;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const authHeader = buildOAuth1Header("POST", X_API_URL, config);
    const res = await fetchImpl(X_API_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    const data = await safeReadJson(res);
    if (res.ok && data?.data?.id) {
      return { ok: true, tweetId: data.data.id };
    }

    const errorMessage =
      data?.detail ?? data?.errors?.[0]?.message ?? data?.title ?? `HTTP ${res.status}`;
    return { ok: false, errorMessage };
  } catch (e) {
    clearTimeout(tid);
    const err = e as { name?: string; message?: string };
    const isAbort = err.name === "AbortError";
    return { ok: false, errorMessage: isAbort ? "timeout" : (err.message ?? "network_error") };
  }
}

async function safeReadJson(res: Response): Promise<XApiResponse | null> {
  try {
    return (await res.json()) as XApiResponse;
  } catch {
    return null;
  }
}
