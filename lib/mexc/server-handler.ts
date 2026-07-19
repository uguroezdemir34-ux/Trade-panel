/**
 * MEXC FUTURES SERVER-SIDE PROXY HANDLER
 *
 * Browser → /api/mexc  (JSON body)
 * Server  → api.mexc.com/api/v1/<path>  (private uçlar ApiKey/Signature imzalı)
 *
 * BASE URL NOTU: MEXC futures REST API base domain'i 12 Ocak 2026'da
 * contract.mexc.com'dan api.mexc.com'a taşındı (resmi migration). WebSocket
 * hâlâ contract.mexc.com/edge kullanıyor ama bu proxy REST-only, o yüzden
 * api.mexc.com kullanılıyor. Bu sandbox'ın ağ politikası mexc.com'a
 * doğrudan istek atılmasına izin vermediği için (403 CONNECT reddi) canlı
 * bir istekle test edilemedi — WebSearch ile resmi migration duyurusundan
 * doğrulandı.
 *
 * GÜVENLİK:
 *   - API secret asla browser'a çıkmaz
 *   - Layer 1: MEXC_API_KEY / MEXC_API_SECRET (Vercel env)
 *   - Layer 2: client-provided creds (encrypted localStorage fallback)
 *   - Sadece 3 spesifik endpoint'e izin verilir (exact allow-list, KuCoin'deki
 *     aynı gerekçeyle — MEXC'in /api/v1/private/ ad alanı emir/iptal
 *     uçlarını da içeriyor)
 *
 * Kapsam: SADECE görüntüleme (pozisyon/bakiye/contract-detail) — emir
 * açma/kapatma bu proxy'den YAPILMIYOR, bilerek eklenmedi (bkz.
 * lib/exchange/index.ts).
 */

import { mexcAuthHeaders, type MexcCreds } from "./auth";

export const MEXC_BASE_URL = "https://api.mexc.com";
const REQUEST_TIMEOUT_MS = 8_000;

const PRIVATE_PATHS = [
  "/api/v1/private/position/open_positions",
  "/api/v1/private/account/assets",
] as const;
/** Public — kimlik doğrulama gerektirmez (contract multiplier için). */
const PUBLIC_PATHS = ["/api/v1/contract/detail"] as const;

type PrivatePath = (typeof PRIVATE_PATHS)[number];
type PublicPath = (typeof PUBLIC_PATHS)[number];

export interface MexcServerConfig {
  creds: MexcCreds | null;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface MexcProxyRequest {
  method: "GET";
  path: string;
  /** Query params (GET için) */
  params?: Record<string, unknown>;
  /** Layer 2 fallback credentials — public path'ler için gerekmez */
  clientCreds?: MexcCreds | null;
}

export interface MexcProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: number;
  message?: string;
}

export function loadMexcConfigFromEnv(
  env: Record<string, string | undefined>,
): MexcServerConfig {
  const hasKey = !!env.MEXC_API_KEY && !!env.MEXC_API_SECRET;
  return {
    creds: hasKey ? { key: env.MEXC_API_KEY!, secret: env.MEXC_API_SECRET! } : null,
  };
}

export async function handleMexcProxy(
  req: MexcProxyRequest,
  config: MexcServerConfig,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<MexcProxyResponse> {
  const isPublic = PUBLIC_PATHS.includes(req.path as PublicPath);
  const isPrivate = PRIVATE_PATHS.includes(req.path as PrivatePath);
  if (!isPublic && !isPrivate) {
    return { ok: false, message: "INVALID_PATH" };
  }

  const baseUrl = config.baseUrl ?? MEXC_BASE_URL;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const params = req.params ?? {};

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    const url = qs ? `${baseUrl}${req.path}?${qs}` : `${baseUrl}${req.path}`;

    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (isPrivate) {
      // Credential seçimi: Layer 1 → Layer 2 fallback
      let creds: MexcCreds | null = config.creds;
      if ((!creds?.key || !creds?.secret) && req.clientCreds?.key) {
        creds = req.clientCreds;
      }
      if (!creds?.key || !creds?.secret) {
        return { ok: false, message: "NO_MEXC_KEYS" };
      }
      const authHeaders = await mexcAuthHeaders(creds, qs, now);
      headers = { ...headers, ...authHeaders };
    }
    // Public path (contract/detail) — imza gerekmez, headers sadece Content-Type.

    const res = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: ctrl.signal,
    });

    const raw = (await res.json()) as { success?: boolean; code?: number; data?: unknown; message?: string };

    // Yanıt zarfı {success, code, data, message?} — bu sandbox'ta mexc.com'a
    // doğrudan istek atılamadığı için canlı round-trip test edilmedi, ama
    // dört BAĞIMSIZ resmi dokümantasyon örneğinde (Get Contract Info,
    // Error Code sayfası, Get All Account Assets, Place Order) aynı şekil
    // tekrarlandığı için tek-endpoint varsayımı değil, API-genelinde
    // tutarlı bir konvansiyon olarak değerlendirildi.
    if (!raw.success) {
      return { ok: false, code: raw.code, message: raw.message };
    }
    return { ok: true, data: raw.data };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      message: err.name === "AbortError" ? "TIMEOUT" : (err.message ?? "NETWORK_ERROR"),
    };
  } finally {
    clearTimeout(tid);
  }
}
