/**
 * BINANCE FAPI AUTH — HMAC-SHA256 imza üretimi.
 *
 * Binance imza spec:
 *   totalParams = query string (GET) veya URL-encoded body (POST)
 *   signature   = hex(HMAC-SHA256(secret, totalParams))
 *   timestamp   = epoch milliseconds (not ISO)
 *
 * GÜVENLİK: Bu modül SADECE server-side route handler'larında kullanılır.
 * Browser'a import edilmemeli — API secret sızıntısı riski.
 */

export interface BinanceCreds {
  key: string;
  secret: string;
}

/**
 * HMAC-SHA256 hex digest (Binance imza formatı).
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
 * URL-encoded query string'e timestamp + signature ekle.
 * Binance için hem GET params hem POST body bu şekilde imzalanır.
 */
export async function signParams(
  creds: BinanceCreds,
  params: Record<string, string | number | boolean>,
  now: number = Date.now(),
): Promise<string> {
  const withTs: Record<string, string | number | boolean> = {
    ...params,
    timestamp: now,
  };
  const qs = Object.entries(withTs)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const sig = await hmacHex(creds.secret, qs);
  return `${qs}&signature=${sig}`;
}
