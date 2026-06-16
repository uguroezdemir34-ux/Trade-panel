/**
 * EXCHANGE CREDENTIAL ENCRYPTION — Server-side only. Never import from client code.
 *
 * Uses EXCHANGE_CREDS_KEY env var — separate from STATE_ENCRYPTION_KEY.
 *
 * Format: base64( IV[12] | AUTHTAG[16] | CIPHERTEXT[N] )
 * Algorithm: AES-256-GCM (AEAD) — authenticated, tamper-proof.
 *
 * IV: 96-bit randomBytes per call — never reused.
 * AUTHTAG: 128-bit GCM GHASH — verified on decrypt, throws on mismatch.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getMasterKey(): Buffer {
  const raw = process.env.EXCHANGE_CREDS_KEY;
  if (!raw) throw new Error("EXCHANGE_CREDS_KEY env var not set");
  const key = Buffer.from(raw, "base64");
  if (key.byteLength !== 32) {
    throw new Error(`EXCHANGE_CREDS_KEY must be 32 bytes (got ${key.byteLength})`);
  }
  return key;
}

/** Encrypt any string. Returns base64( IV[12] | TAG[16] | CT[N] ). */
export function encryptCreds(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12);                              // unique 96-bit nonce per call
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();                         // 128-bit GHASH auth tag
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a value produced by encryptCreds. Throws if tampered or key wrong. */
export function decryptCreds(encoded: string): string {
  const key = getMasterKey();
  const buf = Buffer.from(encoded, "base64");
  if (buf.byteLength < 29) throw new Error("Ciphertext too short (min IV+TAG = 28 bytes)");
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct  = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);                                // verified on final() — throws if bad
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
