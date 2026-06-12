/**
 * RFC 8291 WEB PUSH PAYLOAD ENCRYPTION
 * RFC 8188 Encrypted Content-Encoding: aes128gcm
 *
 * Harici bağımlılık yok — Web Crypto API (crypto.subtle) kullanır.
 * Node.js 18+ ve modern tarayıcılarda çalışır.
 *
 * Algoritma:
 *   1. Rastgele 16-byte salt
 *   2. Sunucu geçici ECDH anahtar çifti (P-256)
 *   3. ECDH ortak sır = sunucu_private × client_p256dh_public
 *   4. PRK = HKDF(salt=auth_secret, IKM=shared_secret, info=WebPushInfo, L=32)
 *   5. CEK = HKDF(salt=message_salt, IKM=PRK, info=cek_info, L=16)
 *   6. Nonce = HKDF(salt=message_salt, IKM=PRK, info=nonce_info, L=12)
 *   7. AES-128-GCM şifrele (0x02 dolgu ayırıcı)
 *   8. RFC 8188 başlık yap: salt + rs + idlen + server_pub + ciphertext
 */

function b64urlDecode(s: string): Uint8Array {
  const padded =
    s.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const r = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    r.set(a, off);
    off += a.length;
  }
  return r;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(ikm),
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(info),
      },
      key,
      length * 8,
    ),
  );
}

/**
 * Plaintext'i RFC 8291 / aes128gcm ile şifrele.
 * @returns Şifreli ham bayt dizisi (RFC 8188 başlık + ciphertext)
 */
export async function encryptPushPayload(
  plaintext: string,
  p256dh: string,
  auth: string,
): Promise<Uint8Array> {
  const RECORD_SIZE = 4096;
  const enc = new TextEncoder();

  // 1. Client public key'i parse et
  const clientPubRaw = b64urlDecode(p256dh);
  const clientPubKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(clientPubRaw),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  // 2. Sunucu geçici ECDH anahtar çifti
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  // 3. ECDH ortak sır (256 bit)
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPubKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  // 4. Rastgele mesaj tuzu (16 byte)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authSecret = b64urlDecode(auth);

  // 5. PRK = HKDF(auth_secret, shared_secret, "WebPush: info\0" + ua_pub + as_pub, 32)
  const prk = await hkdf(
    authSecret,
    sharedSecret,
    concat(enc.encode("WebPush: info\0"), clientPubRaw, serverPubRaw),
    32,
  );

  // 6. CEK (16 byte) + Nonce (12 byte)
  const cek = await hkdf(
    salt,
    prk,
    concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array(1)),
    16,
  );
  const nonce = await hkdf(
    salt,
    prk,
    concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array(1)),
    12,
  );

  // 7. AES-128-GCM şifrele
  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(cek),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const plainBytes = enc.encode(plaintext);
  // RFC 8188: 0x02 dolgu ayırıcı (son kayıt)
  const padded = concat(plainBytes, new Uint8Array([2]));
  const cipherWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce) },
      aesKey,
      toArrayBuffer(padded),
    ),
  );

  // 8. RFC 8188 başlık: salt(16) + rs(4 BE) + idlen(1) + server_pub(65)
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, RECORD_SIZE, false);
  const header = concat(
    salt,
    rsBytes,
    new Uint8Array([serverPubRaw.length]),
    serverPubRaw,
  );

  return concat(header, cipherWithTag);
}
