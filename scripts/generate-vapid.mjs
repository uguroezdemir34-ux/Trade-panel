/**
 * VAPID KEY GENERATOR — Web Push için EC P-256 anahtar çifti üretir.
 *
 * Kullanım:
 *   node scripts/generate-vapid.mjs
 *
 * Çıktıyı .env.local'a yapıştırın:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY_JWK=...
 */

const { webcrypto: { subtle } } = await import("crypto");

const pair = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

// Public key: uncompressed EC point (65 bytes), base64url
const rawPublic = await subtle.exportKey("raw", pair.publicKey);
const publicKeyB64 = Buffer.from(rawPublic).toString("base64url");

// Private key: JWK (contains d, x, y)
const privateJwk = await subtle.exportKey("jwk", pair.privateKey);

console.log("# ── .env.local'a kopyala ──────────────────────────────");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKeyB64}`);
console.log(`VAPID_PRIVATE_KEY_JWK=${JSON.stringify(privateJwk)}`);
console.log("VAPID_SUBJECT=mailto:admin@yourdomain.com");
console.log("#──────────────────────────────────────────────────────");
