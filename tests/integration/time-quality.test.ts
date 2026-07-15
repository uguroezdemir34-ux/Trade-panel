/**
 * TIME QUALITY — checkTimeQuality (Zaman Koruma Filtresi) aktivasyonu.
 *
 * Kapsam (henüz commit edilmedi — lib/score/blocks.ts ve lib/score/orchestrator.ts'e
 * dokunuyor, Rule 0 kapsamında, ayrı açık onay bekliyor):
 *   - computeTimeQuality() (lib/market/timeQuality.ts) — saf fonksiyon, mock'suz,
 *     hafta sonu + ölü saatler için farklı mock zaman dilimleriyle sınır testleri.
 *   - checkTimeQuality() (lib/score/blocks.ts) entegrasyonu — computeTimeQuality()
 *     çıktısının doğru şekilde hard-block'a dönüştüğünü doğrular.
 *
 * NOT: Sandbox'ta node_modules yok, bu dosya çalıştırılarak doğrulanamadı — kod
 * okuma ile doğrulandı (CLAUDE.md §Ortam Notları'ndaki kabul edilen kısıt).
 */

import { describe, it, expect } from "vitest";
import { computeTimeQuality } from "@/lib/market/timeQuality";
import { checkTimeQuality } from "@/lib/score/blocks";

/** UTC epoch ms üretici — yıl/ay/gün/saat/dakika UTC olarak verilir. */
function utc(y: number, m: number, d: number, h: number, min = 0): number {
  return Date.UTC(y, m - 1, d, h, min, 0);
}

describe("computeTimeQuality()", () => {
  // 2026-07-18 Cumartesi, 2026-07-19 Pazar, 2026-07-20 Pazartesi (UTC).
  it("Cumartesi 17:59 UTC → hafta sonu koruması henüz BAŞLAMADI, quality=1", () => {
    const r = computeTimeQuality(utc(2026, 7, 18, 17, 59));
    expect(r.quality).toBe(1);
  });

  it("Cumartesi 18:00 UTC (tam sınır) → hafta sonu koruması BAŞLAR, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 18, 18, 0));
    expect(r.quality).toBe(0);
    expect(r.reason).toBe("Hafta sonu düşük hacim koruması");
  });

  it("Cumartesi 23:59 UTC → hafta sonu koruması devam ediyor, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 18, 23, 59));
    expect(r.quality).toBe(0);
  });

  it("Pazar 00:00 UTC → hafta sonu koruması devam ediyor, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 19, 0, 0));
    expect(r.quality).toBe(0);
    expect(r.reason).toBe("Hafta sonu düşük hacim koruması");
  });

  it("Pazar 12:00 UTC (gün ortası) → hafta sonu koruması devam ediyor, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 19, 12, 0));
    expect(r.quality).toBe(0);
  });

  it("Pazar 23:59 UTC → hafta sonu koruması SON anına kadar devam, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 19, 23, 59));
    expect(r.quality).toBe(0);
  });

  it("Pazartesi 00:00 UTC (tam sınır) → hafta sonu koruması BİTER, quality=1", () => {
    const r = computeTimeQuality(utc(2026, 7, 20, 0, 0));
    expect(r.quality).toBe(1);
  });

  it("Pazartesi 00:59 UTC → ölü saatler henüz başlamadı, quality=1", () => {
    const r = computeTimeQuality(utc(2026, 7, 20, 0, 59));
    expect(r.quality).toBe(1);
  });

  it("Pazartesi 01:00 UTC (tam sınır) → ölü saatler BAŞLAR, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 20, 1, 0));
    expect(r.quality).toBe(0);
    expect(r.reason).toBe("Asya seansı ölü saatler koruması");
  });

  it("Pazartesi 04:59 UTC → ölü saatler devam ediyor, quality=0", () => {
    const r = computeTimeQuality(utc(2026, 7, 20, 4, 59));
    expect(r.quality).toBe(0);
  });

  it("Pazartesi 05:00 UTC (tam sınır) → ölü saatler BİTER, quality=1", () => {
    const r = computeTimeQuality(utc(2026, 7, 20, 5, 0));
    expect(r.quality).toBe(1);
  });

  it("Salı 13:00 UTC (normal işlem saati) → quality=1", () => {
    const r = computeTimeQuality(utc(2026, 7, 21, 13, 0));
    expect(r.quality).toBe(1);
    expect(r.reason).toBe("");
  });

  it("her hafta içi gün (Pzt-Cuma) 01:00-05:00 UTC aralığında bloklanır — Çarşamba örneği", () => {
    const r = computeTimeQuality(utc(2026, 7, 22, 2, 30)); // 2026-07-22 = Çarşamba
    expect(r.quality).toBe(0);
    expect(r.reason).toBe("Asya seansı ölü saatler koruması");
  });

  it("Date instance da kabul edilir (number'a ek olarak)", () => {
    const r = computeTimeQuality(new Date(utc(2026, 7, 19, 10, 0))); // Pazar
    expect(r.quality).toBe(0);
  });

  it("Cuma 23:00 UTC → hafta sonu koruması henüz başlamadı (Cumartesi 18:00'i bekliyor), quality=1", () => {
    const r = computeTimeQuality(utc(2026, 7, 17, 23, 0)); // 2026-07-17 = Cuma
    expect(r.quality).toBe(1);
  });
});

describe("checkTimeQuality() — computeTimeQuality() entegrasyonu", () => {
  it("hafta sonu → hard block reason'ı computeTimeQuality'nin reason'ıyla birebir", () => {
    const tq = computeTimeQuality(utc(2026, 7, 19, 10, 0)); // Pazar
    const block = checkTimeQuality(tq);
    expect(block).toBe("Hafta sonu düşük hacim koruması");
  });

  it("ölü saatler → hard block reason'ı computeTimeQuality'nin reason'ıyla birebir", () => {
    const tq = computeTimeQuality(utc(2026, 7, 20, 3, 0)); // Pazartesi 03:00
    const block = checkTimeQuality(tq);
    expect(block).toBe("Asya seansı ölü saatler koruması");
  });

  it("normal saat → block yok (null)", () => {
    const tq = computeTimeQuality(utc(2026, 7, 21, 13, 0)); // Salı 13:00
    const block = checkTimeQuality(tq);
    expect(block).toBeNull();
  });
});
