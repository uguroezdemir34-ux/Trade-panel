/**
 * BYBIT V5 AUTH — HMAC-SHA256 imza üretimi.
 *
 * Bybit V5 imza spec:
 *   message   = timestamp + apiKey + recv_window + rawBody
 *   rawBody   = JSON.stringify(params)  (POST)
 *             = query string (key=val&…) (GET)
 *   signature = hex(HMAC-SHA256(secret, message))
 *   recv_window = "5000"  (ms)
 *
 * GÜVENLİK: Bu modül SADECE server-side route handler'larında kullanılır.
 * Browser'a import edilmemeli — API secret sızıntısı riski.
 */

export interface BybitCreds {
  key: string;
  secret: string;
}

const RECV_WINDOW = "5000";

/**
 * HMAC-SHA256 hex digest.
 * Web Crypto API — Node.js 18+ ve browser'da çalışır.
 */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Bybit V5 auth headers.
 * rawBody: POST için JSON.stringify(params), GET için query string.
 */
export async function bybitAuthHeaders(
  creds: BybitCreds,
  timestamp: number,
  rawBody: string,
): Promise<Record<string, string>> {
  const message = `${timestamp}${creds.key}${RECV_WINDOW}${rawBody}`;
  const signature = await hmacHex(creds.secret, message);
  return {
    "X-BAPI-API-KEY": creds.key,
    "X-BAPI-SIGN": signature,
    "X-BAPI-TIMESTAMP": String(timestamp),
    "X-BAPI-RECV-WINDOW": RECV_WINDOW,
  };
}
