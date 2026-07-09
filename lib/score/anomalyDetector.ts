import type { ScoreResult } from "@/lib/score/orchestrator";
import type { OiVelocityResult } from "@/lib/market/oi-velocity";
import type { OrderBookImbalanceResult } from "@/lib/market/orderbook-imbalance";

/**
 * ANOMALİ IŞIĞI — sadece bir güvenilirlik/görsel uyarı katmanı. Skor/GO
 * kararına asla girmez; yalnızca zaten hesaplanmış sonuçlardan (results[pair],
 * macroStore.oiVelocity[pair], orderBookStore.imbalance[pair]) saf türetme
 * yapar.
 *
 * FAZ 1 — OI-çöküş: skor yüksek/GO'ya yakınken açık pozisyonlarda ani ve
 * güçlü (extreme + negatif) bir daralma varsa, "puan yüksek ama akıllı para
 * çıkıyor olabilir" anlamına gelir.
 *
 * FAZ 2 — order book duvarı: skor yüksek/GO'ya yakınken, sinyal yönünün
 * karşısında ağır tek taraflı bir emir duvarı varsa (LONG sinyali + üstte
 * ağır satış duvarı, veya SHORT sinyali + altta ağır alış duvarı), bu
 * hareketi bloklayabilecek bir engel anlamına gelir.
 *
 * İki faz `computeAnomalyLight` içinde `anomaly_oi || anomaly_wall` olarak
 * birleşir — kart köşesinde tek bir uyarı ikonu.
 */

const NEAR_THRESHOLD_MARGIN = 10;

function isHighScore(result: ScoreResult): boolean {
  return (
    result.verdict === "go" ||
    result.score >= result.effectiveThreshold - NEAR_THRESHOLD_MARGIN
  );
}

export function computeOiCollapseAnomaly(
  result: ScoreResult | null | undefined,
  oiVelocity: OiVelocityResult | null | undefined,
): boolean {
  if (!result || !oiVelocity) return false;
  if (!isHighScore(result)) return false;

  return oiVelocity.magnitude === "extreme" && oiVelocity.oiVelocityScore < 0;
}

export function computeOrderBookWallAnomaly(
  result: ScoreResult | null | undefined,
  imbalance: OrderBookImbalanceResult | null | undefined,
): boolean {
  if (!result || !imbalance) return false;
  if (!isHighScore(result)) return false;
  if (imbalance.wallSide === "neutral") return false;

  // LONG sinyali ama üstte ağır satış duvarı → yükselişi bloklayabilir
  if (result.direction === "LONG" && imbalance.wallSide === "ask") return true;
  // SHORT sinyali ama altta ağır alış duvarı → düşüşü bloklayabilir
  if (result.direction === "SHORT" && imbalance.wallSide === "bid") return true;

  return false;
}

/** Kart köşesindeki tek "Anomali Işığı" ikonu için birleşik sinyal. */
export function computeAnomalyLight(
  result: ScoreResult | null | undefined,
  oiVelocity: OiVelocityResult | null | undefined,
  imbalance: OrderBookImbalanceResult | null | undefined,
): boolean {
  return (
    computeOiCollapseAnomaly(result, oiVelocity) ||
    computeOrderBookWallAnomaly(result, imbalance)
  );
}
