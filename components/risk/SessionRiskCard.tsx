"use client";

import { useT, useLocale } from "@/lib/i18n/context";
import { formatPercent } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/types";
import { useAccountStore } from "@/lib/store/accountStore";

export function SessionRiskCard(): React.ReactElement {
  const t = useT();
  const locale = useLocale();
  const dailyPnlPct = useAccountStore((s) => s.dailyPnlPct);
  const weeklyPnlPct = useAccountStore((s) => s.weeklyPnlPct);
  const monthlyPnlPct = useAccountStore((s) => s.monthlyPnlPct);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        {t("risk.session.title")}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <PnlStat label={t("risk.session.daily")} pct={dailyPnlPct} locale={locale} />
        <PnlStat label={t("risk.session.weekly")} pct={weeklyPnlPct} locale={locale} />
        <PnlStat label={t("risk.session.monthly")} pct={monthlyPnlPct} locale={locale} />
      </div>
    </div>
  );
}

function PnlStat({ label, pct, locale }: { label: string; pct: number; locale: Locale }) {
  const color =
    pct > 0 ? "text-signal-green" : pct < 0 ? "text-signal-red" : "text-text-t3";
  const barColor =
    pct > 0 ? "bg-signal-green" : pct < 0 ? "bg-signal-red" : "bg-border";
  const barWidth = `${Math.min(Math.abs(pct) * 20, 100)}%`;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
      <span className={`font-mono text-lg font-bold tabular-nums ${color}`}>
        {formatPercent(pct, locale, true)}
      </span>
      <div className="h-1 rounded-full bg-border/30 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} opacity-70`} style={{ width: barWidth }} />
      </div>
    </div>
  );
}
