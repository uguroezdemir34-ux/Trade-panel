import type { Candle } from "@/lib/okx/candles";

/**
 * MAE (Maximum Adverse Excursion) — trade açıkken ([openedAt, closedAt]
 * arası) yaşanan en kötü (en olumsuz) fiyat seviyesi.
 *
 * Real-time canlı tracking YOK (bilinçli — yeni bir polling/state
 * mekanizması gerektirirdi). Bunun yerine trade KAPANIŞ ANINDA,
 * candleStore'daki mevcut mumlar üzerinden RETROAKTİF hesaplanır —
 * lib/trades/ kapsamında, lib/score/*'a hiç dokunulmadı.
 *
 * Saf fonksiyon — I/O yok, mumları parametre olarak alır.
 */

export interface MaeResult {
  /** Trade açıkken görülen en kötü fiyat. */
  maePrice: number;
  /** USD cinsinden, her zaman <= 0 (olumsuz yönde, 0 = hiç aleyhe gitmedi). */
  maeUsd: number;
  /** Entry'e göre yüzde, her zaman <= 0. */
  maePct: number;
}

/**
 * @param candles Tek bir timeframe'in ham mum dizisi (candleStore'dan).
 * @param openedAt Trade açılış zamanı (epoch ms).
 * @param closedAt Trade kapanış zamanı (epoch ms).
 * @param entryPrice Giriş fiyatı.
 * @param qty Pozisyon büyüklüğü (coin cinsi).
 * @param direction LONG için en düşük low, SHORT için en yüksek high aranır.
 */
export function computeTradeMae(
  candles: readonly Candle[],
  openedAt: number,
  closedAt: number,
  entryPrice: number,
  qty: number,
  direction: "LONG" | "SHORT",
): MaeResult | null {
  const inRange = candles.filter((c) => c.ts >= openedAt && c.ts <= closedAt);
  if (inRange.length === 0) return null;

  const maePrice =
    direction === "LONG"
      ? Math.min(...inRange.map((c) => c.low))
      : Math.max(...inRange.map((c) => c.high));

  const sign = direction === "LONG" ? 1 : -1;
  const priceDelta = (maePrice - entryPrice) * sign; // negatifse aleyhe

  return {
    maePrice,
    maeUsd: Math.min(0, priceDelta * qty),
    maePct: entryPrice > 0 ? Math.min(0, priceDelta / entryPrice) : 0,
  };
}

/**
 * candleStore cache'inin [openedAt, closedAt] aralığını uçtan uca
 * kapsayıp kapsamadığını kontrol eder — kapsamıyorsa computeTradeMae()
 * eksik/yanıltıcı bir MAE üretebilir (aralığın bir kısmı mum listesinde
 * yok demektir), caller bu durumda MAE'yi hiç hesaplamamalı.
 */
export function candlesCoverRange(
  candles: readonly Candle[],
  openedAt: number,
  closedAt: number,
): boolean {
  if (candles.length === 0) return false;
  const first = candles[0];
  const last = candles[candles.length - 1];
  return first.ts <= openedAt && last.ts >= closedAt;
}
