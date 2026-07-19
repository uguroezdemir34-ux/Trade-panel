/**
 * KRAKEN FUTURES AUTH — iç içe (nested) SHA256 + HMAC-SHA512 imza, Base64 çıktı.
 *
 * Kraken Futures imza spec (Kraken SPOT'unkiyle KARIŞTIRILMASIN — path
 * SHA256'nın dışında/HMAC mesajının parçası olduğu Spot şemasından farklı,
 * burada path SHA256'nın İÇİNDE):
 *   step1   = SHA256(postData + nonce + endpointPath)   → 32 byte hash
 *   Authent = Base64(HMAC-SHA512(base64_decode(secret), step1_hash_bytes))
 *   HMAC mesajı SADECE step1'in hash byte'ları — path/nonce HMAC'a tekrar
 *   dahil edilmiyor, sadece SHA256'nın girdisinde.
 *
 * NOT: API secret'ın kendisi Base64 kodlu geliyor ve HMAC anahtarı olarak
 * kullanılmadan önce decode edilmesi gerekiyor — diğer 5 borsadan (OKX/
 * Binance/Bybit/Gate.io/KuCoin/MEXC) farklı, onların hiçbirinde secret'ı
 * decode etmek gerekmiyordu, raw string doğrudan HMAC anahtarıydı.
 *
 * Nonce: Kraken sürekli/monotonik artan bir tam sayı istiyor (diğer
 * borsalardan farklı — onlar sadece "sunucu saatine yakın" istiyor).
 * Date.now() kullanılıyor ama aynı milisaniyede ardışık istekler nonce
 * çakışmasına yol açabileceği için modül-seviyesi bir sayaçla kesin artış
 * garanti ediliyor.
 *
 * GÜVENLİK: Bu modül SADECE server-side route handler'larında kullanılır.
 * Browser'a import edilmemeli — API secret sızıntısı riski.
 */

export interface KrakenCreds {
  key: string;
  secret: string;
}

let lastNonce = 0;

/** Kesin monotonik artan nonce — aynı ms içinde ardışık çağrılarda bile çakışmaz. */
function nextNonce(): number {
  const now = Date.now();
  lastNonce = Math.max(now, lastNonce + 1);
  return lastNonce;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function sha256Bytes(message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(message));
  return new Uint8Array(digest);
}

async function hmacSha512Bytes(secretBytes: Uint8Array, messageBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, messageBytes as BufferSource);
  return new Uint8Array(sig);
}

/**
 * Kraken Futures auth headers.
 * @param postData GET için query string (query param'lar & ile birleştirilmiş,
 *   başında ? olmadan), POST için body — imzanın bir parçası.
 * @param endpointPath /derivatives/api/v3/... path (query string HARİÇ)
 */
export async function krakenAuthHeaders(
  creds: KrakenCreds,
  postData: string,
  endpointPath: string,
): Promise<Record<string, string>> {
  const nonce = nextNonce();
  const step1Message = postData + String(nonce) + endpointPath;
  const hashBytes = await sha256Bytes(step1Message);
  const secretBytes = base64ToBytes(creds.secret);
  const macBytes = await hmacSha512Bytes(secretBytes, hashBytes);
  const authent = bytesToBase64(macBytes);
  return {
    APIKey: creds.key,
    Authent: authent,
    Nonce: String(nonce),
  };
}
