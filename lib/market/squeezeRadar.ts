import { atrPercentile } from "@/lib/indicators/atr-percentile";
import { toIndicatorCandle, type Candle } from "@/lib/okx/candles";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

/**
 * SQUEEZE RADAR — volatilite sıkışması gösteren coinleri listeler.
 *
 * Yeni bir indikatör GEREKMEDİ: `lib/indicators/atr-percentile.ts`'teki
 * `atrPercentile()` zaten "compression" rejimini (percentile < 20)
 * hesaplıyor — composeScoreInput bunu her score cycle'ında 24 pair için
 * zaten çağırıyor. Bu modül AYNI saf fonksiyonu, candleStore'daki 1h
 * mumlar üzerinde BAĞIMSIZ olarak tekrar çağırıyor.
 *
 * Bilinçli tercih: hesaplamayı useScoreEngine ile paylaşmak/coupling
 * yaratmak yerine (ki bu "sıfır dokunma" garantisini belirsizleştirirdi)
 * ucuz bir hesaplamayı iki kez yapmak — composeScoreInput'a, orchestrator'a,
 * useScoreEngine'e hiç dokunulmadı.
 *
 * Saf fonksiyon — I/O yok, candleStore'dan okunan veriyi parametre olarak alır.
 */

export interface SqueezeRadarEntry {
  pair: Pair;
  /** ATR percentile — düşük = daha sıkı sıkışma */
  percentile: number;
  /** current ATR / son 20 bar ortalaması */
  atrRatio: number;
  /**
   * Yön belirtmeden ölçülen volatilite büyüklüğü — ham ATR'nin (current)
   * son mumun kapanış fiyatına oranı, yüzde olarak. "Probability %" DEĞİL
   * (bunun için hiçbir backtest/istatistiksel temel yok, bilinçli olarak
   * eklenmedi) — bu gerçek, ölçülen bir değer, tahmin değil.
   */
  estimatedMovePct: number;
  /** Zaten percentile'a göre sıralı listedeki sıra (1 = en sıkı sıkışma). */
  priorityRank: number;
}

/**
 * @param candles1h "BTC_1h" gibi anahtarlarla candleStore.candles'tan
 *   gelen ham map — sadece `${pair}_1h` anahtarları okunur.
 */
export function computeSqueezeRadar(
  candles1h: Partial<Record<string, Candle[]>>,
): SqueezeRadarEntry[] {
  const out: SqueezeRadarEntry[] = [];

  for (const pair of PAIRS) {
    const candles = candles1h[`${pair}_1h`];
    if (!candles || candles.length === 0) continue;

    const result = atrPercentile(candles.map(toIndicatorCandle));
    if (!result || result.regime !== "compression") continue;

    const lastClose = candles[candles.length - 1].close;
    const estimatedMovePct = lastClose > 0 ? (result.current / lastClose) * 100 : 0;

    out.push({
      pair,
      percentile: result.percentile,
      atrRatio: result.atrRatio,
      estimatedMovePct,
      priorityRank: 0, // sort sonrası aşağıda dolduruluyor
    });
  }

  return out
    .sort((a, b) => a.percentile - b.percentile)
    .map((entry, i) => ({ ...entry, priorityRank: i + 1 }));
}
