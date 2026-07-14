import type { ScoreResult } from "@/lib/score/orchestrator";
import type { ScoreSnapshot } from "@/lib/store/scoreHistoryStore";
import { computeScoreVelocity } from "@/lib/score/velocity";

export type HoldExitLabel =
  | "max_hold"
  | "quick_profit"
  | "early_exit_warning"
  | "wait_no_signal";

/**
 * HoldExitLabel → i18n anahtarı (lib/i18n/*.ts `karar.*`). Görüntü metni
 * burada değil, çeviri sözlüklerinde — dil değişince otomatik güncellenir.
 */
export const HOLD_EXIT_LABEL_I18N_KEY: Record<HoldExitLabel, string> = {
  max_hold: "karar.holdExitMaxHold",
  quick_profit: "karar.holdExitQuickProfit",
  early_exit_warning: "karar.holdExitEarlyExitWarning",
  wait_no_signal: "karar.holdExitWaitNoSignal",
};

const WINDOW_MIN = 15;
const VELOCITY_THRESHOLD = 5;
const TRENDING_REGIMES = new Set<ScoreResult["regime"]>(["trending_strong", "trending_weak"]);
/** dirConfidence eşiği — "yön belirsiz" için. regime alanı baseScore<75'te hep
 *  "unknown" döndüğü için (scorers.ts scoreRegimeBonus), düşük skorlu paritelerde
 *  kullanılamıyor; dirConfidence/counterTrend ise skor seviyesinden bağımsız,
 *  her zaman dolu geliyor. */
const LOW_DIR_CONFIDENCE = 1;

/**
 * Saf türetme — results[pair] ve scoreHistory[pair]'den okur, skor motoruna
 * (useScoreEngine/computeScore) hiç dokunmaz, hiçbir şeye yazmaz.
 * Satır 1-5, onaylanan tabloyla birebir eşleşir.
 */
export function computeHoldExitGuide(
  result: ScoreResult | null | undefined,
  snaps: ScoreSnapshot[] | undefined,
): HoldExitLabel | null {
  if (!result) return null;
  const velocity = computeScoreVelocity(snaps, WINDOW_MIN);

  // Satır 1 — Maksimum Taşı
  if (
    result.verdict === "go" &&
    velocity !== null &&
    velocity.delta >= VELOCITY_THRESHOLD &&
    TRENDING_REGIMES.has(result.regime)
  ) {
    return "max_hold";
  }

  // Satır 2 — Hızlı Kar Al
  if (
    result.verdict === "go" &&
    velocity !== null &&
    velocity.delta <= -VELOCITY_THRESHOLD
  ) {
    return "quick_profit";
  }

  // Satır 3 — Erken Tahliye Uyarısı
  const recentlyWasGo = (snaps ?? []).slice(-3).some((s) => s.verdict === "go");
  if (
    recentlyWasGo &&
    result.verdict !== "go" &&
    result.score < result.effectiveThreshold &&
    velocity !== null &&
    velocity.delta < 0
  ) {
    return "early_exit_warning";
  }

  // Satır 4 — Bekle / Net Sinyal Yok
  if (
    (result.dirConfidence <= LOW_DIR_CONFIDENCE || result.counterTrend === true) &&
    velocity !== null &&
    Math.abs(velocity.delta) < VELOCITY_THRESHOLD
  ) {
    return "wait_no_signal";
  }

  // Satır 5 — hiçbiri eşleşmedi: belirsiz durumda etiket gösterme
  return null;
}
