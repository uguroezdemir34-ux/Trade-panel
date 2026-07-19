/**
 * KRAKEN FUTURES SERVER-SIDE PROXY HANDLER
 *
 * Browser → /api/kraken  (JSON body)
 * Server  → futures.kraken.com/derivatives/api/v3/<path>  (private uçlar
 *           APIKey/Authent/Nonce imzalı)
 *
 * GÜVENLİK:
 *   - API secret asla browser'a çıkmaz
 *   - Layer 1: KRAKEN_API_KEY / KRAKEN_API_SECRET (Vercel env)
 *   - Layer 2: client-provided creds (encrypted localStorage fallback)
 *   - Sadece 3 spesifik endpoint'e izin verilir (exact allow-list,
 *     KuCoin/MEXC'teki aynı gerekçeyle — Kraken'in /derivatives/api/v3/
 *     ad alanı emir/iptal uçlarını da içeriyor)
 *
 * Kapsam: SADECE görüntüleme (pozisyon/bakiye/tickers) — emir açma/kapatma
 * bu proxy'den YAPILMIYOR, bilerek eklenmedi (bkz. lib/exchange/index.ts).
 *
 * Yanıt zarfı: Kraken'in {result:"success"|"error", <kaynak-anahtarı>: ...}
 * şekli resmi dokümantasyondan doğrulandı (openpositions/tickers
 * örnekleriyle), ama kaynak anahtarı (openPositions/tickers/accounts)
 * endpoint'e göre değişiyor — bu proxy normalize ETMİYOR, tüm gövdeyi
 * `data` olarak geçiriyor, her caller (positions.ts/balance.ts) kendi
 * beklediği anahtarı okuyor.
 */

import { krakenAuthHeaders, type KrakenCreds } from "./auth";

export const KRAKEN_BASE_URL = "https://futures.kraken.com";
const REQUEST_TIMEOUT_MS = 8_000;

const PRIVATE_PATHS = [
  "/derivatives/api/v3/openpositions",
  "/derivatives/api/v3/accounts",
] as const;
/** Public — kimlik doğrulama gerektirmez (markPrice için). */
const PUBLIC_PATHS = ["/derivatives/api/v3/tickers"] as const;

type PrivatePath = (typeof PRIVATE_PATHS)[number];
type PublicPath = (typeof PUBLIC_PATHS)[number];

export interface KrakenServerConfig {
  creds: KrakenCreds | null;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface KrakenProxyRequest {
  method: "GET";
  path: string;
  /** Query params (GET için) */
  params?: Record<string, unknown>;
  /** Layer 2 fallback credentials — public path'ler için gerekmez */
  clientCreds?: KrakenCreds | null;
}

export interface KrakenProxyResponse {
  ok: boolean;
  /** Tüm parse edilmiş yanıt gövdesi (result hariç tüm alanlar) */
  data?: unknown;
  error?: string;
}

export function loadKrakenConfigFromEnv(
  env: Record<string, string | undefined>,
): KrakenServerConfig {
  const hasKey = !!env.KRAKEN_API_KEY && !!env.KRAKEN_API_SECRET;
  return {
    creds: hasKey ? { key: env.KRAKEN_API_KEY!, secret: env.KRAKEN_API_SECRET! } : null,
  };
}

export async function handleKrakenProxy(
  req: KrakenProxyRequest,
  config: KrakenServerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<KrakenProxyResponse> {
  const isPublic = PUBLIC_PATHS.includes(req.path as PublicPath);
  const isPrivate = PRIVATE_PATHS.includes(req.path as PrivatePath);
  if (!isPublic && !isPrivate) {
    return { ok: false, error: "INVALID_PATH" };
  }

  const baseUrl = config.baseUrl ?? KRAKEN_BASE_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const params = req.params ?? {};

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // postData — GET için query string (& ile birleştirilmiş, ? olmadan)
    const postData = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");
    const url = postData ? `${baseUrl}${req.path}?${postData}` : `${baseUrl}${req.path}`;

    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (isPrivate) {
      let creds: KrakenCreds | null = config.creds;
      if ((!creds?.key || !creds?.secret) && req.clientCreds?.key) {
        creds = req.clientCreds;
      }
      if (!creds?.key || !creds?.secret) {
        return { ok: false, error: "NO_KRAKEN_KEYS" };
      }
      const authHeaders = await krakenAuthHeaders(creds, postData, req.path);
      headers = { ...headers, ...authHeaders };
    }
    // Public path (tickers) — imza gerekmez.

    const res = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: ctrl.signal,
    });

    const raw = (await res.json()) as { result?: string; error?: string; [key: string]: unknown };

    if (raw.result !== "success") {
      return { ok: false, error: raw.error ?? `HTTP_${res.status}` };
    }
    return { ok: true, data: raw };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      error: err.name === "AbortError" ? "TIMEOUT" : (err.message ?? "NETWORK_ERROR"),
    };
  } finally {
    clearTimeout(tid);
  }
}
