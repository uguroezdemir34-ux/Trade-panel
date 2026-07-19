/**
 * MAKRO EKONOMİK TAKVİM — statik/elle bakımlı liste (Faz 1, kullanıcı
 * onayıyla: canlı bir takvim API'si entegre edilmedi, çünkü Fed/CPI/NFP
 * tarihleri zaten aylar öncesinden resmi kaynaklarca (federalreserve.gov,
 * bls.gov) kamuya açık ve sabit — yeni bir API key/ücret/rate-limit riski
 * almaya değmez).
 *
 * Kaynaklar (WebSearch ile doğrulandı, 2026-07-19):
 * - FOMC 2026 tüm 8 toplantı: federalreserve.gov resmi takvimi (birincil
 *   kaynak, yüksek güven). Karar açıklaması saat 14:00 ET.
 * - CPI/NFP: bls.gov sayfaları bu sandbox'ta doğrudan fetch edilemedi
 *   (403 — dış ağ politikası), sadece WebSearch özetleriyle doğrulanan
 *   Ağustos-Eylül 2026 tarihleri eklendi. Ekim/Kasım/Aralık CPI+NFP
 *   tarihleri KASITLI OLARAK eklenmedi — "ilk Cuma" gibi bir kalıba göre
 *   tahmin ederek fabrike etmek yerine, bls.gov/schedule/news_release/
 *   sayfasından elle doğrulanıp eklenmeyi bekliyor (fail loudly, not
 *   silently wrong — Kraken entegrasyonundaki aynı prensip).
 *
 * Yeni etkinlik eklemek: aşağıdaki diziye bir obje ekle, atMs UTC epoch
 * ms olmalı (ET saatini UTC'ye çevirirken DST'ye dikkat: Mart-Kasım EDT
 * UTC-4, Kasım-Mart EST UTC-5).
 *
 * Saf veri + saf fonksiyon — I/O yok, skor motoruna hiç dokunmaz.
 */

export type CalendarCriticality = "critical" | "medium";
export type CalendarEventType = "fomc" | "cpi" | "nfp";

export interface EconomicCalendarEvent {
  id: string;
  /** Epoch ms, UTC */
  atMs: number;
  type: CalendarEventType;
  /** i18n key — etkinlik adı */
  nameKey: string;
  country: "US";
  criticality: CalendarCriticality;
}

export const ECONOMIC_CALENDAR_EVENTS: readonly EconomicCalendarEvent[] = [
  // FOMC — federalreserve.gov, tüm 2026 tarihleri resmi (karar açıklaması 14:00 ET)
  { id: "fomc-2026-01-28", atMs: Date.UTC(2026, 0, 28, 19, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-03-18", atMs: Date.UTC(2026, 2, 18, 18, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-04-29", atMs: Date.UTC(2026, 3, 29, 18, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-06-17", atMs: Date.UTC(2026, 5, 17, 18, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-07-29", atMs: Date.UTC(2026, 6, 29, 18, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-09-16", atMs: Date.UTC(2026, 8, 16, 18, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-10-28", atMs: Date.UTC(2026, 9, 28, 18, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },
  { id: "fomc-2026-12-09", atMs: Date.UTC(2026, 11, 9, 19, 0), type: "fomc", nameKey: "newsFeed.calendar.fomc", country: "US", criticality: "critical" },

  // NFP (Employment Situation) — bls.gov, 8:30 ET. Sadece doğrulanan tarihler.
  { id: "nfp-2026-08-07", atMs: Date.UTC(2026, 7, 7, 12, 30), type: "nfp", nameKey: "newsFeed.calendar.nfp", country: "US", criticality: "critical" },

  // CPI — bls.gov, 8:30 ET. Sadece doğrulanan tarihler.
  { id: "cpi-2026-08-12", atMs: Date.UTC(2026, 7, 12, 12, 30), type: "cpi", nameKey: "newsFeed.calendar.cpi", country: "US", criticality: "critical" },
  { id: "cpi-2026-09-11", atMs: Date.UTC(2026, 8, 11, 12, 30), type: "cpi", nameKey: "newsFeed.calendar.cpi", country: "US", criticality: "critical" },

  // TODO (elle doğrulanıp eklenecek): NFP Eylül/Ekim/Kasım/Aralık 2026,
  // CPI Ekim/Kasım/Aralık 2026 — bls.gov/schedule/news_release/{cpi,empsit}.htm
];

/** Geçmişte kalanları eler, en yakından en uzağa sıralar. */
export function getUpcomingCalendarEvents(
  nowMs: number,
  events: readonly EconomicCalendarEvent[] = ECONOMIC_CALENDAR_EVENTS,
): EconomicCalendarEvent[] {
  return events.filter((e) => e.atMs > nowMs).sort((a, b) => a.atMs - b.atMs);
}
