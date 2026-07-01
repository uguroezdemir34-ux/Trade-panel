/**
 * OI DIVERGENCE — Fiyat yönü ile OI rejimi arasındaki uyum tespiti.
 *
 * Skor motoruna BAĞLI DEĞİL — sadece gözlem amaçlı.
 * GO/WAIT kararını etkilemez; karar sayfasında gösterge olarak kullanılır
 * ve GoSignalLog'a kaydedilir.
 *
 * Mantık:
 *   LONG + aggressive_long (px↑ OI↑) → confirm   (yeni long girişi, doğrular)
 *   LONG + long_unwind (px↑ OI↓)     → diverge   (long kapanıyor, zayıf)
 *   LONG + short_squeeze_risk (px↓ OI↑) → diverge (short birikim, kötü)
 *   LONG + bear_exhaustion (px↓ OI↓) → neutral   (short kapanıyor, dolaylı destek)
 *
 *   SHORT + short_squeeze_risk (px↓ OI↑) → confirm  (yeni short açılıyor)
 *   SHORT + bear_exhaustion (px↓ OI↓)    → diverge  (short kapanıyor, ivme kaybı)
 *   SHORT + aggressive_long (px↑ OI↑)    → diverge  (yeni long girişi, karşı)
 *   SHORT + long_unwind (px↑ OI↓)        → neutral  (long çıkıyor ama fiyat yukarı)
 *
 *   magnitude === "weak" → neutral (noise filtresi)
 */

import type { OiVelocityResult } from "@/lib/market/oi-velocity";

export type OiDivergence = "confirm" | "diverge" | "neutral";

/**
 * @param result  macroStore.oiVelocity[pair] — null ise "neutral"
 * @param direction  Sinyal yönü (LONG/SHORT/NEUTRAL)
 */
export function computeOiDivergence(
  result: OiVelocityResult | null,
  direction: "LONG" | "SHORT" | "NEUTRAL",
): OiDivergence {
  if (!result || direction === "NEUTRAL") return "neutral";
  if (result.magnitude === "weak") return "neutral";

  const { regime } = result;

  if (direction === "LONG") {
    if (regime === "aggressive_long") return "confirm";
    if (regime === "long_unwind" || regime === "short_squeeze_risk") return "diverge";
    return "neutral";
  }

  // SHORT
  if (regime === "short_squeeze_risk") return "confirm";
  if (regime === "aggressive_long" || regime === "bear_exhaustion") return "diverge";
  return "neutral";
}
