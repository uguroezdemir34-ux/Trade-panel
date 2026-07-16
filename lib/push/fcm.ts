/**
 * FCM (Firebase Cloud Messaging) GÖNDERİCİ — Capacitor/Android native push.
 *
 * `firebase-admin` SDK'sı YOK bilerek — codebase'in geri kalanıyla
 * (lib/push/vapid.ts, Stripe/Clerk REST çağrıları) tutarlı, hand-rolled
 * REST: service account'un private key'iyle RS256 JWT imzalayıp Google'ın
 * OAuth2 "JWT bearer" akışıyla (RFC 7523) access token alıyor, sonra FCM
 * HTTP v1 API'ye gönderiyor. Yeni bir ağır bağımlılık eklemiyor.
 *
 * FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY eksikse (Firebase projesi
 * henüz kurulmadıysa) loadFcmConfig() `null` döner — çağıran taraf bu
 * durumda FCM göndermeyi sessizce atlar (bkz. app/api/push/trigger/route.ts).
 */

import { createSign } from "crypto";

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  /** PEM formatında, env var'dan "\n" literal olarak geldiği için çözülür. */
  privateKey: string;
}

export function loadFcmConfig(): FcmConfig | null {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const rawKey = process.env.FCM_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) return null;
  return { projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, "\n") };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Google OAuth2 service-account JWT bearer flow (RFC 7523) — her çağrıda
 * taze token alır (cache yok). Trafiği artarsa (dakikada onlarca tetikleme)
 * token'ı süresine göre (exp) memory'de cache'lemek düşünülebilir; şu anki
 * tetikleme sıklığında (GO sinyali/alarm başına bir kez) gereksiz karmaşıklık.
 */
async function getAccessToken(config: FcmConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(config.privateKey);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM OAuth2 token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface FcmSendResult {
  ok: boolean;
  status: number;
  /** Token artık geçersiz (uygulama kaldırıldı/token rotate oldu) — expired subscription temizliği için. */
  unregistered: boolean;
}

export async function sendFcmToToken(
  token: string,
  config: FcmConfig,
  notification: { title: string; body: string; data?: Record<string, string> },
): Promise<FcmSendResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken(config);
  } catch (err) {
    console.error("[fcm] access token alınamadı:", err);
    return { ok: false, status: 0, unregistered: false };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notification.title, body: notification.body },
          data: notification.data,
          android: { priority: "high" },
        },
      }),
    },
  );

  if (res.ok) return { ok: true, status: res.status, unregistered: false };

  const errText = await res.text();
  const unregistered = res.status === 404 || errText.includes("UNREGISTERED");
  console.error("[fcm] send failed:", res.status, errText);
  return { ok: false, status: res.status, unregistered };
}
