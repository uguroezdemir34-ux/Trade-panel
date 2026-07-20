/**
 * SECURE STORAGE — Güvenlik İzolasyon Testleri
 *
 * Doğrulanan güvenceler:
 *   1. Şifreleme doğruluğu — ciphertext düz metin içermiyor
 *   2. Anahtar izolasyonu — yanlış anahtarla çözme başarısız
 *   3. Graceful recovery — bozuk/geçersiz veri gelince sistem çökmüyor
 *   4. IV benzersizliği — aynı veriyi iki kez şifrelemek farklı ciphertext üretiyor
 *   5. ENC1 prefix marker — format doğrulaması
 *   6. Düz JSON → şifreli migrasyon (migrateToEncrypted)
 *   7. Karma format (şifreli + düz) yönetimi
 *   8. Zod schema validate — şifresi çözülmüş veri validate fails → graceful default
 *   9. localStorage unavailable → no-op, no throw
 *  10. Quota / write error → graceful false
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  generateSessionKey,
  exportKey,
  importKey,
  encryptValue,
  decryptValue,
  loadSecure,
  saveSecure,
  isEncrypted,
  migrateToEncrypted,
  _resetSessionKeyCache,
  ENC_PREFIX,
  unlock,
  lock,
  isUnlocked,
  hasPinConfigured,
  getOrCreateSessionKey,
} from "@/lib/store/secure-storage";
import { STORAGE_PREFIX } from "@/lib/store/persist";

// ─────────────────────────────────────────────────────────────
// localStorage mock (Node.js test ortamı)
// ─────────────────────────────────────────────────────────────

function makeLocalStorageMock(): Storage & { _store: Map<string, string> } {
  const _store = new Map<string, string>();
  return {
    _store,
    get length() {
      return _store.size;
    },
    key(index: number): string | null {
      return [..._store.keys()][index] ?? null;
    },
    getItem(key: string): string | null {
      return _store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      _store.set(key, value);
    },
    removeItem(key: string): void {
      _store.delete(key);
    },
    clear(): void {
      _store.clear();
    },
  };
}

let mockStorage: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  mockStorage = makeLocalStorageMock();
  // window mock: Node.js testlerinde window yoktur; polyfill ekliyoruz.
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: mockStorage,
      sessionStorage: makeLocalStorageMock(),
    },
    writable: true,
    configurable: true,
  });
  _resetSessionKeyCache();
});

afterEach(() => {
  // window tanımını kaldır — diğer testleri etkilemesin
  Object.defineProperty(globalThis, "window", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  _resetSessionKeyCache();
});

// ─────────────────────────────────────────────────────────────
// 1. Temel Şifreleme / Çözme
// ─────────────────────────────────────────────────────────────

describe("encryptValue() / decryptValue() — temel doğruluk", () => {
  it("basit nesneyi şifreler ve aynısını geri döner", async () => {
    const key = await generateSessionKey();
    const data = { balance: 50000, pair: "BTC", active: true };
    const encrypted = await encryptValue(key, data);
    const decrypted = await decryptValue(key, encrypted);
    expect(decrypted).toEqual(data);
  });

  it("string değer şifrelenir ve çözülür", async () => {
    const key = await generateSessionKey();
    const enc = await encryptValue(key, "gizli-api-key");
    const dec = await decryptValue(key, enc);
    expect(dec).toBe("gizli-api-key");
  });

  it("sayı değer şifrelenir ve çözülür", async () => {
    const key = await generateSessionKey();
    const enc = await encryptValue(key, 3.14159);
    const dec = await decryptValue(key, enc);
    expect(dec).toBe(3.14159);
  });

  it("null değer şifrelenir ve çözülür", async () => {
    const key = await generateSessionKey();
    const enc = await encryptValue(key, null);
    const dec = await decryptValue(key, enc);
    expect(dec).toBeNull();
  });

  it("dizi şifrelenir ve çözülür", async () => {
    const key = await generateSessionKey();
    const arr = [1, "iki", { üç: 3 }];
    const enc = await encryptValue(key, arr);
    const dec = await decryptValue(key, enc);
    expect(dec).toEqual(arr);
  });

  it("büyük veri (500 trade) şifrelenir ve çözülür", async () => {
    const key = await generateSessionKey();
    const trades = Array.from({ length: 500 }, (_, i) => ({
      id: `trade-${i}`,
      pnl: Math.random() * 1000,
      ts: Date.now() - i * 3600,
    }));
    const enc = await encryptValue(key, trades);
    const dec = await decryptValue(key, enc) as typeof trades;
    expect(dec).toHaveLength(500);
    expect(dec[0].id).toBe("trade-0");
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Ciphertext düz metin içermemeli (XSS güvencesi)
// ─────────────────────────────────────────────────────────────

describe("XSS koruması — ciphertext düz metin içermez", () => {
  it("bakiye bilgisi ciphertext'te görünmez", async () => {
    const key = await generateSessionKey();
    const sensitive = { balanceTotal: 123456.78, balanceFree: 98765.43 };
    const encrypted = await encryptValue(key, sensitive);
    expect(encrypted).not.toContain("123456");
    expect(encrypted).not.toContain("98765");
    expect(encrypted).not.toContain("balanceTotal");
    expect(encrypted).not.toContain("balanceFree");
  });

  it("API anahtarı ciphertext'te görünmez", async () => {
    const key = await generateSessionKey();
    const apiKey = "sk_live_SUPER_SECRET_KEY_XYZ789";
    const encrypted = await encryptValue(key, apiKey);
    expect(encrypted).not.toContain("SUPER_SECRET");
    expect(encrypted).not.toContain("sk_live");
  });

  it("pozisyon bilgisi ciphertext'te görünmez", async () => {
    const key = await generateSessionKey();
    const position = {
      pair: "BTC", direction: "LONG",
      entryPrice: 95000, qty: 0.5, slPrice: 93000,
    };
    const encrypted = await encryptValue(key, position);
    expect(encrypted).not.toContain("entryPrice");
    expect(encrypted).not.toContain("95000");
    expect(encrypted).not.toContain("93000");
    expect(encrypted).not.toContain("LONG");
  });

  it("şifreli değer ENC1: prefiksiyle başlar", async () => {
    const key = await generateSessionKey();
    const enc = await encryptValue(key, { test: true });
    expect(enc.startsWith(ENC_PREFIX)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. IV Benzersizliği
// ─────────────────────────────────────────────────────────────

describe("IV benzersizliği — replay saldırısı koruması", () => {
  it("aynı veri iki kez şifreland→ farklı ciphertext", async () => {
    const key = await generateSessionKey();
    const data = { balance: 50000 };
    const enc1 = await encryptValue(key, data);
    const enc2 = await encryptValue(key, data);
    expect(enc1).not.toBe(enc2);
  });

  it("her şifrelemede IV farklı (100 örnek)", async () => {
    const key = await generateSessionKey();
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(await encryptValue(key, "sabit veri"));
    }
    // Tüm 100 şifreleme farklı olmalı
    expect(results.size).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Anahtar İzolasyonu — yanlış key ile çözme başarısız
// ─────────────────────────────────────────────────────────────

describe("Anahtar izolasyonu — yanlış key ile veri okunamaz", () => {
  it("farklı anahtarla şifre çözme hata fırlatır", async () => {
    const keyA = await generateSessionKey();
    const keyB = await generateSessionKey();

    const encrypted = await encryptValue(keyA, { secret: "gizli" });
    await expect(decryptValue(keyB, encrypted)).rejects.toThrow();
  });

  it("loadSecure yanlış key → default döner (çökmez)", async () => {
    const keyA = await generateSessionKey();
    const keyB = await generateSessionKey();

    // keyA ile yaz
    const enc = await encryptValue(keyA, { balance: 99999 });
    mockStorage.setItem(STORAGE_PREFIX + "test_account", enc);

    // keyB ile oku → graceful recovery
    const result = await loadSecure("test_account", { balance: 0 }, {
      cryptoKey: keyB,
    });
    expect(result).toEqual({ balance: 0 });
    // Bozuk kayıt silinmeli
    expect(mockStorage.getItem(STORAGE_PREFIX + "test_account")).toBeNull();
  });

  it("anahtar rotasyonu: eski şifreli veri → default'a düşer, yeni veri yazılabilir", async () => {
    const oldKey = await generateSessionKey();
    const newKey = await generateSessionKey();

    // Eski key ile yaz
    await saveSecure("rotation_test", { val: "eski" }, { cryptoKey: oldKey });

    // Yeni key ile oku → graceful recovery, default döner
    const result = await loadSecure("rotation_test", { val: "default" }, {
      cryptoKey: newKey,
    });
    expect(result.val).toBe("default");

    // Yeni key ile yaz → başarılı
    const saved = await saveSecure("rotation_test", { val: "yeni" }, { cryptoKey: newKey });
    expect(saved).toBe(true);

    // Yeni key ile oku → doğru veri
    const newResult = await loadSecure("rotation_test", { val: "default" }, {
      cryptoKey: newKey,
    });
    expect(newResult.val).toBe("yeni");
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Graceful Recovery — bozuk veri
// ─────────────────────────────────────────────────────────────

describe("Graceful Recovery — bozuk şifreli veri", () => {
  it("bozuk base64 → default döner, çökmez", async () => {
    const key = await generateSessionKey();
    mockStorage.setItem(STORAGE_PREFIX + "corrupted", ENC_PREFIX + "!!!BOZUK_BASE64!!!");
    const result = await loadSecure("corrupted", { safe: true }, { cryptoKey: key });
    expect(result).toEqual({ safe: true });
  });

  it("truncated ciphertext → default döner", async () => {
    const key = await generateSessionKey();
    // IV kısmından kısa → çözme başarısız
    const truncated = ENC_PREFIX + btoa("tooshort");
    mockStorage.setItem(STORAGE_PREFIX + "truncated", truncated);
    const result = await loadSecure("truncated", "fallback", { cryptoKey: key });
    expect(result).toBe("fallback");
  });

  it("random bytes ciphertext → default döner", async () => {
    const key = await generateSessionKey();
    // Geçerli IV uzunluğu ama rastgele ciphertext → AES-GCM auth tag hatası
    const fakeIv = new Uint8Array(12).fill(0xAB);
    const fakeCt = new Uint8Array(32).fill(0xCD);
    const combined = new Uint8Array(44);
    combined.set(fakeIv);
    combined.set(fakeCt, 12);
    const b64 = btoa(String.fromCharCode(...combined));
    mockStorage.setItem(STORAGE_PREFIX + "random_ct", ENC_PREFIX + b64);
    const result = await loadSecure("random_ct", 42, { cryptoKey: key });
    expect(result).toBe(42);
  });

  it("bozuk kayıt loadSecure sonrası localStorage'dan silinir", async () => {
    const key = await generateSessionKey();
    mockStorage.setItem(STORAGE_PREFIX + "del_test", ENC_PREFIX + "BOZUK!");
    await loadSecure("del_test", null, { cryptoKey: key });
    expect(mockStorage.getItem(STORAGE_PREFIX + "del_test")).toBeNull();
  });

  it("ENC1 prefiksi olmayan değer → düz JSON olarak parse edilir", async () => {
    // Eski format (şifresiz) geriye dönük uyumluluk
    const plainData = { legacyBalance: 12345 };
    mockStorage.setItem(STORAGE_PREFIX + "legacy", JSON.stringify(plainData));
    const key = await generateSessionKey();
    const result = await loadSecure("legacy", { legacyBalance: 0 }, { cryptoKey: key });
    expect(result.legacyBalance).toBe(12345);
  });

  it("decryptValue'ya ENC1 prefiksi olmayan string → hata fırlatır", async () => {
    const key = await generateSessionKey();
    await expect(decryptValue(key, "plain_text_no_prefix")).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 6. Zod Schema Validate — çözülmüş veri geçersizse default
// ─────────────────────────────────────────────────────────────

describe("Zod schema validation", () => {
  const balanceSchema = z.object({
    balanceTotal: z.number().positive(),
    balanceFree: z.number().positive(),
  });

  it("schema validate geçer → doğru veri döner", async () => {
    const key = await generateSessionKey();
    const valid = { balanceTotal: 50000, balanceFree: 30000 };
    await saveSecure("schema_valid", valid, { cryptoKey: key });
    const result = await loadSecure("schema_valid", { balanceTotal: 0, balanceFree: 0 }, {
      cryptoKey: key,
      schema: balanceSchema,
    });
    expect(result.balanceTotal).toBe(50000);
  });

  it("schema validate başarısız → default döner + kayıt silinir", async () => {
    const key = await generateSessionKey();
    // Negatif bakiye → schema reject
    const invalid = { balanceTotal: -500, balanceFree: 0 };
    await saveSecure("schema_invalid", invalid, { cryptoKey: key });

    const result = await loadSecure(
      "schema_invalid",
      { balanceTotal: 0, balanceFree: 0 },
      { cryptoKey: key, schema: balanceSchema },
    );
    expect(result.balanceTotal).toBe(0);
    expect(mockStorage.getItem(STORAGE_PREFIX + "schema_invalid")).toBeNull();
  });

  it("tip uyuşmazlığı (string vs number) → schema reject → default", async () => {
    const key = await generateSessionKey();
    const wrongType = { balanceTotal: "not_a_number", balanceFree: 100 };
    await saveSecure("type_mismatch", wrongType, { cryptoKey: key });

    const result = await loadSecure(
      "type_mismatch",
      { balanceTotal: 0, balanceFree: 0 },
      { cryptoKey: key, schema: balanceSchema },
    );
    expect(result.balanceTotal).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 7. saveSecure / loadSecure round-trip
// ─────────────────────────────────────────────────────────────

describe("saveSecure() / loadSecure() round-trip", () => {
  it("yazılan veri şifreli formatta saklanır", async () => {
    const key = await generateSessionKey();
    await saveSecure("rt_test", { x: 1 }, { cryptoKey: key });
    const raw = mockStorage.getItem(STORAGE_PREFIX + "rt_test");
    expect(raw).not.toBeNull();
    expect(raw!.startsWith(ENC_PREFIX)).toBe(true);
  });

  it("STORAGE_PREFIX otomatik eklenir", async () => {
    const key = await generateSessionKey();
    await saveSecure("prefix_test", 99, { cryptoKey: key });
    // Ham storage key'i kontrol et
    expect(mockStorage._store.has(STORAGE_PREFIX + "prefix_test")).toBe(true);
    expect(mockStorage._store.has("prefix_test")).toBe(false);
  });

  it("üzerine yazma: son değer okunur", async () => {
    const key = await generateSessionKey();
    await saveSecure("overwrite", { v: 1 }, { cryptoKey: key });
    await saveSecure("overwrite", { v: 2 }, { cryptoKey: key });
    const result = await loadSecure("overwrite", { v: 0 }, { cryptoKey: key });
    expect(result.v).toBe(2);
  });

  it("complex nested object round-trip", async () => {
    const key = await generateSessionKey();
    const complex = {
      trades: [
        { id: "t1", pnl: 500.25, status: "closed" },
        { id: "t2", pnl: -100.5, status: "open" },
      ],
      equity: { balance: 10000, unrealized: 250 },
      flags: { locked: false, halted: false },
    };
    await saveSecure("complex", complex, { cryptoKey: key });
    const result = await loadSecure("complex", {}, { cryptoKey: key });
    expect(result).toEqual(complex);
  });

  it("mevcut kayıt yoksa defaultValue döner", async () => {
    const key = await generateSessionKey();
    const result = await loadSecure("nonexistent_key_xyz", 42, { cryptoKey: key });
    expect(result).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. isEncrypted()
// ─────────────────────────────────────────────────────────────

describe("isEncrypted()", () => {
  it("şifreli kayıt için true döner", async () => {
    const key = await generateSessionKey();
    await saveSecure("enc_check", { x: 1 }, { cryptoKey: key });
    expect(isEncrypted("enc_check")).toBe(true);
  });

  it("düz JSON kayıt için false döner", () => {
    mockStorage.setItem(STORAGE_PREFIX + "plain_check", JSON.stringify({ x: 1 }));
    expect(isEncrypted("plain_check")).toBe(false);
  });

  it("kayıt yoksa false döner", () => {
    expect(isEncrypted("missing_key_xyz")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. migrateToEncrypted()
// ─────────────────────────────────────────────────────────────

describe("migrateToEncrypted()", () => {
  it("düz JSON'ı şifreli formata dönüştürür", async () => {
    const key = await generateSessionKey();
    const data = { balance: 75000 };
    mockStorage.setItem(STORAGE_PREFIX + "migrate_me", JSON.stringify(data));

    const result = await migrateToEncrypted("migrate_me", { cryptoKey: key });
    expect(result).toBe("migrated");

    // Artık şifreli
    expect(isEncrypted("migrate_me")).toBe(true);

    // Veri hâlâ okunabilir
    const loaded = await loadSecure("migrate_me", {}, { cryptoKey: key });
    expect(loaded).toEqual(data);
  });

  it("zaten şifreliyse 'already_encrypted' döner", async () => {
    const key = await generateSessionKey();
    await saveSecure("already_enc", { x: 1 }, { cryptoKey: key });
    const result = await migrateToEncrypted("already_enc", { cryptoKey: key });
    expect(result).toBe("already_encrypted");
  });

  it("kayıt yoksa 'no_data' döner", async () => {
    const key = await generateSessionKey();
    const result = await migrateToEncrypted("does_not_exist_xyz", { cryptoKey: key });
    expect(result).toBe("no_data");
  });

  it("migrasyon sonrası doğru veri okunur (integrity)", async () => {
    const key = await generateSessionKey();
    const original = { trades: [{ id: "t1", pnl: 999 }], version: 2 };
    mockStorage.setItem(STORAGE_PREFIX + "integrity_test", JSON.stringify(original));

    await migrateToEncrypted("integrity_test", { cryptoKey: key });
    const loaded = await loadSecure("integrity_test", {}, { cryptoKey: key });
    expect(loaded).toEqual(original);
  });
});

// ─────────────────────────────────────────────────────────────
// 10. exportKey / importKey — anahtar serileştirme
// ─────────────────────────────────────────────────────────────

describe("exportKey() / importKey() — anahtar serileştirme", () => {
  it("export → import → aynı veriyi çözer", async () => {
    const key = await generateSessionKey();
    const data = { secret: "kritik-veri" };
    const encrypted = await encryptValue(key, data);

    const exported = await exportKey(key);
    const imported = await importKey(exported);

    const decrypted = await decryptValue(imported, encrypted);
    expect(decrypted).toEqual(data);
  });

  it("export string base64 formatında", async () => {
    const key = await generateSessionKey();
    const exported = await exportKey(key);
    // Base64 karakterleri kontrolü
    expect(() => atob(exported)).not.toThrow();
  });

  it("farklı import'lar bağımsız — aynı şifreli veriyi çözebilir", async () => {
    const key = await generateSessionKey();
    const exported = await exportKey(key);

    const encrypted = await encryptValue(key, 42);

    const importedA = await importKey(exported);
    const importedB = await importKey(exported);

    expect(await decryptValue(importedA, encrypted)).toBe(42);
    expect(await decryptValue(importedB, encrypted)).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────
// 11. Storage Unavailable — SSR / quota guard
// ─────────────────────────────────────────────────────────────

describe("storage unavailable senaryoları", () => {
  it("window.localStorage yoksa loadSecure defaultValue döner", async () => {
    // window'u gizle
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const key = await generateSessionKey();
    const result = await loadSecure("any_key", "DEFAULT", { cryptoKey: key });
    expect(result).toBe("DEFAULT");
  });

  it("window.localStorage yoksa saveSecure false döner", async () => {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const key = await generateSessionKey();
    const saved = await saveSecure("any_key", { x: 1 }, { cryptoKey: key });
    expect(saved).toBe(false);
  });

  it("localStorage setItem exception → saveSecure false döner (quota simülasyonu)", async () => {
    const quotaMock = makeLocalStorageMock();
    // setItem her zaman hata fırlatır (QuotaExceededError simülasyonu)
    quotaMock.setItem = () => { throw new Error("QuotaExceededError"); };
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: quotaMock, sessionStorage: makeLocalStorageMock() },
      writable: true,
      configurable: true,
    });

    const key = await generateSessionKey();
    const result = await saveSecure("quota_test", { big: "data" }, { cryptoKey: key });
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 12. Hassas alan örnekleri — gerçek store verileri
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 13. Master PIN — unlock() / lock() / isUnlocked()
// ─────────────────────────────────────────────────────────────

describe("Master PIN — unlock()/lock()/isUnlocked()", () => {
  it("kilitliyken getOrCreateSessionKey() hata fırlatır", async () => {
    expect(isUnlocked()).toBe(false);
    await expect(getOrCreateSessionKey()).rejects.toThrow(/LOCKED/);
  });

  it("kilitliyken loadSecure/saveSecure çökmez — default/false döner", async () => {
    // cryptoKey override YOK — varsayılan (kilitli) yol test ediliyor
    const loadResult = await loadSecure("locked_test", "DEFAULT");
    expect(loadResult).toBe("DEFAULT");

    const saveResult = await saveSecure("locked_test", { x: 1 });
    expect(saveResult).toBe(false);
  });

  // ── Bug taraması: "kilitli" ile "gerçekten bozuk/yanlış anahtar" ayrımı ──
  // Önceden ikisi de aynı catch bloğuna düşüp localStorage kaydını
  // siliyordu — sonuç: PIN henüz girilmemişken (uygulama boot'unda normal
  // bir durum) çağrılan her loadSecure() kayıtlı TÜM API anahtarlarını
  // kalıcı olarak siliyordu (bkz. AppShell.tsx'in koşulsuz credentialStore.
  // load() çağrısı). Aşağıdaki iki test bu ayrımı doğrudan doğrular.

  it("KİLİTLİYKEN var olan şifreli kayıt SİLİNMEZ — sadece defaultValue döner", async () => {
    // Gerçek (herhangi bir) anahtarla önceden şifrelenmiş veri simülasyonu —
    // hangi anahtarla şifrelendiği önemli değil, çünkü kilitliyken decrypt
    // HİÇ DENENMEMELİ.
    const someKey = await generateSessionKey();
    const encrypted = await encryptValue(someKey, { apiKey: "sk_live_should_survive" });
    mockStorage.setItem(STORAGE_PREFIX + "okx_prod_locked", encrypted);

    expect(isUnlocked()).toBe(false); // beforeEach zaten kilitli başlatıyor
    const loaded = await loadSecure("okx_prod_locked", null);
    expect(loaded).toBeNull(); // defaultValue döndü

    // KRİTİK ASSERTION — bug'ın tam kalbi: kayıt hâlâ orada, silinmedi.
    const raw = mockStorage.getItem(STORAGE_PREFIX + "okx_prod_locked");
    expect(raw).not.toBeNull();
    expect(raw).toBe(encrypted);

    // Ve unlock() sonrası (doğru anahtarla) veri hâlâ okunabilir olmalı.
    // NOT: someKey PIN'den türetilmediği için gerçek unlock() bunu
    // çözemez — burada sadece "silinmedi" iddiasını, verinin cryptoKey DI
    // ile hâlâ okunabilir olduğunu göstererek teyit ediyoruz.
    const stillReadable = await loadSecure("okx_prod_locked", null, { cryptoKey: someKey });
    expect(stillReadable).toEqual({ apiKey: "sk_live_should_survive" });
  });

  it("KİLİT AÇIKKEN gerçekten yanlış/uyumsuz bir anahtarla decrypt başarısız olursa kayıt SİLİNİR (regresyon değil)", async () => {
    // Bu test, düzeltmenin AŞIRIYA kaçmadığını (yani artık "hiçbir zaman
    // silme" davranışına dönüşmediğini) doğrular — gerçek bir decrypt
    // hatasında eski davranış (temizle + default dön) korunmalı.
    const rightKey = await generateSessionKey();
    const wrongKey = await generateSessionKey();
    const encrypted = await encryptValue(rightKey, { apiKey: "sk_live_should_be_wiped" });
    mockStorage.setItem(STORAGE_PREFIX + "okx_prod_wrongkey", encrypted);

    // cryptoKey DI ile "kilit açık ama anahtar yanlış" senaryosu simüle
    // ediliyor — isUnlocked() kontrolünü bilerek atlıyor (DI böyle
    // tasarlandı), yani gerçek bir decrypt denemesine giriyor.
    const loaded = await loadSecure("okx_prod_wrongkey", null, { cryptoKey: wrongKey });
    expect(loaded).toBeNull();
    expect(mockStorage.getItem(STORAGE_PREFIX + "okx_prod_wrongkey")).toBeNull(); // silindi
  });

  it("ilk unlock() — yeni PIN kurulumu, isNewSetup:true", async () => {
    const result = await unlock("1234");
    expect(result.ok).toBe(true);
    expect(result.isNewSetup).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it("unlock() sonrası kilit açıkken saveSecure/loadSecure çalışır (cryptoKey vermeden)", async () => {
    await unlock("1234");
    const saved = await saveSecure("pin_protected", { secret: "gizli" });
    expect(saved).toBe(true);

    const loaded = await loadSecure("pin_protected", null);
    expect(loaded).toEqual({ secret: "gizli" });
  });

  it("doğru PIN ile ikinci unlock() — isNewSetup:false, ok:true", async () => {
    await unlock("1234");
    lock();
    expect(isUnlocked()).toBe(false);

    const result = await unlock("1234");
    expect(result.ok).toBe(true);
    expect(result.isNewSetup).toBe(false);
    expect(isUnlocked()).toBe(true);
  });

  it("yanlış PIN ile unlock() — ok:false, kilit açılmaz", async () => {
    await unlock("1234");
    lock();

    const result = await unlock("9999");
    expect(result.ok).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it("lock() sonrası bellekteki anahtar silinir — tekrar LOCKED hatası", async () => {
    await unlock("1234");
    lock();
    await expect(getOrCreateSessionKey()).rejects.toThrow(/LOCKED/);
  });

  it("doğru PIN ile unlock sonrası önceki oturumda kaydedilen veri okunabilir", async () => {
    await unlock("my-secret-pin");
    await saveSecure("cross_session", { balance: 42 });
    lock();

    // Yeni "oturum" — aynı PIN ile tekrar unlock
    const unlockResult = await unlock("my-secret-pin");
    expect(unlockResult.ok).toBe(true);

    const loaded = await loadSecure("cross_session", null);
    expect(loaded).toEqual({ balance: 42 });
  });

  it("yanlış PIN ile eski veriye erişilemez (graceful — çökmez, default döner)", async () => {
    await unlock("correct-pin");
    await saveSecure("wrong_pin_test", { secret: "hidden" });
    lock();

    await unlock("wrong-pin"); // ok:false, kilit AÇILMAZ (yanlış PIN)
    expect(isUnlocked()).toBe(false);

    const loaded = await loadSecure("wrong_pin_test", "FALLBACK");
    expect(loaded).toBe("FALLBACK");
  });

  it("hasPinConfigured() — PIN kurulmadan false, kurulduktan sonra true", async () => {
    expect(hasPinConfigured()).toBe(false);
    await unlock("1234");
    expect(hasPinConfigured()).toBe(true);
  });

  it("eski (localStorage-anahtar modeli) verisi yeni PIN modelinde okunamaz — sessizce silinir", async () => {
    // Eski model simülasyonu: rastgele bir anahtarla (PIN'den TÜRETİLMEMİŞ)
    // doğrudan şifrele — artık hiçbir PIN bu anahtarı türetemez.
    const legacyKey = await generateSessionKey();
    const legacyEncrypted = await encryptValue(legacyKey, { legacyBalance: 999 });
    mockStorage.setItem(STORAGE_PREFIX + "legacy_key_data", legacyEncrypted);

    await unlock("new-pin-1234"); // yeni model devreye girer
    const loaded = await loadSecure("legacy_key_data", { legacyBalance: 0 });
    expect(loaded).toEqual({ legacyBalance: 0 }); // eski veri okunamaz, default'a düşer
    expect(mockStorage.getItem(STORAGE_PREFIX + "legacy_key_data")).toBeNull(); // temizlendi
  });
});

describe("Gerçek store veri yapıları", () => {
  it("account state (bakiye + drawdown) şifreli saklanır", async () => {
    const key = await generateSessionKey();
    const accountState = {
      balanceTotal: 87654.32,
      balanceFree: 54321.0,
      dailyPnlPct: -2.3,
      weeklyPnlPct: -5.1,
      monthlyPnlPct: -8.7,
    };
    await saveSecure("account_state", accountState, { cryptoKey: key });

    const raw = mockStorage.getItem(STORAGE_PREFIX + "account_state")!;
    // Düz metin içermiyor
    expect(raw).not.toContain("87654");
    expect(raw).not.toContain("balanceTotal");
    expect(raw).not.toContain("-5.1");

    // Doğru veri geri gelir
    const loaded = await loadSecure("account_state", {}, { cryptoKey: key });
    expect(loaded).toEqual(accountState);
  });

  it("trade snapshot listesi şifreli saklanır", async () => {
    const key = await generateSessionKey();
    const trades = [
      {
        id: "t-001", pair: "BTC", direction: "LONG",
        entryPrice: 95000, qty: 0.5, slPrice: 93000,
        riskAmountUsd: 1000,
      },
      {
        id: "t-002", pair: "ETH", direction: "SHORT",
        entryPrice: 3200, qty: 5, slPrice: 3280,
        riskAmountUsd: 400,
      },
    ];
    await saveSecure("trade_snapshots", trades, { cryptoKey: key });

    const raw = mockStorage.getItem(STORAGE_PREFIX + "trade_snapshots")!;
    expect(raw).not.toContain("95000");
    expect(raw).not.toContain("slPrice");
    expect(raw).not.toContain("t-001");

    const loaded = await loadSecure("trade_snapshots", [], { cryptoKey: key }) as typeof trades;
    expect(loaded[0].entryPrice).toBe(95000);
    expect(loaded[1].direction).toBe("SHORT");
  });

  it("risk state (cooldown + lock) şifreli saklanır", async () => {
    const key = await generateSessionKey();
    const riskState = {
      btcCooldownUntil: Date.now() + 3_600_000,
      btcCooldownReason: "SL_HIT",
      lockReleasedAt: Date.now() - 86_400_000,
    };
    await saveSecure("btccd", riskState, { cryptoKey: key });

    const raw = mockStorage.getItem(STORAGE_PREFIX + "btccd")!;
    expect(raw).not.toContain("SL_HIT");
    expect(raw).not.toContain("btcCooldownReason");

    const loaded = await loadSecure("btccd", {}, { cryptoKey: key });
    expect(loaded).toEqual(riskState);
  });
});
