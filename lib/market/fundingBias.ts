/**
 * FUNDING BIAS — funding rate'in yön-agnostik ham sınıflandırması.
 *
 * lib/score/scorers.ts'teki scoreFunding() ile AYNI nötr bant sınırını
 * (±0.02%) kullanır, ama scoreFunding YÖN-BAĞIMLI (LONG/SHORT'a göre
 * contrarian/crowded ayırır ve skora girer) — bu fonksiyon tamamen
 * bağımsız, sadece piyasanın ham funding eğilimini söyler, skor motoruna
 * hiç girmez. scoreFunding'e dokunulmadı.
 */

export type FundingBias = "bullish" | "bearish" | "neutral";

const NEUTRAL_BAND_PCT = 0.02;

/**
 * @param fundingRate Decimal — 0.0001 = 0.01% (OKX per-8h format,
 *   FundingRateResult.fundingRate ile aynı birim).
 */
export function classifyFundingBias(fundingRate: number): FundingBias {
  const pct = fundingRate * 100;
  if (pct > NEUTRAL_BAND_PCT) return "bullish";
  if (pct < -NEUTRAL_BAND_PCT) return "bearish";
  return "neutral";
}
