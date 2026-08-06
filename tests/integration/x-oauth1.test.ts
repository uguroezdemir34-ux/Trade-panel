/**
 * X (TWITTER) OAUTH 1.0a İMZALAMA — testler.
 *
 * Bu testler, X'in gerçek API'sine karşı bu sandbox'ta CANLI DOĞRULANAMADI
 * (ağ erişimi yok). İki katmanlı doğrulama stratejisi:
 *
 *  1) MEKANİZMA testleri (percentEncode, sıralama, hassasiyet) — dış bir
 *     kaynağa bağımlı değil, RFC 3986/5849'un kendi tanımından doğrudan
 *     türetilebilir, bu yüzden güvenilir.
 *  2) Twitter'ın resmi "Creating a signature" dokümantasyonundaki yaygın
 *     bilinen örnek (consumer key xvz1evFS4wEEPTGEFPHBog, "Hello Ladies +
 *     Gentlemen..." status'u) — BU DEĞERLER eğitim verisinden hatırlanıyor,
 *     bu session'da developer.twitter.com/ilgili sayfalar canlı olarak
 *     yeniden getirilemedi (403 — bu sandbox'ta genel bir engel, Twitter'a
 *     özgü değil). Yani bu test AÇIKÇA "doğrulanmadı" işaretli tutulmalı —
 *     yanlış hatırlanmış olma ihtimali var. Gerçek X_API_KEY girildiğinde
 *     ilk canlı POST /2/tweets denemesi asıl doğrulama olacak.
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { percentEncode, buildSignatureBaseString, buildOAuth1Header } from "@/lib/notify/x/oauth1";
import type { XConfig } from "@/lib/notify/x/config";

describe("percentEncode() — RFC 3986", () => {
  it("boşluğu %20 yapar (encodeURIComponent'in + değil %20 vermesi zaten doğru, sadece teyit)", () => {
    expect(percentEncode("a b")).toBe("a%20b");
  });

  it("encodeURIComponent'in ATLADIĞI !*'() karakterlerini de encode eder", () => {
    expect(percentEncode("!")).toBe("%21");
    expect(percentEncode("*")).toBe("%2A");
    expect(percentEncode("'")).toBe("%27");
    expect(percentEncode("(")).toBe("%28");
    expect(percentEncode(")")).toBe("%29");
  });

  it("harf/rakam/-_.~ değişmeden kalır (RFC 3986 unreserved set)", () => {
    expect(percentEncode("aZ9-_.~")).toBe("aZ9-_.~");
  });

  it("+ karakterini %2B yapar (query-string '+' = boşluk karışıklığından kaçınmak için kritik)", () => {
    expect(percentEncode("+")).toBe("%2B");
  });
});

const BASE_CONFIG: XConfig = {
  apiKey: "test-consumer-key",
  apiSecret: "test-consumer-secret",
  accessToken: "test-access-token",
  accessSecret: "test-access-secret",
};

describe("buildOAuth1Header() — yapısal doğruluk", () => {
  it("'OAuth ' ile başlar, 7 parametre içerir (6 oauth_* + oauth_signature), hepsi alfabetik sıralı", () => {
    const header = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, {
      nonce: "fixednonce123",
      timestamp: "1700000000",
    });
    expect(header.startsWith("OAuth ")).toBe(true);

    const keys = [...header.matchAll(/([a-z_]+)="/g)].map((m) => m[1]);
    expect(keys).toEqual(
      [
        "oauth_consumer_key",
        "oauth_nonce",
        "oauth_signature",
        "oauth_signature_method",
        "oauth_timestamp",
        "oauth_token",
        "oauth_version",
      ].sort(),
    );
  });

  it("aynı girdiler İKİ FARKLI ÇAĞRIDA aynı imzayı üretir (deterministik — nonce/timestamp sabitlendiğinde)", () => {
    const opts = { nonce: "n1", timestamp: "1700000000" };
    const h1 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, opts);
    const h2 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, opts);
    expect(h1).toBe(h2);
  });

  it("hassasiyet: apiSecret değişince imza değişir (signing key'e gerçekten giriyor)", () => {
    const opts = { nonce: "n1", timestamp: "1700000000" };
    const h1 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, opts);
    const h2 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", { ...BASE_CONFIG, apiSecret: "different" }, opts);
    expect(h1).not.toBe(h2);
  });

  it("hassasiyet: accessSecret değişince imza değişir", () => {
    const opts = { nonce: "n1", timestamp: "1700000000" };
    const h1 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, opts);
    const h2 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", { ...BASE_CONFIG, accessSecret: "different" }, opts);
    expect(h1).not.toBe(h2);
  });

  it("hassasiyet: URL değişince imza değişir (endpoint taklidi/karışıklığına karşı)", () => {
    const opts = { nonce: "n1", timestamp: "1700000000" };
    const h1 = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, opts);
    const h2 = buildOAuth1Header("POST", "https://api.x.com/2/other", BASE_CONFIG, opts);
    expect(h1).not.toBe(h2);
  });

  it("oauth_signature değeri base64 karakter setinde (A-Za-z0-9+/=) — header'a yazılmadan ÖNCE ham base64 formatını koruyor", () => {
    const header = buildOAuth1Header("POST", "https://api.x.com/2/tweets", BASE_CONFIG, {
      nonce: "n1",
      timestamp: "1700000000",
    });
    // Header'daki değer percent-encoded olduğu için ham base64'ü ayrıca
    // manuel hesaplayıp karşılaştırıyoruz — buildSignatureBaseString'in
    // KENDİSİYLE üretilen değer, header'daki percent-encode edilmiş
    // haliyle eşleşmeli.
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: BASE_CONFIG.apiKey,
      oauth_nonce: "n1",
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: "1700000000",
      oauth_token: BASE_CONFIG.accessToken,
      oauth_version: "1.0",
    };
    const baseString = buildSignatureBaseString("POST", "https://api.x.com/2/tweets", oauthParams);
    const signingKey = `${percentEncode(BASE_CONFIG.apiSecret)}&${percentEncode(BASE_CONFIG.accessSecret)}`;
    const expectedSig = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
    expect(header).toContain(`oauth_signature="${percentEncode(expectedSig)}"`);
  });
});

describe("buildSignatureBaseString() — Twitter'ın YAYGIN BİLİNEN resmi örneği (⚠️ bu session'da CANLI doğrulanamadı, bkz. dosya başı uyarı)", () => {
  it("method+url+params birleşimi dokümantasyondaki base string'le eşleşiyor", () => {
    // Bu değerler Twitter'ın "Creating a signature" sayfasındaki klasik
    // örnekten — POST https://api.twitter.com/1.1/statuses/update.json,
    // status="Hello Ladies + Gentlemen, a signed OAuth request!",
    // include_entities=true. /2/tweets'in JSON body'si için bu tam senaryo
    // GEÇERLİ DEĞİL (bizim kodumuz body param'ları imzaya hiç katmıyor) —
    // burada SADECE buildSignatureBaseString'in genel (oauth_* + ekstra
    // param) birleştirme/sıralama/encode mekanizmasını, dokümantasyondaki
    // yayınlanmış base string'e karşı çapraz kontrol ediyoruz.
    const params: Record<string, string> = {
      status: "Hello Ladies + Gentlemen, a signed OAuth request!",
      include_entities: "true",
      oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
      oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: "1318622958",
      oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
      oauth_version: "1.0",
    };
    const baseString = buildSignatureBaseString(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json",
      params,
    );
    const expected =
      "POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521";
    expect(baseString).toBe(expected);
  });
});
