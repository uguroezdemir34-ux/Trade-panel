/**
 * SERVER SECRETS — AES-256-GCM şifreleme, server-side, STATE_ENCRYPTION_KEY'den
 * türetilmiş sabit bir anahtarla.
 *
 * lib/store/secure-storage.ts'in server-side eşdeğeri DEĞİL, tamamen ayrı bir
 * implementasyon — o dosya Master PIN + tarayıcı Web Crypto API'sine bağlı
 * (insan etkileşimi gerektirir), burada ise saatte bir çalışan bir cron job'ın
 * hiçbir insan olmadan decrypt edebilmesi gerekiyor, o yüzden anahtar sabit
 * bir server env değişkeninden (Node `crypto` modülü) türetiliyor.
 *
 * STATE_ENCRYPTION_KEY — önceden lib/config/env.ts'te okunuyordu ama hiçbir
 * kod tarafından tüketilmiyordu (CLAUDE.md §11'de "ölü kod" olarak
 * dokümante edilmişti). Bu dosya ona ilk gerçek işlevini kazandırıyor —
 * değişkenin kendisi Vercel'de zaten duruyor (2026-07-29'da rastgele bir
 * değerle rotate edildi), buraya yeniden dokunmaya gerek yok.
 *
 * Format: "SENC1:" + base64(IV[12] + authTag[16] + ciphertext) — secure-
 * storage.ts'teki "ENC1:" versiyon-marker deseniyle aynı fikir (düz JSON'dan
 * ayırt etmek için), "S" öneki server-encrypted olduğunu belirtiyor.
 */

import crypto from "crypto";

export const SERVER_ENC_PREFIX = "SENC1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class ServerSecretsNotConfiguredError extends Error {}

/**
 * STATE_ENCRYPTION_KEY'den sabit-uzunluklu (32 byte, AES-256) bir anahtar
 * türetir. PBKDF2 KASITLI OLARAK kullanılmadı — secure-storage.ts'teki PIN
 * düşük entropili bir insan girdisi olduğu için orada PBKDF2 (600k
 * iterasyon) gerekliydi; STATE_ENCRYPTION_KEY zaten `openssl rand -base64 32`
 * ile üretilmiş yüksek entropili rastgele bir değer, SHA-256 ile sabit
 * uzunluğa indirmek yeterli.
 */
function deriveKey(): Buffer {
  const raw = process.env.STATE_ENCRYPTION_KEY;
  if (!raw) {
    throw new ServerSecretsNotConfiguredError("STATE_ENCRYPTION_KEY not set");
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return SERVER_ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  if (!encoded.startsWith(SERVER_ENC_PREFIX)) {
    throw new Error("Invalid ciphertext format (missing SENC1: prefix)");
  }
  const key = deriveKey();
  const raw = Buffer.from(encoded.slice(SERVER_ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
