/**
 * KUCOIN FUTURES AUTH — OKX'in hmacSign() primitifini yeniden kullanır.
 *
 * KuCoin API v2/v3 imza spec — OKX ile AYNI kripto primitifi
 * (HMAC-SHA256 + Base64 çıktı, bkz. lib/okx/auth.ts'teki hmacSign):
 *   prehash            = timestamp + method + endpoint (+ query) + body
 *   KC-API-SIGN         = Base64(HMAC-SHA256(secret, prehash))
 *   KC-API-PASSPHRASE   = Base64(HMAC-SHA256(secret, passphrase))  ← OKX'in
 *     aksine passphrase plain gönderilmiyor, AYRICA imzalanıyor
 *   timestamp           = epoch ms (string)
 *   KC-API-KEY-VERSION   = "3" (sabit)
 *
 * GÜVENLİK: Bu modül SADECE server-side route handler'larında kullanılır.
 * Browser'a import edilmemeli — API secret sızıntısı riski.
 */

import { hmacSign } from "@/lib/okx/auth";

export interface KucoinCreds {
  key: string;
  secret: string;
  passphrase: string;
}

/**
 * KuCoin auth headers.
 * @param endpoint /api/v1/... path — query string varsa DAHİL edilmeli
 *   (imza, tam path+query üzerinden hesaplanır)
 */
export async function kucoinAuthHeaders(
  creds: KucoinCreds,
  method: string,
  endpoint: string,
  body: string,
  nowMs: number = Date.now(),
): Promise<Record<string, string>> {
  const timestamp = String(nowMs);
  const prehash = timestamp + method + endpoint + body;
  const sign = await hmacSign(creds.secret, prehash);
  const encryptedPassphrase = await hmacSign(creds.secret, creds.passphrase);
  return {
    "KC-API-KEY": creds.key,
    "KC-API-SIGN": sign,
    "KC-API-TIMESTAMP": timestamp,
    "KC-API-PASSPHRASE": encryptedPassphrase,
    "KC-API-KEY-VERSION": "3",
  };
}
