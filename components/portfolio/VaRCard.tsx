"use client";

import { useT } from "@/lib/i18n/context";
import { usePortfolioAnalytics } from "@/lib/hooks/usePortfolioAnalytics";
import { usePositionStore } from "@/lib/store/positionStore";

function fmt(usd: number): string {
  return usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(usd: number, notional: number): string {
  if (notional <= 0) return "";
  return ` (${((usd / notional) * 100).toFixed(2)}%)`;
}

export function VaRCard(): React.ReactElement {
  const t = useT();
  const { varResult } = usePortfolioAnalytics();
  const positions = usePositionStore((s) => s.positions);

  const hasPositions = positions.some(
    (p) => p.direction === "LONG" || p.direction === "SHORT",
  );

  return (
    <div className="border-border bg-surface rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
          {t("portfolio.var.title")}
        </h3>
        <span className="text-text-t4 font-mono text-2xs">1-DAY · 4H HISTORICAL</span>
      </div>

      {!hasPositions && (
        <div className="rounded border border-border/50 bg-surface-s1 px-3 py-4 text-center">
          <p className="text-text-t3 font-mono text-xs">{t("portfolio.var.noPositions")}</p>
          <p className="text-text-t4 font-mono text-2xs mt-1">{t("portfolio.var.noPositionsHint")}</p>
        </div>
      )}

      {hasPositions && !varResult && (
        <div className="rounded border border-border/50 bg-surface-s1 px-3 py-4 text-center">
          <p className="text-text-t3 font-mono text-xs">{t("portfolio.var.insufficientData")}</p>
        </div>
      )}

      {varResult && (
        <>
          {/* Main VaR metrics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <VaRStat
              label={t("portfolio.var.var95")}
              value={`-$${fmt(varResult.var95Usd)}${pct(varResult.var95Usd, varResult.totalNotionalUsd)}`}
              color="text-yellow-400"
            />
            <VaRStat
              label={t("portfolio.var.var99")}
              value={`-$${fmt(varResult.var99Usd)}${pct(varResult.var99Usd, varResult.totalNotionalUsd)}`}
              color="text-red-400"
            />
            <VaRStat
              label={t("portfolio.var.cvar95")}
              value={`-$${fmt(varResult.cvar95Usd)}${pct(varResult.cvar95Usd, varResult.totalNotionalUsd)}`}
              color="text-red-500"
              hint={t("portfolio.var.cvarHint")}
            />
            <VaRStat
              label={t("portfolio.var.portfolioVol")}
              value={`±$${fmt(varResult.portfolioVolUsd)}`}
              hint={`${varResult.scenarios} ${t("portfolio.var.scenarios")}`}
            />
          </div>

          {/* Total notional */}
          <div className="border-t border-border/50 pt-3 mb-3">
            <div className="flex justify-between font-mono text-2xs">
              <span className="text-text-t4">{t("portfolio.var.notional")}</span>
              <span className="text-text-t2 tabular-nums">${fmt(varResult.totalNotionalUsd)}</span>
            </div>
          </div>

          {/* Per-position contributions */}
          {Object.keys(varResult.contributions).length > 1 && (
            <div>
              <p className="text-text-t4 font-mono text-2xs tracking-wider uppercase mb-2">
                {t("portfolio.var.contributions")}
              </p>
              <div className="space-y-1">
                {Object.entries(varResult.contributions)
                  .sort(([, a], [, b]) => b - a)
                  .map(([pair, contrib]) => {
                    const share = varResult.var95Usd > 0 ? (contrib / varResult.var95Usd) * 100 : 0;
                    return (
                      <div key={pair} className="flex items-center gap-2 font-mono text-2xs">
                        <span className="text-text-t3 w-10">{pair}</span>
                        <div className="flex-1 h-1.5 bg-border/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400/60 rounded-full"
                            style={{ width: `${Math.min(100, share)}%` }}
                          />
                        </div>
                        <span className="text-text-t3 tabular-nums w-16 text-right">
                          -${fmt(contrib)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <p className="text-text-t4 font-mono text-2xs mt-3 border-t border-border/30 pt-2">
            {t("portfolio.var.disclaimer")}
          </p>
        </>
      )}
    </div>
  );
}

function VaRStat({
  label, value, color, hint,
}: { label: string; value: string; color?: string; hint?: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${color ?? "text-text-t1"}`}>
        {value}
      </span>
      {hint && <span className="text-text-t4 font-mono text-2xs">{hint}</span>}
    </div>
  );
}
