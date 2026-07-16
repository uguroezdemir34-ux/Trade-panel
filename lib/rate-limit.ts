/**
 * RATE LIMITING — Upstash Redis sliding-window, server-only.
 *
 * UPSTASH_REDIS_REST_URL/TOKEN Vercel'de tanımlı değilse limiter `null`
 * kalır ve check fonksiyonu her zaman `{ success: true }` döner — yerel
 * geliştirmeyi veya Upstash henüz kurulmamış bir deploy'u kilitlememesi
 * için bilinçli fallback (codebase'deki FINNHUB_API_KEY/Stripe/vb. "eksikse
 * sessizce atla" deseniyle tutarlı).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/** OKX proxy — kullanıcı (veya IP, anonim istekler için) başına 10sn'de 30 istek. */
const okxProxyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "10 s"),
      prefix: "ratelimit:okx-proxy",
      analytics: true,
    })
  : null;

export interface RateLimitResult {
  success: boolean;
  limit?: number;
  remaining?: number;
}

/**
 * @param identifier Tercihen Clerk userId; yoksa (public/anonim endpoint)
 *   çağıran taraf IP adresini geçirmeli.
 */
export async function checkOkxRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!okxProxyLimiter) return { success: true };

  try {
    const { success, limit, remaining } = await okxProxyLimiter.limit(identifier);
    return { success, limit, remaining };
  } catch (err) {
    // Upstash geçici olarak erişilemezse trafiği KESME — sessizce izin ver,
    // logla. Rate limiter'ın kendisi tek arıza noktası olmamalı.
    console.error("[rate-limit] Upstash isteği başarısız, limit uygulanmadan devam:", err);
    return { success: true };
  }
}
