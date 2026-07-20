/**
 * SECURE STORAGE — AES-256-GCM şifreli localStorage katmanı, Master PIN
 * anahtar türetimiyle.
 *
 * Tehdit modeli:
 *   - localStorage düz metin olarak saklanır → XSS, tarayıcı senkronizasyonu,
 *     disk forensiği veya uzantılar bu veriyi okuyabilir.
 *   - Bu katman bakiye, trade geçmişi, risk state'i ve Layer 2 credential'ları
 *     (OKX/Telegram/Binance/Bybit) şifreli yazar.
 *
 * Şifreleme stratejisi:
 *   AES-256-GCM (AEAD) — kimlik doğrulamalı şifreleme.
 *   Her write için 96-bit rastgele IV üretilir → replay / IV-reuse saldırısı yok.
 *
 * Anahtar yönetimi (YENİ — Master PIN modeli):
 *   ÖNCEKİ modelde AES anahtarı rastgele üretilip localStorage'a (JWK olarak)
 *   yazılıyordu — yani anahtar, koruduğu veriyle AYNI storage'da duruyordu.
 *   Bu, XSS'e karşı HİÇBİR koruma sağlamıyordu (herhangi bir script hem
 *   anahtarı hem veriyi aynı yerden okuyabilirdi).
 *
 *   YENİ modelde anahtar HİÇBİR storage'a yazılmaz:
 *     1. Kullanıcı bir Master PIN girer (`unlock(pin)`).
 *     2. PIN + cihaza özel, GİZLİ OLMAYAN bir salt → PBKDF2-SHA256
 *        (600k iterasyon) ile AES-256-GCM anahtarı türetilir.
 *     3. Anahtar SADECE bellekte (modül-seviyesi değişken, `_unlockedKey`)
 *        tutulur — sayfa yenilemesi/tab kapanışı anahtarı otomatik siler
 *        (yeniden PIN girilmesi gerekir).
 *     4. `isUnlocked()` / `unlock(pin)` / `lock()` bu durumu yönetir.
 *     5. PIN doğruluğu, ilk kurulumda şifrelenen sabit bir "verifier" ile
 *        deneme-yanılma yapılarak kontrol edilir (yanlış PIN → AEAD tag
 *        mismatch → decrypt hatası).
 *   `getOrCreateSessionKey()` artık kilitliyken (`unlock()` çağrılmamışsa)
 *   HATA FIRLATIR — bu, `loadSecure`/`saveSecure`'un zaten var olan
 *   try/catch'i tarafından yakalanır (bkz. aşağıdaki "Graceful recovery"),
 *   yani kilitli durumda okuma `defaultValue`'ya, yazma `false`'a düşer,
 *   sistem çökmez.
 *
 *   ESKİ (localStorage-anahtar modeliyle) şifrelenmiş veri, yeni PIN
 *   modeline geçişte KASITLI olarak okunamaz hale gelir — bu bir migrasyon
 *   eksikliği DEĞİL, güvenlik iyileştirmesinin doğal sonucu (eski anahtar
 *   hiç saklanmıyor, saklanacak bir yer de olmamalı). Kullanıcı yeni PIN'i
 *   ilk kurduğunda eski kayıtlar decrypt edilemez → graceful recovery ile
 *   sessizce silinir, kullanıcı credential'larını (varsa) yeniden girer.
 *
 * Depolama formatı:
 *   localStorage değeri: "ENC1:<base64(IV + ciphertext)>"
 *   "ENC1:" prefiksi: sürüm marker, şifreli veri ile düz JSON'ı ayırt eder.
 *
 * Graceful recovery — İKİ FARKLI DURUM, İKİ FARKLI DAVRANIŞ (bug taramasında
 * ayrıştırıldı — önceden ikisi de aynı şekilde ele alınıp veri siliniyordu):
 *   - KİLİTLİ durum (PIN bu oturumda henüz girilmedi): GEÇİCİ bir durum,
 *     veri bozuk DEĞİL — localStorage'a hiç dokunulmaz, sadece `defaultValue`
 *     döner. `unlock()` + `reload()` sonrası veri yine okunabilir.
 *   - GERÇEK decrypt hatası (yanlış anahtar İÇERİĞİ, bozuk ciphertext, eski
 *     format, şema doğrulama hatası): localStorage kaydı silinir (varsa),
 *     `defaultValue` döner, Console'a uyarı bırakılır.
 *   Her iki durumda da sistem çökmez.
 *
 * Saf olmayan fonksiyonlar: localStorage/crypto erişir.
 * Test enjeksiyonu: `cryptoKey` parametresi ile DI sağlanır.
 */

import type { z } from "zod";
import { STORAGE_PREFIX, isStorageAvailable } from "./persist";

// ─── Sabitler ────────────────────────────────────────────────

/** localStorage değerinin başındaki sürüm markeri */
export const ENC_PREFIX = "ENC1:";

/** AES-GCM IV boyutu (byte) */
const IV_LENGTH = 12;

/** Cihaz başına bir kez üretilen, GİZLİ OLMAYAN PBKDF2 salt'ı (düz saklanabilir). */
const PIN_SALT_KEY = "ug52_pin_salt";

/** PIN doğruluğunu kanıtlamak için şifrelenmiş sabit bir işaretçi. */
const PIN_VERIFIER_KEY = "ug52_pin_verifier";

/** PBKDF2 iterasyon sayısı — OWASP 2023+ SHA-256 önerisi. */
const PBKDF2_ITERATIONS = 600_000;

/** `unlock()`'ın başarı/hata sabit metni — verifier içeriği, gizli değil. */
const VERIFIER_PLAINTEXT = { v: "quantix-pin-ok" } as const;

// ─── Singleton key (bellek içi, SADECE PIN doğrulandıktan sonra dolar) ─
// Hiçbir zaman localStorage/sessionStorage'a yazılmaz — sayfa yenilemesi
// bu değeri otomatik sıfırlar (yeniden `unlock()` gerekir).

let _unlockedKey: CryptoKey | null = null;

// ─── Web Crypto erişimi ───────────────────────────────────────

/**
 * Ortama göre Web Crypto API referansı döner.
 * Browser: window.crypto, Node.js 18+: globalThis.crypto.
 */
function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error("Web Crypto API kullanılamıyor.");
}

// ─── localStorage (key depolama — browser only) ───────────────

function getKeyStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Private mod veya SSR
  }
  return null;
}

// ─── Yardımcı: Base64 ↔ ArrayBuffer ──────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Anahtar üretimi / yükleme ────────────────────────────────

/**
 * Yeni AES-256-GCM anahtarı üret.
 * extractable=true: JWK formatına dönüştürüp sessionStorage'a kaydedebilmek için.
 */
export async function generateSessionKey(): Promise<CryptoKey> {
  return getCrypto().subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable — JWK export için
    ["encrypt", "decrypt"],
  );
}

/**
 * CryptoKey → JWK base64 string (sessionStorage için).
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const jwk = await getCrypto().subtle.exportKey("jwk", key);
  return btoa(JSON.stringify(jwk));
}

/**
 * JWK base64 string → CryptoKey.
 */
export async function importKey(encoded: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(encoded)) as JsonWebKey;
  return getCrypto().subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Kilitli/açık durumdaki oturum anahtarını döndürür.
 *
 * ÖNEMLİ DEĞİŞİKLİK: artık localStorage'dan anahtar YÜKLEMEZ/ÜRETMEZ.
 * `_unlockedKey` doluysa (yani `unlock(pin)` başarıyla çağrıldıysa) onu
 * döner; değilse hata fırlatır. Caller'lar (`loadSecure`/`saveSecure`)
 * bu hatayı zaten yakalayıp graceful recovery yapıyor — bkz. dosya başı.
 *
 * DI: `_keyOverride` sadece testlerde kullanılır (mevcut test paketi
 * tamamen `cryptoKey` DI ile çalışıyor, bu fonksiyonun varsayılan yolu
 * hiçbir mevcut testi etkilemiyor).
 */
export async function getOrCreateSessionKey(
  _keyOverride?: CryptoKey,
): Promise<CryptoKey> {
  if (_keyOverride) return _keyOverride;
  if (_unlockedKey) return _unlockedKey;
  throw new Error("LOCKED: Master PIN girilmeden şifreli veriye erişilemez.");
}

/**
 * Bellek cache'ini sıfırla (test yardımcısı + `lock()`'un iç implementasyonu).
 */
export function _resetSessionKeyCache(): void {
  _unlockedKey = null;
}

// ─── Master PIN — anahtar türetimi ────────────────────────────

/**
 * Cihaz başına bir kez üretilen PBKDF2 salt'ı. Salt GİZLİ DEĞİLDİR (PBKDF2
 * güvenliği salt'ın gizliliğine dayanmaz, sadece rainbow-table'ları önler)
 * — düz metin localStorage'da saklanması güvenlik açığı YARATMAZ.
 */
function getOrCreateSalt(): Uint8Array {
  const ks = getKeyStorage();
  if (ks) {
    try {
      const stored = ks.getItem(PIN_SALT_KEY);
      if (stored) return new Uint8Array(base64ToBuffer(stored));
    } catch {
      // devam — yeni salt üret
    }
  }
  const salt = getCrypto().getRandomValues(new Uint8Array(16));
  if (ks) {
    try {
      ks.setItem(PIN_SALT_KEY, bufferToBase64(salt.buffer));
    } catch {
      // localStorage yazılamıyor — salt sadece bu çağrı için geçerli olur,
      // bir sonraki unlock() farklı bir salt üretir (kabul edilebilir: PIN
      // doğrulaması yine de tutarlı çalışır çünkü verifier de yazılamayacak).
    }
  }
  return salt;
}

/** Master PIN + salt → AES-256-GCM anahtarı (PBKDF2-SHA256, 600k iterasyon). */
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await getCrypto().subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return getCrypto().subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // extractable=false — bu anahtar hiçbir şekilde export edilemez
    ["encrypt", "decrypt"],
  );
}

/**
 * Kullanıcı Master PIN girdiğinde çağrılır.
 *
 * İlk kurulum (henüz hiç PIN belirlenmemiş): girilen PIN "doğru PIN" olarak
 * kabul edilir, bir verifier şifrelenip kaydedilir, `isNewSetup: true` döner.
 *
 * Sonraki girişler: mevcut verifier bu PIN'den türetilen anahtarla decrypt
 * edilmeye çalışılır — yanlış PIN'de AEAD tag mismatch ile başarısız olur
 * (throw etmez, `{ ok: false }` döner — caller'ın "yanlış PIN" mesajı
 * göstermesi için).
 *
 * NOT: Yanlış girilen PIN'i "unutma" diye bir kurtarma mekanizması KASITLI
 * olarak yoktur — bu, gerçek güvenliğin gereği (bkz. dosya başı yorum).
 */
export async function unlock(pin: string): Promise<{ ok: boolean; isNewSetup: boolean }> {
  const salt = getOrCreateSalt();
  const key = await deriveKeyFromPin(pin, salt);
  const ks = getKeyStorage();
  const existingVerifier = ks?.getItem(PIN_VERIFIER_KEY) ?? null;

  if (!existingVerifier) {
    // İlk kurulum — bu PIN artık "doğru PIN"
    try {
      const verifier = await encryptValue(key, VERIFIER_PLAINTEXT);
      ks?.setItem(PIN_VERIFIER_KEY, verifier);
    } catch {
      // localStorage yazılamıyor — yine de bu oturum için kilidi aç (bellekte
      // çalışmaya devam eder), ama bir sonraki sayfa yüklemesinde verifier
      // olmadığı için yeniden "ilk kurulum" gibi davranılır.
    }
    _unlockedKey = key;
    return { ok: true, isNewSetup: true };
  }

  try {
    await decryptValue(key, existingVerifier); // yanlış PIN → burada throw eder
    _unlockedKey = key;
    return { ok: true, isNewSetup: false };
  } catch {
    return { ok: false, isNewSetup: false };
  }
}

/**
 * Bellekteki anahtarı siler — sekme kapanışında zaten otomatik olur
 * (modül state'i sıfırlanır), bu fonksiyon manuel "kilitle" aksiyonu için.
 */
export function lock(): void {
  _resetSessionKeyCache();
}

/** Kilidin şu an açık olup olmadığını (PIN doğrulanmış mı) döner. */
export function isUnlocked(): boolean {
  return _unlockedKey !== null;
}

/**
 * PIN daha önce hiç belirlenmemiş mi? (UI'ın "PIN oluştur" vs "PIN gir"
 * ekranlarından hangisini göstereceğine karar vermesi için.)
 */
export function hasPinConfigured(): boolean {
  const ks = getKeyStorage();
  if (!ks) return false;
  try {
    return ks.getItem(PIN_VERIFIER_KEY) !== null;
  } catch {
    return false;
  }
}

// ─── Şifreleme / Çözme ───────────────────────────────────────

/**
 * Herhangi bir değeri AES-256-GCM ile şifrele.
 *
 * Çıktı: "ENC1:<base64(IV || ciphertext)>"
 * IV: 96-bit rastgele, her çağrıda yeni.
 */
export async function encryptValue(
  key: CryptoKey,
  data: unknown,
): Promise<string> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = getCrypto().getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  // IV + ciphertext birleştir
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return ENC_PREFIX + bufferToBase64(combined.buffer);
}

/**
 * AES-256-GCM ile şifrelenmiş değeri çöz.
 *
 * Beklenen format: "ENC1:<base64(IV || ciphertext)>"
 * Başarısız olursa Error fırlatır (caller graceful recovery yapmalı).
 */
export async function decryptValue(
  key: CryptoKey,
  encoded: string,
): Promise<unknown> {
  if (!encoded.startsWith(ENC_PREFIX)) {
    throw new Error("Geçersiz şifreli veri formatı: ENC1 prefiksi yok.");
  }

  const b64 = encoded.slice(ENC_PREFIX.length);
  const combined = new Uint8Array(base64ToBuffer(b64));

  if (combined.length <= IV_LENGTH) {
    throw new Error("Şifreli veri çok kısa: IV + ciphertext bekleniyor.");
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await getCrypto().subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

// ─── Güvenli localStorage okuma / yazma ──────────────────────

/**
 * localStorage'dan şifreli değer oku ve çöz.
 *
 * Graceful recovery garantisi:
 *   - Şifre çözme hatası → localStorage kaydı silinir, defaultValue döner
 *   - Yanlış anahtar (key rotation sonrası) → aynı şekilde recover
 *   - Bozuk base64 / truncated → aynı şekilde recover
 *
 * @param key       localStorage key (STORAGE_PREFIX otomatik eklenir)
 * @param defaultValue  Hata durumunda dönen değer
 * @param opts.schema   Zod schema (isteğe bağlı — parse sonrası validate)
 * @param opts.cryptoKey  DI (test için override)
 */
export async function loadSecure<T>(
  key: string,
  defaultValue: T,
  opts: { schema?: z.ZodType<T>; cryptoKey?: CryptoKey } = {},
): Promise<T> {
  if (!isStorageAvailable()) return defaultValue;
  const fullKey = STORAGE_PREFIX + key;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(fullKey);
  } catch {
    return defaultValue;
  }

  if (raw === null) return defaultValue;

  // Düz JSON (şifresiz eski format) → schema ile parse edip döndür
  if (!raw.startsWith(ENC_PREFIX)) {
    try {
      const parsed = JSON.parse(raw);
      if (opts.schema) {
        const result = opts.schema.safeParse(parsed);
        return result.success ? result.data : defaultValue;
      }
      return parsed as T;
    } catch {
      return defaultValue;
    }
  }

  // KİLİTLİ DURUM — decrypt hiç denenmeden, YAPISAL olarak ayrı ele alınır.
  // Bug taramasında bulundu: önceden bu kontrol yoktu, getOrCreateSessionKey()
  // "LOCKED" hatasıyla throw ediyordu ve bu, aşağıdaki genel catch bloğuna
  // düşüp GERÇEK decrypt hatasıyla (yanlış anahtar İÇERİĞİ, bozuk ciphertext)
  // AYNI şekilde ele alınıyordu — ikisinde de kayıt siliniyordu. Sonuç: PIN
  // henüz bu oturumda girilmemişken (ki bu, AppShell'in her açılışta
  // koşulsuz çağırdığı credentialStore.load() için normal bir durum) çağrılan
  // her loadSecure() TÜM kayıtlı API anahtarlarını kalıcı olarak siliyordu.
  //
  // Hata mesajı/tipine bakarak ayrım yapmak (catch içinde "bu LOCKED mıydı"
  // diye kontrol etmek) kırılgan olurdu — bunun yerine isUnlocked() ile
  // decrypt denemesinden ÖNCE, yapısal olarak kontrol ediyoruz. DI
  // (opts.cryptoKey, sadece testlerde) bu kontrolü atlar — test her zaman
  // kendi anahtarını sağlar, "oturum kilidi" kavramıyla ilgilenmez.
  if (!opts.cryptoKey && !isUnlocked()) {
    return defaultValue; // localStorage'a HİÇ DOKUNULMADI — veri korunuyor
  }

  // Şifreli format → çöz. Buraya sadece gerçek bir CryptoKey mevcutken
  // girilir (yukarıdaki kilit kontrolünü geçti VEYA test DI'ı var) — yani
  // buradaki başarısızlık artık GERÇEK bir decrypt hatası, "kilit açık değil"
  // değil.
  try {
    const cryptoKey =
      opts.cryptoKey ?? (await getOrCreateSessionKey());
    const decrypted = await decryptValue(cryptoKey, raw);

    if (opts.schema) {
      const result = opts.schema.safeParse(decrypted);
      if (!result.success) {
        console.warn(`[secure-storage] "${key}" şifre çözüldü ama şema doğrulaması başarısız — kayıt siliniyor.`);
        window.localStorage.removeItem(fullKey);
        return defaultValue;
      }
      return result.data;
    }

    return decrypted as T;
  } catch {
    // Gerçek decrypt hatası — anahtar (PIN'den türetilmiş veya DI) bu
    // ciphertext'i çözemedi (AEAD tag mismatch) ya da veri gerçekten bozuk.
    // Kullanıcı hiç bilgilendirilmeden veri kaybetmesin diye en azından
    // Console'a net bir uyarı bırakılıyor (kullanıcı kararı — sessiz silme
    // yerine bari iz bırakılsın).
    console.warn(
      `[secure-storage] "${key}" için şifre çözme başarısız — kayıt siliniyor. ` +
        `Olası nedenler: yanlış PIN'den türetilmiş bir anahtarla decrypt denemesi, ` +
        `ya da bozuk/eski format veri.`,
    );
    try {
      window.localStorage.removeItem(fullKey);
    } catch {
      // Silme de başarısız olabilir (storage erişim hatası)
    }
    return defaultValue;
  }
}

/**
 * localStorage'a şifreli değer yaz.
 *
 * @returns true → başarılı, false → SSR / quota dolu / şifreleme hatası
 */
export async function saveSecure<T>(
  key: string,
  value: T,
  opts: { cryptoKey?: CryptoKey } = {},
): Promise<boolean> {
  if (!isStorageAvailable()) return false;
  const fullKey = STORAGE_PREFIX + key;

  try {
    const cryptoKey = opts.cryptoKey ?? (await getOrCreateSessionKey());
    const encrypted = await encryptValue(cryptoKey, value);
    window.localStorage.setItem(fullKey, encrypted);
    return true;
  } catch {
    return false;
  }
}

// ─── Veri tipi: şifreli mi? ───────────────────────────────────

/**
 * Belirli bir localStorage key'inin şifreli formatda saklandığını kontrol et.
 * UI ve migrasyon için yardımcı.
 */
export function isEncrypted(key: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw !== null && raw.startsWith(ENC_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Düz JSON'dan şifreli formata tek seferlik migrasyon.
 *
 * Mevcut veriyi okur (düz JSON), şifreli olarak yeniden yazar.
 * Zaten şifreliyse no-op.
 *
 * @returns "migrated" | "already_encrypted" | "no_data" | "error"
 */
export async function migrateToEncrypted(
  key: string,
  opts: { cryptoKey?: CryptoKey } = {},
): Promise<"migrated" | "already_encrypted" | "no_data" | "error"> {
  if (!isStorageAvailable()) return "error";
  const fullKey = STORAGE_PREFIX + key;

  try {
    const raw = window.localStorage.getItem(fullKey);
    if (raw === null) return "no_data";
    if (raw.startsWith(ENC_PREFIX)) return "already_encrypted";

    const parsed = JSON.parse(raw);
    const cryptoKey = opts.cryptoKey ?? (await getOrCreateSessionKey());
    const encrypted = await encryptValue(cryptoKey, parsed);
    window.localStorage.setItem(fullKey, encrypted);
    return "migrated";
  } catch {
    return "error";
  }
}
