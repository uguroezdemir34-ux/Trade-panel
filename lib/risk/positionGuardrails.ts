/**
 * POSITION GUARDRAILS — pozisyon-ihlali TESPİTİ (engelleme değil, uyarı).
 *
 * Kaldıraç ve zorunlu-SL kontrolü — usePositionPoller'ın her fetch'inde
 * çalışır. "Borsaya gönderilen emri engelleme" DEĞİL: bu uygulamada bugün
 * borsaya gerçek emir gönderen bir kod yolu yok (lib/exchange/index.ts
 * `getAdapter()` koşulsuz throw ediyor — chat'te ayrıca araştırıldı,
 * ANALYSIS.md'de de belgeli). Bu yüzden koruma noktası "mevcut açık
 * pozisyonu tespit edip uyar" — kullanıcı zaten borsada açmış bir
 * pozisyonu, kural ihlal ediyorsa göz ardı edilemeyecek şekilde bildiriyor.
 *
 * SL VERİ KALİTESİ KISITI (kod okunarak doğrulandı, chat'te tartışıldı):
 * Position.slTriggerPx sadece OKX/Binance/Bybit'te GERÇEK algo-order
 * verisinden geliyor (lib/okx/positions.ts fetchAlgoMap, lib/binance/
 * positions.ts fetchBinanceAlgoMap, lib/bybit/positions.ts aynı desen).
 * Gate.io/KuCoin/MEXC/Kraken'de bu alan HER ZAMAN null (o borsaların
 * fetcher'ları hiç algo-order çekmiyor, kod böyle sabit) — gerçekten SL'i
 * olan bir kullanıcı bile null görürdü. Bu yüzden SL kontrolü SADECE
 * RELIABLE_SL_SOURCES'ta çalışır, diğer 4 borsada sessizce atlanır
 * (kullanıcı kararı: yanlış pozitif, hiç kontrol etmemekten daha kötü).
 *
 * Kaldıraç kontrolü TÜM borsalarda çalışır (leverage alanı hepsinde
 * gerçek veri, grep ile doğrulandı).
 */

import type { Position } from "@/lib/okx/positions";
import type { Pair } from "@/lib/constants/pairs";

/** İleride settingsStore'a taşınabilir (kullanıcı-ayarlanabilir) — şimdilik
 *  sabit, kullanıcı kararı: tam ayarlar UI'ı bu görevin kapsamına göre
 *  orantısız büyük olurdu. */
export const DEFAULT_MAX_LEVERAGE = 10;
export const REQUIRE_STOP_LOSS = true;

/** Position.slTriggerPx'in GERÇEK (algo-order'dan merge edilmiş) olduğu borsalar. */
const RELIABLE_SL_SOURCES: ReadonlySet<Position["source"]> = new Set([
  "okx",
  "binance",
  "bybit",
]);

export type ViolationKind = "leverage" | "missing_sl";

export interface PositionViolation {
  /** Dedup/tekillik anahtarı — pair_direction_cTime_kind (adoptNewPositions'taki
   *  positionKey deseniyle aynı kökten, kind soneki eklenir çünkü tek bir
   *  pozisyon HEM kaldıraç HEM SL ihlali edebilir, iki ayrı satır gerekir). */
  key: string;
  kind: ViolationKind;
  pair: Pair;
  direction: "LONG" | "SHORT";
  leverage: number;
  maxLeverage?: number;
  message: string;
}

function positionKeyBase(p: Position): string {
  return `${p.pair}_${p.direction}_${p.cTime}`;
}

export interface GuardrailOptions {
  maxLeverage?: number;
  requireStopLoss?: boolean;
}

export function checkPositionGuardrails(
  positions: readonly Position[],
  opts: GuardrailOptions = {},
): PositionViolation[] {
  const maxLeverage = opts.maxLeverage ?? DEFAULT_MAX_LEVERAGE;
  const requireStopLoss = opts.requireStopLoss ?? REQUIRE_STOP_LOSS;
  const violations: PositionViolation[] = [];

  for (const p of positions) {
    if (p.direction !== "LONG" && p.direction !== "SHORT") continue;
    const base = positionKeyBase(p);

    if (p.leverage > maxLeverage) {
      violations.push({
        key: `${base}_leverage`,
        kind: "leverage",
        pair: p.pair,
        direction: p.direction,
        leverage: p.leverage,
        maxLeverage,
        message: `${p.pair} ${p.direction}: kaldıraç ${p.leverage}x, izin verilen max ${maxLeverage}x`,
      });
    }

    if (
      requireStopLoss &&
      RELIABLE_SL_SOURCES.has(p.source) &&
      p.slTriggerPx === null
    ) {
      violations.push({
        key: `${base}_missing_sl`,
        kind: "missing_sl",
        pair: p.pair,
        direction: p.direction,
        leverage: p.leverage,
        message: `${p.pair} ${p.direction}: Stop-Loss tanımlı değil`,
      });
    }
  }

  return violations;
}
