/**
 * OI SNAPSHOT CACHE — trim & yaş sınırı doğrulama testleri.
 *
 * Bağlam: Phase 1.0 (OI Runtime Verification) sonrası dış değerlendirme
 * "JSONB'nin sınırsız büyümeyeceğinden emin ol, trim test edildiğinden
 * emin ol" dedi — appendOiAndGetVelocity()'nin OI_SNAP_MAX (10) ve
 * OI_SNAP_MAX_AGE_MS (2 saat) sınırlarını GERÇEKTEN uyguladığı, kod
 * okumayla değil çalıştırarak doğrulanıyor. Network/Supabase mock'una
 * gerek yok — appendOiAndGetVelocity saf bir fonksiyon, kendisine
 * verilen Map üzerinde çalışıyor.
 */

import { describe, it, expect } from "vitest";
import { appendOiAndGetVelocity } from "@/lib/server/signalEngine";
import type { OiSnapshot } from "@/lib/market/oi-velocity";

const HOUR_MS = 60 * 60_000;

describe("appendOiAndGetVelocity — adet sınırı (OI_SNAP_MAX=10)", () => {
  it("15 ardışık çağrıdan sonra cache 10 snapshot'ı geçmiyor", () => {
    const cache = new Map<string, OiSnapshot[]>();
    const baseTs = Date.now();

    for (let i = 0; i < 15; i++) {
      appendOiAndGetVelocity(
        "BTC" as never,
        { oi: 1000 + i, oiCcy: 0 },
        50000 + i,
        baseTs + i * 1000, // saniyeler arayla — yaş sınırına takılmasın
        cache,
      );
    }

    const stored = cache.get("BTC")!;
    expect(stored.length).toBe(10);
    // En son eklenenler kalmalı (FIFO trim — en eskiler atılmalı)
    expect(stored[stored.length - 1].openInterest).toBe(1000 + 14);
    expect(stored[0].openInterest).toBe(1000 + 5); // ilk 5'i (0-4) atılmış olmalı
  });

  it("snapshotCount dönüş değeri de aynı sınırı yansıtıyor", () => {
    const cache = new Map<string, OiSnapshot[]>();
    const baseTs = Date.now();
    let lastResult;
    for (let i = 0; i < 12; i++) {
      lastResult = appendOiAndGetVelocity(
        "ETH" as never,
        { oi: 500, oiCcy: 0 },
        3000,
        baseTs + i * 1000,
        cache,
      );
    }
    expect(lastResult!.snapshotCount).toBe(10);
  });
});

describe("appendOiAndGetVelocity — yaş sınırı (OI_SNAP_MAX_AGE_MS=2 saat)", () => {
  it("2 saatten eski snapshot'lar yeni çağrıda elenir", () => {
    const cache = new Map<string, OiSnapshot[]>();
    const oldTs = Date.now();

    // İlk 3 snapshot "eski" zamanda
    for (let i = 0; i < 3; i++) {
      appendOiAndGetVelocity("SOL" as never, { oi: 100, oiCcy: 0 }, 200, oldTs + i, cache);
    }
    expect(cache.get("SOL")!.length).toBe(3);

    // 2 saat + 1dk sonra gelen yeni bir çağrı — eskiler yaş filtresine takılıp elenmeli
    const freshResult = appendOiAndGetVelocity(
      "SOL" as never,
      { oi: 999, oiCcy: 0 },
      210,
      oldTs + 2 * HOUR_MS + 60_000,
      cache,
    );

    // Sadece yeni eklenen kalmalı (eski 3'ü yaş filtresiyle düştü)
    expect(cache.get("SOL")!.length).toBe(1);
    expect(freshResult.snapshotCount).toBe(1);
    expect(cache.get("SOL")![0].openInterest).toBe(999);
  });

  it("2 saatten YENİ snapshot'lar elenmiyor (yanlış-pozitif trim yok)", () => {
    const cache = new Map<string, OiSnapshot[]>();
    const baseTs = Date.now();

    appendOiAndGetVelocity("XRP" as never, { oi: 100, oiCcy: 0 }, 1, baseTs, cache);
    // 1 saat 59 dk sonra — hâlâ pencere içinde, düşmemeli
    const result = appendOiAndGetVelocity(
      "XRP" as never,
      { oi: 110, oiCcy: 0 },
      1.1,
      baseTs + (2 * HOUR_MS - 60_000),
      cache,
    );
    expect(result.snapshotCount).toBe(2);
  });
});

describe("appendOiAndGetVelocity — geçersiz girdi", () => {
  it("oiResult null ise cache değişmez, score 0 döner", () => {
    const cache = new Map<string, OiSnapshot[]>();
    const result = appendOiAndGetVelocity("BTC" as never, null, 50000, Date.now(), cache);
    expect(result.score).toBe(0);
    expect(result.result).toBeNull();
    expect(cache.has("BTC")).toBe(false);
  });

  it("price<=0 ise cache değişmez", () => {
    const cache = new Map<string, OiSnapshot[]>();
    const result = appendOiAndGetVelocity("BTC" as never, { oi: 100, oiCcy: 0 }, 0, Date.now(), cache);
    expect(result.snapshotCount).toBe(0);
    expect(cache.has("BTC")).toBe(false);
  });
});
