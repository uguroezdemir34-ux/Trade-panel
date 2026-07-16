"use client";

import { useState } from "react";
import { useUserStub } from "@/lib/auth/stubs";
import { useT } from "@/lib/i18n/context";
import { getPlanTier } from "@/lib/auth/subscription";

const TIER_COLORS: Record<string, string> = {
  free: "text-text-t3",
  pro: "text-brand",
  enterprise: "text-amber-400",
};

const TIER_BG: Record<string, string> = {
  free: "bg-surface-s1 border-border",
  pro: "bg-brand/5 border-brand/30",
  enterprise: "bg-amber-400/5 border-amber-400/30",
};

export function PlanStatusCard(): React.ReactElement {
  const t = useT();
  const { user, isLoaded } = useUserStub();
  const tier = getPlanTier(user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) return <></>;

  async function handleManageBilling() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        // stripeCustomerId yoksa (404) — abonelik Dashboard'dan elle açılmış
        // olabilir, self-servis portal mevcut değil, upgrade sayfasına düş.
        window.location.href = "/upgrade";
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal açılamadı");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={`rounded-lg border p-4 flex items-center justify-between gap-3 ${TIER_BG[tier]}`}>
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-xs text-text-t4 tracking-wider uppercase">
            {t("auth.planStatus.title")}
          </p>
          <p className={`font-mono text-base font-semibold tracking-widest ${TIER_COLORS[tier]}`}>
            {t(`auth.plan.${tier}` as Parameters<typeof t>[0])}
          </p>
        </div>

        {tier === "free" && (
          <a
            href="/upgrade"
            className="shrink-0 rounded bg-brand px-3 py-2 font-mono text-xs text-white tracking-widest hover:bg-brand/90 transition-colors"
          >
            {t("auth.planStatus.upgradeBtn")}
          </a>
        )}

        {tier === "pro" && (
          <button
            type="button"
            onClick={handleManageBilling}
            disabled={loading}
            className="shrink-0 rounded border border-border font-mono text-xs text-text-t3 px-3 py-2 hover:text-text-t2 transition-colors disabled:opacity-50"
          >
            {t("auth.planStatus.manageBilling")}
          </button>
        )}
      </div>

      {error && (
        <p className="font-mono text-2xs text-red-400 px-1">{error}</p>
      )}
    </div>
  );
}
