/**
 * AI Senaryo cron'unun (vercel.json: "5 5,13,21 * * *" — UTC) bir sonraki
 * çalışma saatine kalan süre. UTC 05:05/13:05/21:05 = TSİ 08:05/16:05/00:05.
 *
 * Türkiye 2016'dan beri DST (yaz saati) uygulamıyor — sabit UTC+3. Bu
 * yüzden Intl.DateTimeFormat/timezone kütüphanesi gerekmiyor, offset
 * hardcode edilebilir.
 */

const TR_OFFSET_MS = 3 * 60 * 60_000;
const RUN_HOURS_TSI = [0, 8, 16] as const; // 00:05, 08:05, 16:05 TSİ
const RUN_MINUTE_TSI = 5;

export function getNextScenarioRun(now: Date): { hours: number; minutes: number } {
  // UTC timestamp'i +3sa kaydırıp UTC getter'larıyla okumak, "TSİ duvar
  // saati" alanlarını (yıl/ay/gün/saat) timezone kütüphanesi olmadan verir
  // — standart bir teknik, DST olmayan sabit-offset bölgeler için güvenli.
  const nowTsiMs = now.getTime() + TR_OFFSET_MS;
  const nowTsi = new Date(nowTsiMs);

  const candidates: number[] = [];
  for (const dayOffset of [0, 1]) {
    for (const h of RUN_HOURS_TSI) {
      candidates.push(
        Date.UTC(
          nowTsi.getUTCFullYear(),
          nowTsi.getUTCMonth(),
          nowTsi.getUTCDate() + dayOffset,
          h,
          RUN_MINUTE_TSI,
          0,
          0,
        ),
      );
    }
  }
  candidates.sort((a, b) => a - b);

  const nextTsiMs = candidates.find((c) => c > nowTsiMs);
  if (nextTsiMs === undefined) {
    // Matematiksel olarak imkansız (dayOffset 0/1 × 3 saat = 6 aday, en az
    // biri her zaman gelecekte olur) — ama sessizce yutmak yerine görünür
    // bir "bilinmiyor" değeri döndürüyoruz (CLAUDE.md §0.1 madde 3).
    return { hours: 0, minutes: 0 };
  }

  const diffMs = nextTsiMs - nowTsiMs;
  const totalMinutes = Math.floor(diffMs / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
