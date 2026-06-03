/**
 * SUBSCRIPTION — Plan tier definitions and feature gates.
 *
 * Plan stored in Clerk publicMetadata: { plan: "free" | "pro" | "enterprise" }
 * Set via Clerk Dashboard or server-side API on purchase confirmation.
 */

export type PlanTier = "free" | "pro" | "enterprise";

export interface ClerkUserLike {
  publicMetadata?: Record<string, unknown>;
}

export function getPlanTier(user: ClerkUserLike | null | undefined): PlanTier {
  if (!user) return "free";
  const plan = user.publicMetadata?.plan;
  if (plan === "enterprise") return "enterprise";
  if (plan === "pro") return "pro";
  return "free";
}

export const PLAN_FEATURES = {
  free: {
    scoring: true,
    chart: true,
    market: true,
    backtest: false,
    pnlAnalytics: false,
    telegramSignals: false,
    scorerWeights: false,
    riskAdvanced: false,
    maxPairs: 3,
  },
  pro: {
    scoring: true,
    chart: true,
    market: true,
    backtest: true,
    pnlAnalytics: true,
    telegramSignals: true,
    scorerWeights: true,
    riskAdvanced: true,
    maxPairs: 15,
  },
  enterprise: {
    scoring: true,
    chart: true,
    market: true,
    backtest: true,
    pnlAnalytics: true,
    telegramSignals: true,
    scorerWeights: true,
    riskAdvanced: true,
    maxPairs: -1,
  },
} as const satisfies Record<PlanTier, Record<string, boolean | number>>;

export type FeatureKey = keyof (typeof PLAN_FEATURES)["free"];

export function hasFeature(user: ClerkUserLike | null | undefined, feature: FeatureKey): boolean {
  const tier = getPlanTier(user);
  const val = PLAN_FEATURES[tier][feature];
  return typeof val === "boolean" ? val : val > 0;
}
