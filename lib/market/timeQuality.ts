/**
 * TIME QUALITY — Zaman bazlı likidite koruması (saf, stateless fonksiyon).
 *
 * Kurallar (kullanıcı tarafından netleştirildi — panelin orijinal 02:00-06:00 UTC
 * "ölü saatler" + Cumartesi 18:00 UTC'den itibaren hafta sonu kuralından ve
 * Next.js migrasyonunda eklenmiş shadow-only timeGate'ten (00:00-04:00 UTC Asya +
 * 12:00 UTC Londra→NY geçişi) FARKLI, birleştirilmiş/basitleştirilmiş YENİ tanım —
 * bkz. lib/score/orchestrator.ts diff özeti, eski shadow timeGate kaldırıldı):
 *
 *   - Cumartesi 18:00 UTC – Pazar 23:59 UTC  → hafta sonu düşük hacim koruması
 *   - Her gün 01:00–05:00 UTC                → Asya seansı ölü saatler koruması
 *   - Diğer tüm durumlar                     → quality: 1 (koruma yok)
 *
 * Yalnızca `now`'ın (veya `bar.ts`/`latest.ts`'in) saat/gün bileşenine bakar —
 * hiçbir canlı market verisine bağımlı değil, bu yüzden browser/backtest/
 * server-cron'da BİREBİR aynı şekilde, dış veri kaynağı gerekmeden çalışır.
 */

export interface TimeQualityResult {
  quality: 0 | 1;
  reason: string;
}

export function computeTimeQuality(now: number | Date): TimeQualityResult {
  const d = typeof now === "number" ? new Date(now) : now;
  const utcDay = d.getUTCDay(); // 0=Pazar, 6=Cumartesi
  const utcHour = d.getUTCHours();

  // Hafta sonu: Cumartesi 18:00 UTC'den Pazar günü sonuna (23:59 UTC) kadar.
  // utcDay===0 zaten Pazar'ın tamamını (00:00-23:59) kapsıyor, ayrı saat
  // kontrolüne gerek yok.
  if ((utcDay === 6 && utcHour >= 18) || utcDay === 0) {
    return { quality: 0, reason: "Hafta sonu düşük hacim koruması" };
  }

  // Ölü saatler: her gün 01:00-05:00 UTC (Asya seansı düşük likidite).
  if (utcHour >= 1 && utcHour < 5) {
    return { quality: 0, reason: "Asya seansı ölü saatler koruması" };
  }

  return { quality: 1, reason: "" };
}
