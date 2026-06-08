/**
 * BYBIT V5 SERVER-SIDE PROXY HANDLER
 *
 * Browser → /api/bybit  (JSON body)
 * Server  → api.bybit.com/v5/<path>  (JSON + HMAC signed headers)
 *
 * GÜVENLİK:
 *   - API secret asla browser'a çıkmaz
 *   - Layer 1: BYBIT_API_KEY / BYBIT_API_SECRET (Vercel env)
 *   - Layer 2: client-provided creds (encrypted localStorage fallback)
 *   - Sadece /v5/ path'lerine izin verilir
 */

import { bybitAuthHeaders, type BybitCreds } from "./auth";

export const BYBIT_BASE_URL = "https://api.bybit.com";
const REQUEST_TIMEOUT_MS = 8_000;

export interface BybitServerConfig {
  creds: BybitCreds | null;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface BybitProxyRequest {
  method: "GET" | "POST";
  /** Path: /v5/... (başında slash ile) */
  path: string;
  /** Body params (POST için) veya query params (GET için) */
  params?: Record<string, unknown>;
  /** Layer 2 fallback credentials */
  clientCreds?: BybitCreds | null;
}

export interface BybitProxyResponse {
  ok: boolean;
  data?: unknown;
  retCode?: number;
  retMsg?: string;
}

export function loadBybitConfigFromEnv(
  env: Record<string, string | undefined>,
): BybitServerConfig {
  const hasKey = !!env.BYBIT_API_KEY && !!env.BYBIT_API_SECRET;
  return {
    creds: hasKey
      ? { key: env.BYBIT_API_KEY!, secret: env.BYBIT_API_SECRET! }
      : null,
  };
}

export async function handleBybitProxy(
  req: BybitProxyRequest,
  config: BybitServerConfig,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<BybitProxyResponse> {
  // Path güvenlik kontrolü
  if (!req.path.startsWith("/v5/")) {
    return { ok: false, retCode: -1, retMsg: "INVALID_PATH" };
  }

  // Credential seçimi: Layer 1 → Layer 2 fallback
  let creds: BybitCreds | null = config.creds;
  if ((!creds?.key || !creds?.secret) && req.clientCreds?.key) {
    creds = req.clientCreds;
  }
  if (!creds?.key || !creds?.secret) {
    return { ok: false, retCode: -1, retMsg: "NO_BYBIT_KEYS" };
  }

  const baseUrl = config.baseUrl ?? BYBIT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const params = req.params ?? {};

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    let url: string;
    let fetchOpts: RequestInit;

    if (req.method === "GET") {
      // GET: params → query string, rawBody = query string (without leading ?)
      const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      const authHeaders = await bybitAuthHeaders(creds, now, qs);
      url = qs ? `${baseUrl}${req.path}?${qs}` : `${baseUrl}${req.path}`;
      fetchOpts = {
        method: "GET",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        signal: ctrl.signal,
      };
    } else {
      // POST: params → JSON body, rawBody = JSON string
      const rawBody = JSON.stringify(params);
      const authHeaders = await bybitAuthHeaders(creds, now, rawBody);
      url = `${baseUrl}${req.path}`;
      fetchOpts = {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: rawBody,
        signal: ctrl.signal,
      };
    }

    const res = await fetchImpl(url, fetchOpts);
    const raw = await res.json() as Record<string, unknown>;

    // Bybit V5 error response: { retCode: <non-zero>, retMsg: "..." }
    if (typeof raw.retCode === "number" && raw.retCode !== 0) {
      return {
        ok: false,
        retCode: raw.retCode,
        retMsg: String(raw.retMsg ?? ""),
      };
    }
    return { ok: true, data: raw.result ?? raw };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      retCode: -1,
      retMsg: err.name === "AbortError" ? "TIMEOUT" : (err.message ?? "NETWORK_ERROR"),
    };
  } finally {
    clearTimeout(tid);
  }
}
