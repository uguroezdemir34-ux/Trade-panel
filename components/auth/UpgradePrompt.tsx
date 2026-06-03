"use client";

import { useT } from "@/lib/i18n/context";
import type { FeatureKey } from "@/lib/auth/subscription";

interface Props {
  feature: FeatureKey;
}

export function UpgradePrompt({ feature }: Props): React.ReactElement {
  const t = useT();
  return (
    <div className="border-border bg-bg-card rounded-lg border p-6 flex flex-col items-center gap-3 text-center">
      <span className="text-2xl">🔒</span>
      <p className="text-text-t2 font-mono text-sm font-medium">
        {t("auth.upgradeTitle")}
      </p>
      <p className="text-text-t4 font-mono text-xs leading-relaxed max-w-xs">
        {t("auth.upgradePrompt").replace("{feature}", feature)}
      </p>
      <a
        href="/ayarlar"
        className="bg-brand text-white rounded px-4 py-2 font-mono text-xs tracking-widest hover:bg-brand/90 transition-colors"
      >
        {t("auth.upgradeCta")}
      </a>
    </div>
  );
}
