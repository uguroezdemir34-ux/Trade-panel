/**
 * SENTIMENT TREND — NewsFeedCTA'daki mini-grafiğin saf veri katmanı.
 * Son 24 saati, 1'er saatlik 24 bucket'a böler, her bucket için
 * net = positiveCount - negativeCount hesaplar (nötr habercikler sayıma
 * girmez, skoru etkilemez — PerformancePanel'deki "uydurma veri yok"
 * disiplinine paralel: yeterli veri yoksa çağıran taraf "—" gösterir,
 * burada rastgele/düz bir çizgi üretilmez).
 *
 * useMemo([items]) ile çağrılmalı — nowMs bir dependency DEĞİL, her
 * çağrıda Date.now() taze okunur. Bir önceki bug turunda ekonomik
 * takvimde bulunan hatayı (60sn'lik ayrı bir tick timer'ının gereksiz
 * yeniden hesaplama tetiklemesi) burada tekrarlamamak için bilinçli:
 * saatlik bucket'ların 20dk'lık poll cadence'inin (useNewsPoller) üstünde
 * zaten yeterli çözünürlüğü var, items her poll'da yeni referansla
 * geldiğinde otomatik tazeleniyor — ayrı bir zamanlayıcıya gerek yok.
 *
 * Saf fonksiyon — I/O yok, skor motoruna hiç dokunmaz.
 */

import type { NewsItem } from "./types";

export const SENTIMENT_TREND_HOURS = 24;
const BUCKET_MS = 3_600_000;

/**
 * En az kaç farklı bucket'ta pozitif/negatif sinyal olmalı ki "trend"
 * olarak gösterilsin — 1-2 habercik yanıltıcı bir çizgi üretebilir,
 * bu eşik altında çağıran taraf boş/yetersiz-veri durumunu gösterir.
 */
export const SENTIMENT_TREND_MIN_BUCKETS = 3;

export interface SentimentTrendBucket {
  /** Bucket başlangıcı, epoch ms */
  atMs: number;
  positive: number;
  negative: number;
  neutral: number;
  net: number;
}

/**
 * items'i son 24 saate, 1'er saatlik bucket'lara dağıtır. Bucket 0 en eski
 * (24 saat önce), bucket 23 en yeni (şimdiki saat) — soldan sağa
 * kronolojik render için.
 */
export function computeSentimentTrend(
  items: readonly NewsItem[],
  nowMs: number,
): SentimentTrendBucket[] {
  const buckets: SentimentTrendBucket[] = Array.from({ length: SENTIMENT_TREND_HOURS }, (_, i) => ({
    atMs: nowMs - (SENTIMENT_TREND_HOURS - i) * BUCKET_MS,
    positive: 0,
    negative: 0,
    neutral: 0,
    net: 0,
  }));

  for (const item of items) {
    const ageMs = nowMs - item.publishedAt;
    if (ageMs < 0 || ageMs >= SENTIMENT_TREND_HOURS * BUCKET_MS) continue;
    const hoursAgo = Math.floor(ageMs / BUCKET_MS); // 0 (bu saat) .. 23 (23 saat önce)
    const bucket = buckets[SENTIMENT_TREND_HOURS - 1 - hoursAgo];
    if (!bucket) continue;
    if (item.sentiment === "positive") bucket.positive += 1;
    else if (item.sentiment === "negative") bucket.negative += 1;
    else bucket.neutral += 1;
  }

  for (const bucket of buckets) bucket.net = bucket.positive - bucket.negative;
  return buckets;
}

/** Trend göstermeye değer yeterli veri var mı — bkz. SENTIMENT_TREND_MIN_BUCKETS. */
export function hasSufficientTrendData(buckets: readonly SentimentTrendBucket[]): boolean {
  const signalBuckets = buckets.filter((b) => b.positive > 0 || b.negative > 0).length;
  return signalBuckets >= SENTIMENT_TREND_MIN_BUCKETS;
}

export type SentimentTrendLabel = "bullish" | "bearish" | "neutral";

export interface SentimentTrendSummary {
  /** 24 saatlik penceredeki toplam haber (pozitif+negatif+nötr) — SOURCES */
  totalCount: number;
  /** 24 bucket'ın net değerlerinin toplamı, tam sayı — SCORE (ondalık hassasiyet iddia edilmez) */
  netSum: number;
  /** Kalibrasyon/eşik gerektirmez — sadece netSum'un işareti okunur */
  label: SentimentTrendLabel;
}

/**
 * SOURCES + SCORE özeti — kullanıcı onayıyla VOL kasıtlı olarak yok (gerçek
 * bir baseline, ör. son 7 günün ortalama saatlik hacmi, olmadan "High/Low"
 * etiketi fabrikasyon olurdu — ayrı bir iş, geçmiş veri saklama gerektirir).
 */
export function summarizeSentimentTrend(buckets: readonly SentimentTrendBucket[]): SentimentTrendSummary {
  let totalCount = 0;
  let netSum = 0;
  for (const bucket of buckets) {
    totalCount += bucket.positive + bucket.negative + bucket.neutral;
    netSum += bucket.net;
  }
  const label: SentimentTrendLabel = netSum > 0 ? "bullish" : netSum < 0 ? "bearish" : "neutral";
  return { totalCount, netSum, label };
}
