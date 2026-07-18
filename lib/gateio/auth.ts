/**
 * GATE.IO FUTURES AUTH — HMAC-SHA512 imza üretimi.
 *
 * Gate.io API v4 imza spec:
 *   signString = method + "\n" + path + "\n" + query + "\n" + bodyHash + "\n" + timestamp
 *   bodyHash   = hex(SHA512(body))   (body="" için GET → SHA512(""))
 *   sign       = hex(HMAC-SHA512(secret, signString))
 *   timestamp  = unix SANİYE (Bybit/OKX'in ms'inden FARKLI — Gate.io saniye bekliyor)
 *
 * GÜVENLİK: Bu modül SADECE server-side route handler'larında kullanılır.
 * Browser'a import edilmemeli — API secret sızıntısı riski.
 */

export interface GateioCreds {
  key: string;
  secret: string;
}

async function sha512Hex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-512", enc.encode(data));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * HMAC-SHA512 hex digest (Gate.io imza formatı).
 * Web Crypto API — Node.js 18+ ve browser'da çalışır.
 */
export async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gate.io auth headers (KEY / SIGN / Timestamp).
 * @param nowMs epoch ms — Date.now() ile aynı konvansiyon (Bybit/Binance'le
 *   tutarlı), içeride Gate.io'nun beklediği saniyeye çevrilir.
 */
export async function gateioAuthHeaders(
  creds: GateioCreds,
  method: string,
  path: string,
  query: string,
  body: string,
  nowMs: number,
): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(nowMs / 1000));
  const bodyHash = await sha512Hex(body);
  const signString = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}`;
  const sign = await hmacSha512Hex(creds.secret, signString);
  return {
    KEY: creds.key,
    SIGN: sign,
    Timestamp: timestamp,
  };
}
