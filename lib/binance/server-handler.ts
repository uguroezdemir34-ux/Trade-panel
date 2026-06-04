/**
 * BINANCE FAPI SERVER-SIDE PROXY HANDLER
 *
 * Browser → /api/binance/fapi/v1/<path>  (JSON body)
 * Server  → fapi.binance.com/fapi/v1/<path>  (URL-encoded + HMAC signed)
 *
 * GÜVENLİK:
 *   - API secret asla browser'a çıkmaz
 *   - Layer 1: BINANCE_API_KEY / BINANCE_API_SECRET (Vercel env)
 *   - Layer 2: client-provided creds (encrypted localStorage fallback)
 *   - Sadece /fapi/ path'lerine izin verilir
 */

import { signParams, type BinanceCreds } from "./auth";

export const BINANCE_BASE_URL = "https://fapi.binance.com";
const REQUEST_TIMEOUT_MS = 8_000;

export interface BinanceServerConfig {
  creds: BinanceCreds | null;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface BinanceProxyRequest {
  method: "GET" | "POST" | "DELETE";
  /** Path: /fapi/v1/... (başında slash ile) */
  path: string;
  /** Body params (POST için) veya query params (GET/DELETE için) */
  params?: Record<string, string | number | boolean>;
  /** Layer 2 fallback credentials */
  clientCreds?: BinanceCreds | null;
}

export interface BinanceProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: number;
  msg?: string;
}

export function loadBinanceConfigFromEnv(
  env: Record<string, string | undefined>,
): BinanceServerConfig {
  const hasKey = !!env.BINANCE_API_KEY && !!env.BINANCE_API_SECRET;
  if (!hasKey && typeof console !== "undefined") {
    // Silent — not configured is expected until user sets up Binance
  }
  return {
    creds: hasKey
      ? { key: env.BINANCE_API_KEY!, secret: env.BINANCE_API_SECRET! }
      : null,
  };
}

export async function handleBinanceProxy(
  req: BinanceProxyRequest,
  config: BinanceServerConfig,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<BinanceProxyResponse> {
  // Path güvenlik kontrolü
  if (!req.path.startsWith("/fapi/")) {
    return { ok: false, code: -1, msg: "INVALID_PATH" };
  }

  // Credential seçimi: Layer 1 → Layer 2 fallback
  let creds: BinanceCreds | null = config.creds;
  if ((!creds?.key || !creds?.secret) && req.clientCreds?.key) {
    creds = req.clientCreds;
  }
  if (!creds?.key || !creds?.secret) {
    return { ok: false, code: -1, msg: "NO_BINANCE_KEYS" };
  }

  const baseUrl = config.baseUrl ?? BINANCE_BASE_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const params = req.params ?? {};

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    let url: string;
    let fetchOpts: RequestInit;

    if (req.method === "GET" || req.method === "DELETE") {
      const signed = await signParams(creds, params, now);
      url = `${baseUrl}${req.path}?${signed}`;
      fetchOpts = {
        method: req.method,
        headers: { "X-MBX-APIKEY": creds.key },
        signal: ctrl.signal,
      };
    } else {
      // POST: URL-encoded body
      const signed = await signParams(creds, params, now);
      url = `${baseUrl}${req.path}`;
      fetchOpts = {
        method: "POST",
        headers: {
          "X-MBX-APIKEY": creds.key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: signed,
        signal: ctrl.signal,
      };
    }

    const res = await fetchImpl(url, fetchOpts);
    const raw = await res.json() as Record<string, unknown>;

    // Binance error response: { code: <negative>, msg: "..." }
    if (typeof raw.code === "number" && raw.code < 0) {
      return { ok: false, code: raw.code as number, msg: String(raw.msg ?? "") };
    }
    return { ok: true, data: raw };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      code: -1,
      msg: err.name === "AbortError" ? "TIMEOUT" : (err.message ?? "NETWORK_ERROR"),
    };
  } finally {
    clearTimeout(tid);
  }
}
