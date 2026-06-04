/**
 * VAPID SIGNING — RFC 8292 compliant VAPID JWT for Web Push.
 *
 * Web Crypto API (crypto.subtle) kullanır — Node.js 18+ + browser uyumlu.
 * Bu modül SADECE server-side'da çağrılır (/api/push/* route'ları).
 *
 * Env vars:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — base64url uncompressed EC point (65 bytes)
 *   VAPID_PRIVATE_KEY_JWK         — JSON stringified JWK private key
 *   VAPID_SUBJECT                 — mailto: URI (ör. mailto:admin@domain.com)
 *
 * Key üretimi:
 *   node scripts/generate-vapid.mjs
 */

function base64url(data: Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

interface VapidConfig {
  publicKey: string;
  privateKeyJwk: string;
  subject: string;
}

export function loadVapidConfig(): VapidConfig | null {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY_JWK;
  const sub = process.env.VAPID_SUBJECT ?? "mailto:admin@quantixos.com";
  if (!pub || !priv) return null;
  return { publicKey: pub, privateKeyJwk: priv, subject: sub };
}

/**
 * VAPID JWT oluştur + imzala (ES256).
 * audience: push endpoint URL'nin origin'i (ör. https://fcm.googleapis.com)
 */
export async function signVapidJwt(
  config: VapidConfig,
  audience: string,
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 43200, // 12h
      sub: config.subject,
    }),
  );
  const unsigned = `${header}.${payload}`;

  const jwk = JSON.parse(config.privateKeyJwk) as JsonWebKey;
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${base64url(new Uint8Array(sigBuf))}`;
}

/**
 * Subscription endpoint'ine ping-push gönder (encrypted body yok).
 * VAPID auth header ile imzalanır, browser push event'i tetikler.
 * Service worker push event handler gösterilen bildirimi oluşturur.
 */
export async function sendPushToEndpoint(
  endpoint: string,
  config: VapidConfig,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; status?: number }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await signVapidJwt(config, audience);

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt},k=${config.publicKey}`,
        "Content-Length": "0",
        TTL: "60",
      },
    });

    // 201 Created = success for web push
    // 410 Gone = subscription expired, should delete
    return { ok: res.status === 201 || res.status === 200, status: res.status };
  } catch {
    return { ok: false };
  }
}
