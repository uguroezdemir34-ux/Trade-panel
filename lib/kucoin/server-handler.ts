/**
 * KUCOIN FUTURES SERVER-SIDE PROXY HANDLER
 *
 * Browser → /api/kucoin  (JSON body)
 * Server  → api-futures.kucoin.com/api/v1/<path>  (KC-API-* imzalı header'lar)
 *
 * GÜVENLİK:
 *   - API secret asla browser'a çıkmaz
 *   - Layer 1: KUCOIN_API_KEY / KUCOIN_API_SECRET / KUCOIN_API_PASSPHRASE (Vercel env)
 *   - Layer 2: client-provided creds (encrypted localStorage fallback)
 *   - Sadece 2 spesifik görüntüleme path'ine izin verilir — KuCoin'in
 *     /api/v1/ ad alanı emir verme/iptal uçlarını da içerdiği için (Bybit'in
 *     /v5/ veya Gate.io'nun /futures/usdt/ öneki gibi geniş bir prefix
 *     yeterince güvenli olmazdı), bilerek TAM EŞLEŞME (exact allow-list)
 *     kullanıldı.
 *
 * Kapsam: SADECE görüntüleme (pozisyon/bakiye) — emir açma/kapatma bu
 * proxy'den YAPILMIYOR, bilerek eklenmedi (bkz. lib/exchange/index.ts).
 */

import { kucoinAuthHeaders, type KucoinCreds } from "./auth";

export const KUCOIN_BASE_URL = "https://api-futures.kucoin.com";
const REQUEST_TIMEOUT_MS = 8_000;

const ALLOWED_PATHS = ["/api/v1/positions", "/api/v1/account-overview"] as const;
type AllowedPath = (typeof ALLOWED_PATHS)[number];

export interface KucoinServerConfig {
  creds: KucoinCreds | null;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface KucoinProxyRequest {
  method: "GET";
  path: string;
  /** Query params (GET için) */
  params?: Record<string, unknown>;
  /** Layer 2 fallback credentials */
  clientCreds?: KucoinCreds | null;
}

export interface KucoinProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: string;
  msg?: string;
}

export function loadKucoinConfigFromEnv(
  env: Record<string, string | undefined>,
): KucoinServerConfig {
  const hasKey =
    !!env.KUCOIN_API_KEY && !!env.KUCOIN_API_SECRET && !!env.KUCOIN_API_PASSPHRASE;
  return {
    creds: hasKey
      ? {
          key: env.KUCOIN_API_KEY!,
          secret: env.KUCOIN_API_SECRET!,
          passphrase: env.KUCOIN_API_PASSPHRASE!,
        }
      : null,
  };
}

export async function handleKucoinProxy(
  req: KucoinProxyRequest,
  config: KucoinServerConfig,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<KucoinProxyResponse> {
  if (!ALLOWED_PATHS.includes(req.path as AllowedPath)) {
    return { ok: false, code: "INVALID_PATH" };
  }

  // Credential seçimi: Layer 1 → Layer 2 fallback
  let creds: KucoinCreds | null = config.creds;
  if ((!creds?.key || !creds?.secret || !creds?.passphrase) && req.clientCreds?.key) {
    creds = req.clientCreds;
  }
  if (!creds?.key || !creds?.secret || !creds?.passphrase) {
    return { ok: false, code: "NO_KUCOIN_KEYS" };
  }

  const baseUrl = config.baseUrl ?? KUCOIN_BASE_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const params = req.params ?? {};

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // GET: params → query string, imza tam path+query üzerinden hesaplanır
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    const endpoint = qs ? `${req.path}?${qs}` : req.path;
    const authHeaders = await kucoinAuthHeaders(creds, "GET", endpoint, "", now);
    const url = `${baseUrl}${endpoint}`;

    const res = await fetchImpl(url, {
      method: "GET",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      signal: ctrl.signal,
    });

    const raw = (await res.json()) as { code?: string; msg?: string; data?: unknown };

    // KuCoin başarı kodu "200000" — her şey buna eşit olmalı.
    if (raw.code !== "200000") {
      return { ok: false, code: raw.code, msg: raw.msg };
    }
    return { ok: true, data: raw.data };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      code: err.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      msg: err.message,
    };
  } finally {
    clearTimeout(tid);
  }
}
