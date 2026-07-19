/**
 * MEXC FUTURES AUTH — HMAC-SHA256 imza üretimi (hex çıktı).
 *
 * MEXC imza spec:
 *   prehash        = accessKey + timestamp + parameterString
 *   parameterString = query string (GET) veya JSON body (POST)
 *   signature      = hex(HMAC-SHA256(secret, prehash))
 *   timestamp      = epoch ms (string)
 *
 * Header'lar: ApiKey, Request-Time, Signature, Content-Type: application/json.
 * Bybit/Binance'inkiyle aynı hex-çıktılı primitif ama BURADA AYRICA
 * YAZILDI (yeniden kullanılmadı) — bu kod tabanının kurulu deseni: her
 * exchange modülü kendi hmacHex kopyasını taşır (bkz. lib/bybit/auth.ts,
 * lib/binance/auth.ts), sadece KuCoin/OKX Base64 primitifi paylaştığı için
 * (kullanıcı onayıyla) istisna yapıldı.
 *
 * GÜVENLİK: Bu modül SADECE server-side route handler'larında kullanılır.
 * Browser'a import edilmemeli — API secret sızıntısı riski.
 */

export interface MexcCreds {
  key: string;
  secret: string;
}

/** HMAC-SHA256 hex digest. Web Crypto API — Node.js 18+ ve browser'da çalışır. */
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
 * MEXC auth headers.
 * @param parameterString GET için query string (başında ? olmadan),
 *   POST için JSON body — imza bu string üzerinden hesaplanır.
 */
export async function mexcAuthHeaders(
  creds: MexcCreds,
  parameterString: string,
  nowMs: number = Date.now(),
): Promise<Record<string, string>> {
  const timestamp = String(nowMs);
  const prehash = creds.key + timestamp + parameterString;
  const signature = await hmacHex(creds.secret, prehash);
  return {
    ApiKey: creds.key,
    "Request-Time": timestamp,
    Signature: signature,
  };
}
