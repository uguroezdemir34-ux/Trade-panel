/**
 * GATE.IO FUTURES SERVER-SIDE PROXY HANDLER
 *
 * Browser → /api/gateio  (JSON body)
 * Server  → api.gateio.ws/api/v4/futures/usdt/<path>  (HMAC-SHA512 imzalı)
 *
 * GÜVENLİK:
 *   - API secret asla browser'a çıkmaz
 *   - Layer 1: GATEIO_API_KEY / GATEIO_API_SECRET (Vercel env)
 *   - Layer 2: client-provided creds (encrypted localStorage fallback)
 *   - Sadece /api/v4/futures/usdt/ path'lerine izin verilir
 *
 * Kapsam: SADECE görüntüleme (pozisyon/bakiye) — emir açma/kapatma bu
 * proxy'den YAPILMIYOR, bilerek eklenmedi (bkz. lib/exchange/index.ts).
 */

import { gateioAuthHeaders, type GateioCreds } from "./auth";

export const GATEIO_BASE_URL = "https://api.gateio.ws";
const REQUEST_TIMEOUT_MS = 8_000;

export interface GateioServerConfig {
  creds: GateioCreds | null;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface GateioProxyRequest {
  method: "GET";
  /** Path: /api/v4/futures/usdt/... (başında slash ile) */
  path: string;
  /** Query params (GET için) */
  params?: Record<string, unknown>;
  /** Layer 2 fallback credentials */
  clientCreds?: GateioCreds | null;
}

export interface GateioProxyResponse {
  ok: boolean;
  data?: unknown;
  label?: string;
  message?: string;
}

export function loadGateioConfigFromEnv(
  env: Record<string, string | undefined>,
): GateioServerConfig {
  const hasKey = !!env.GATEIO_API_KEY && !!env.GATEIO_API_SECRET;
  return {
    creds: hasKey
      ? { key: env.GATEIO_API_KEY!, secret: env.GATEIO_API_SECRET! }
      : null,
  };
}

export async function handleGateioProxy(
  req: GateioProxyRequest,
  config: GateioServerConfig,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<GateioProxyResponse> {
  // Path güvenlik kontrolü — sadece futures/usdt görüntüleme uçları
  if (!req.path.startsWith("/api/v4/futures/usdt/")) {
    return { ok: false, label: "INVALID_PATH" };
  }

  // Credential seçimi: Layer 1 → Layer 2 fallback
  let creds: GateioCreds | null = config.creds;
  if ((!creds?.key || !creds?.secret) && req.clientCreds?.key) {
    creds = req.clientCreds;
  }
  if (!creds?.key || !creds?.secret) {
    return { ok: false, label: "NO_GATEIO_KEYS" };
  }

  const baseUrl = config.baseUrl ?? GATEIO_BASE_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const params = req.params ?? {};

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // GET: params → query string, body her zaman boş (bu tur sadece görüntüleme)
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    const authHeaders = await gateioAuthHeaders(creds, "GET", req.path, qs, "", now);
    const url = qs ? `${baseUrl}${req.path}?${qs}` : `${baseUrl}${req.path}`;

    const res = await fetchImpl(url, {
      method: "GET",
      headers: { ...authHeaders, Accept: "application/json" },
      signal: ctrl.signal,
    });

    const raw = (await res.json()) as unknown;

    // Gate.io hata yanıtı: HTTP non-2xx + { label, message }
    if (!res.ok) {
      const err = raw as { label?: string; message?: string };
      return { ok: false, label: err.label ?? String(res.status), message: err.message };
    }
    return { ok: true, data: raw };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      label: err.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      message: err.message,
    };
  } finally {
    clearTimeout(tid);
  }
}
