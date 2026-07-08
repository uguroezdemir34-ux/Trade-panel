import type { ScoreResult } from "@/lib/score/orchestrator";
import type { ScoreSnapshot } from "@/lib/store/scoreHistoryStore";
import { computeScoreVelocity } from "@/lib/score/velocity";

export type HoldExitLabel =
  | "max_hold"
  | "quick_profit"
  | "early_exit_warning"
  | "wait_no_signal";

export const HOLD_EXIT_LABEL_TEXT: Record<HoldExitLabel, string> = {
  max_hold: "Maksimum Taşı",
  quick_profit: "Hızlı Kar Al",
  early_exit_warning: "Erken Tahliye Uyarısı",
  wait_no_signal: "Bekle / Net Sinyal Yok",
};

const WINDOW_MIN = 15;
const VELOCITY_THRESHOLD = 5;
const TRENDING_REGIMES = new Set<ScoreResult["regime"]>(["trending_strong", "trending_weak"]);
const RANGING_REGIMES = new Set<ScoreResult["regime"]>(["ranging_meanrev", "mixed"]);

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
    RANGING_REGIMES.has(result.regime) &&
    velocity !== null &&
    Math.abs(velocity.delta) < VELOCITY_THRESHOLD
  ) {
    return "wait_no_signal";
  }

  // Satır 5 — hiçbiri eşleşmedi: belirsiz durumda etiket gösterme
  return null;
}
