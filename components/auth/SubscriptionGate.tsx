"use client";

import { useUser } from "@clerk/nextjs";
import { hasFeature } from "@/lib/auth/subscription";
import { UpgradePrompt } from "./UpgradePrompt";
import type { FeatureKey } from "@/lib/auth/subscription";

interface Props {
  feature: FeatureKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function SubscriptionGate({ feature, fallback, children }: Props): React.ReactElement {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <></>;

  if (!hasFeature(user, feature)) {
    return <>{fallback ?? <UpgradePrompt feature={feature} />}</>;
  }

  return <>{children}</>;
}
