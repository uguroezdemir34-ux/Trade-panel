"use client";

import { useState, useEffect, Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { getPlanTier } from "@/lib/auth/subscription";

// Set this in your Vercel env vars
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "";

type FeatureRow = {
  labelKey: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
};

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <span className="text-green-400 font-mono text-sm">✓</span>;
  if (value === false) return <span className="text-text-t4 font-mono text-sm">—</span>;
  return <span className="text-text-t2 font-mono text-xs">{value}</span>;
}

function UpgradePageInner() {
  const t = useT();
  const { user, isLoaded } = useUser();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = params.get("success") === "true";
  const canceled = params.get("canceled") === "true";
  const currentTier = getPlanTier(user);

  // Reload once after successful payment so Clerk refreshes metadata
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => window.location.reload(), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function handleCheckout() {
    if (!PRO_PRICE_ID) {
      setError("Stripe price ID not configured. Set NEXT_PUBLIC_STRIPE_PRO_PRICE_ID.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: PRO_PRICE_ID }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  const features: FeatureRow[] = [
    { labelKey: "auth.upgrade.featureScoring",  free: true,              pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featureChart",    free: true,              pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featureMarket",   free: true,              pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featureBacktest", free: false,             pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featurePnl",      free: false,             pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featureTelegram", free: false,             pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featureWeights",  free: false,             pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featureRisk",     free: false,             pro: true,                    enterprise: true },
    { labelKey: "auth.upgrade.featurePairs",    free: t("auth.upgrade.pairs3"), pro: t("auth.upgrade.pairs15"), enterprise: t("auth.upgrade.pairsUnlimited") },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 max-w-3xl mx-auto">

      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="font-mono text-2xl font-bold text-brand tracking-widest">
          {t("auth.upgrade.title")}
        </h1>
        <p className="font-mono text-xs text-text-t3 mt-1 tracking-wider">
          {t("auth.upgrade.subtitle")}
        </p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 flex flex-col gap-1">
          <p className="font-mono text-sm font-semibold text-green-400">
            {t("auth.upgrade.successTitle")}
          </p>
          <p className="font-mono text-xs text-green-300/80">
            {t("auth.upgrade.successDesc")}
          </p>
          <button
            onClick={() => window.location.href = "/"}
            className="mt-2 self-start bg-green-500/20 border border-green-500/40 text-green-400 font-mono text-xs px-3 py-1.5 rounded tracking-widest hover:bg-green-500/30 transition-colors"
          >
            {t("auth.upgrade.reload")}
          </button>
        </div>
      )}

      {/* Canceled banner */}
      {canceled && !success && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <p className="font-mono text-xs text-amber-400/80">
            {t("auth.upgrade.errorDesc")}
          </p>
        </div>
      )}

      {/* Error from checkout */}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Free */}
        <div className={`relative rounded-lg border p-4 flex flex-col gap-3 ${currentTier === "free" ? "border-brand/50 bg-brand/5" : "border-border bg-bg-card"}`}>
          {currentTier === "free" && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand text-white font-mono text-2xs px-2 py-0.5 rounded-full tracking-wider">
              {t("auth.upgrade.current")}
            </span>
          )}
          <div>
            <p className="font-mono text-xs text-text-t3 tracking-widest uppercase">{t("auth.plan.free")}</p>
            <p className="font-mono text-2xl font-bold text-text-t1 mt-1">{t("auth.upgrade.planFreePrice")}</p>
            <p className="font-mono text-xs text-text-t4 mt-0.5">{t("auth.upgrade.planFreeDesc")}</p>
          </div>
          <button
            disabled
            className="w-full rounded border border-border font-mono text-xs text-text-t4 py-2 tracking-widest cursor-default"
          >
            {t("auth.upgrade.ctaFree")}
          </button>
        </div>

        {/* Pro */}
        <div className={`relative rounded-lg border p-4 flex flex-col gap-3 ${currentTier === "pro" ? "border-brand/50 bg-brand/5" : "border-brand/30 bg-brand/5"}`}>
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand text-white font-mono text-2xs px-2 py-0.5 rounded-full tracking-wider">
            {currentTier === "pro" ? t("auth.upgrade.current") : t("auth.upgrade.popular")}
          </span>
          <div>
            <p className="font-mono text-xs text-brand tracking-widest uppercase">{t("auth.plan.pro")}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="font-mono text-2xl font-bold text-text-t1">{t("auth.upgrade.planProPrice")}</p>
              <p className="font-mono text-xs text-text-t3">{t("auth.upgrade.monthly")}</p>
            </div>
            <p className="font-mono text-xs text-text-t4 mt-0.5">{t("auth.upgrade.planProDesc")}</p>
          </div>
          {currentTier === "pro" ? (
            <button
              disabled
              className="w-full rounded border border-brand/30 font-mono text-xs text-brand py-2 tracking-widest cursor-default"
            >
              {t("auth.upgrade.current")}
            </button>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={loading || !isLoaded}
              className="w-full rounded bg-brand text-white font-mono text-xs py-2 tracking-widest hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : t("auth.upgrade.ctaPro")}
            </button>
          )}
        </div>

        {/* Enterprise */}
        <div className={`relative rounded-lg border p-4 flex flex-col gap-3 ${currentTier === "enterprise" ? "border-brand/50 bg-brand/5" : "border-border bg-bg-card"}`}>
          {currentTier === "enterprise" && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand text-white font-mono text-2xs px-2 py-0.5 rounded-full tracking-wider">
              {t("auth.upgrade.current")}
            </span>
          )}
          <div>
            <p className="font-mono text-xs text-text-t3 tracking-widest uppercase">{t("auth.plan.enterprise")}</p>
            <p className="font-mono text-2xl font-bold text-text-t1 mt-1">{t("auth.upgrade.planEnterprisePrice")}</p>
            <p className="font-mono text-xs text-text-t4 mt-0.5">{t("auth.upgrade.planEnterpriseDesc")}</p>
          </div>
          <a
            href="mailto:sales@quantixos.com"
            className="w-full rounded border border-border font-mono text-xs text-text-t2 py-2 tracking-widest hover:border-brand/40 hover:text-brand transition-colors text-center block"
          >
            {t("auth.upgrade.ctaEnterprise")}
          </a>
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
        <div className="grid grid-cols-4 border-b border-border">
          <div className="p-3" />
          <div className="p-3 text-center font-mono text-xs text-text-t3 uppercase tracking-wider">{t("auth.plan.free")}</div>
          <div className="p-3 text-center font-mono text-xs text-brand uppercase tracking-wider">{t("auth.plan.pro")}</div>
          <div className="p-3 text-center font-mono text-xs text-text-t3 uppercase tracking-wider">{t("auth.plan.enterprise")}</div>
        </div>
        {features.map((row, i) => (
          <div
            key={row.labelKey}
            className={`grid grid-cols-4 ${i % 2 === 0 ? "bg-surface-s1/20" : ""} border-b border-border/50 last:border-0`}
          >
            <div className="p-3 font-mono text-xs text-text-t3">{t(row.labelKey as Parameters<typeof t>[0])}</div>
            <div className="p-3 flex justify-center items-center"><Cell value={row.free} /></div>
            <div className="p-3 flex justify-center items-center"><Cell value={row.pro} /></div>
            <div className="p-3 flex justify-center items-center"><Cell value={row.enterprise} /></div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradePageInner />
    </Suspense>
  );
}
