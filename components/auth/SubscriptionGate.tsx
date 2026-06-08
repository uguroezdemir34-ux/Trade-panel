"use client";

import type { FeatureKey } from "@/lib/auth/subscription";

interface Props {
  feature: FeatureKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// Clerk not configured — all features unlocked (single-user mode)
export function SubscriptionGate({ children }: Props): React.ReactElement {
  return <>{children}</>;
}
