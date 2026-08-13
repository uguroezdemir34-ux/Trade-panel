/**
 * SIGNAL CHART VERİSİ — GO sinyali grafiği için TAZE (gönderim anındaki)
 * mum + S/R + trend çizgisi verisini hazırlar.
 *
 * ÜÇÜNCÜ bir OKX-fetch kopyası YAZILMADI — lib/analysis/ai-scenario.ts'teki
 * (zaten kanıtlanmış, AI Senaryo cron'unda kullanılan) fetchScenarioData()
 * DOĞRUDAN import edilip kullanılıyor: 4H+1H mum çeker, detectSRLevels()
 * çalıştırır. direction="NEUTRAL" ile çağrılmış olması sorun DEĞİL —
 * detectSRLevels()'in levels.nearest_resistance/nearest_support hesabı
 * direction'dan BAĞIMSIZ (sadece `modifier` direction-aware, biz modifier'ı
 * hiç kullanmıyoruz — bkz. lib/sr/detect.ts, resistances/supports listesi
 * modifier hesabından ÖNCE tamamlanıyor).
 *
 * trendLine BURADA, k4h ÜZERİNDEN hesaplanıyor — renderSignalChart.ts'e
 * geçirilecek candles ile AYNI dizi, aynı sıra (idx tutarlılığı zorunlu,
 * bkz. SignalChartData.candles dosya başı yorumu).
 *
 * Neden client'ın gönderdiği candles/humanCheck DEĞİL: NotifyMessage
 * client→server'a JSON ile taşınıyor, 40-50 mumluk bir diziyi her sinyalde
 * tekrar taşımak payload'ı gereksiz büyütürdü; bunun yerine route.ts
 * gönderim anında TAZE veri çekiyor (AI Senaryo cron'unun kendi deseniyle
 * aynı felsefe — kendi kendine yeten, bağımsız bir render-zamanı görüntüsü).
 */

import { fetchScenarioData } from "@/lib/analysis/ai-scenario";
import { detectTrendLine, type TrendLineResult } from "@/lib/sr/trendLines";
import type { SrLevels } from "@/lib/sr/detect";
import type { Candle } from "@/types/candle";
import type { Pair } from "@/lib/constants/pairs";

export interface SignalChartMarketData {
  /** k4h — renderSignalChart.ts'e AYNEN geçirilmeli (trendLine.p1/p2'nin
   *  idx'i bu diziye göre). */
  candles: Candle[];
  srLevels: SrLevels;
  currentPrice: number;
  trendLine: TrendLineResult | null;
}

/**
 * @returns fetchScenarioData() null dönerse (fetch başarısız/veri yetersiz)
 *   null — çağıran (route.ts) best-effort metin-only'ye düşmeli.
 */
export async function fetchSignalChartData(
  pair: Pair,
  direction: "LONG" | "SHORT",
): Promise<SignalChartMarketData | null> {
  const scenario = await fetchScenarioData(pair);
  if (!scenario) return null;

  const trendLine = detectTrendLine(scenario.k4h, direction);

  return {
    candles: scenario.k4h,
    srLevels: scenario.srLevels,
    currentPrice: scenario.currentPrice,
    trendLine,
  };
}
