/**
 * OAUTH 1.0a İMZALAMA — X API v2 tweet oluşturma için.
 *
 * ⚠️ CANLI DOĞRULANMADI: X'in gerçek API'sine karşı bu ortamda test
 * edilemedi (ağ erişimi yok, X_API_KEY vb. henüz yapılandırılmamış).
 * İmzalama algoritmasının kendisi RFC 5849 (OAuth 1.0a) + X'in resmi
 * "Creating a signature" dokümantasyonuyla ve yaygın referans
 * kütüphanelerin (node-twitter-api-v2 örnekleri) davranışıyla eşleşecek
 * şekilde yazıldı — gerçek X_API_KEY/X_ACCESS_TOKEN girilip ilk gönderi
 * denendiğinde 401 (Invalid signature) alınırsa BURASI ilk şüpheli yer.
 *
 * KRİTİK DETAY — POST /2/tweets JSON body imza taban dizesine DAHİL
 * DEĞİL: OAuth 1.0a imzası sadece query string + (varsa)
 * application/x-www-form-urlencoded body parametrelerini kapsar. X API v2
 * tweet oluşturma JSON body kullanıyor — bu yüzden imza SADECE oauth_*
 * parametreleriyle hesaplanıyor, {text: "..."} body'si imzaya hiç
 * girmiyor (X'in resmi dokümantasyonu + community örnekleriyle doğrulandı,
 * bkz. WebSearch: "JSON body parameters are not included in the signature
 * base string").
 */

import crypto from "crypto";
import type { XConfig } from "./config";

/** RFC 3986 percent-encoding — encodeURIComponent RFC 3986'nın izin verdiği
 *  !*'() karakterlerini encode ETMEZ, OAuth 1.0a bunların da encode
 *  edilmesini gerektiriyor. Test edilebilirlik için export edildi. */
export function percentEncode(input: string): string {
  return encodeURIComponent(input).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export function buildSignatureBaseString(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
): string {
  const normalizedParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
    .join("&");

  return [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(normalizedParams),
  ].join("&");
}

/**
 * `Authorization: OAuth ...` header'ı üretir. `url` query string İÇERMEMELİ
 * (X API v2 /2/tweets zaten query param almıyor) — içerseydi bu fonksiyonun
 * ayrıca query parametrelerini de oauthParams'a katması gerekirdi.
 *
 * `overrides.nonce`/`overrides.timestamp` SADECE test edilebilirlik için —
 * gerçek çağrılarda hiç geçilmez, her istekte kripto-rastgele nonce +
 * gerçek zaman kullanılır (tekrar oynatma saldırılarına karşı OAuth 1.0a'nın
 * kendi koruması, bkz. RFC 5849 §3.3).
 */
export function buildOAuth1Header(
  method: string,
  url: string,
  config: XConfig,
  overrides?: { nonce?: string; timestamp?: string },
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: overrides?.nonce ?? crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: overrides?.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };

  const baseString = buildSignatureBaseString(method, url, oauthParams);
  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerStr = Object.keys(headerParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
    .join(", ");

  return `OAuth ${headerStr}`;
}
