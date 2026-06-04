"use client";

import { useT } from "@/lib/i18n/context";
import { usePortfolioAnalytics } from "@/lib/hooks/usePortfolioAnalytics";

/** Map correlation value [-1, +1] to a CSS background color string */
function corrColor(r: number | null): string {
  if (r === null) return "transparent";
  if (r >= 0.999) return "rgba(255,255,255,0.12)"; // diagonal
  if (r > 0) {
    const a = Math.min(1, r);
    return `rgba(34,197,94,${(a * 0.7).toFixed(2)})`; // green
  }
  const a = Math.min(1, -r);
  return `rgba(239,68,68,${(a * 0.7).toFixed(2)})`; // red
}

function corrText(r: number | null): string {
  if (r === null) return "—";
  if (Math.abs(r) >= 0.999) return "1.00";
  return r.toFixed(2);
}

function corrTextColor(r: number | null): string {
  if (r === null) return "text-text-t4";
  if (Math.abs(r) >= 0.999) return "text-text-t3";
  if (r > 0.5) return "text-green-300";
  if (r < -0.5) return "text-red-300";
  return "text-text-t3";
}

const CELL = 36; // px per cell

export function CorrelationMatrix(): React.ReactElement {
  const t = useT();
  const { correlationMatrix } = usePortfolioAnalytics();
  const { pairs, data, returnCount } = correlationMatrix;

  return (
    <div className="border-border bg-surface rounded-lg border p-4">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <h3 className="text-text-t1 font-mono text-sm font-semibold tracking-wider uppercase">
            {t("portfolio.corr.title")}
          </h3>
          {returnCount > 0 && (
            <p className="text-text-t4 font-mono text-2xs mt-0.5">
              {t("portfolio.corr.hint").replace("{n}", String(returnCount))}
            </p>
          )}
        </div>
        {/* Color scale legend */}
        <div className="shrink-0 flex items-center gap-1 font-mono text-2xs text-text-t4">
          <span style={{ color: "rgba(239,68,68,0.8)" }}>-1</span>
          <div className="w-12 h-2 rounded" style={{
            background: "linear-gradient(to right, rgba(239,68,68,0.7), transparent, rgba(34,197,94,0.7))"
          }} />
          <span style={{ color: "rgba(34,197,94,0.8)" }}>+1</span>
        </div>
      </div>

      {pairs.length === 0 && (
        <div className="text-center py-6">
          <p className="text-text-t3 font-mono text-xs">{t("portfolio.corr.noData")}</p>
          <p className="text-text-t4 font-mono text-2xs mt-1">{t("portfolio.corr.noDataHint")}</p>
        </div>
      )}

      {pairs.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4">
          <div style={{ minWidth: (pairs.length + 1) * CELL + 32 }}>
            {/* Column headers */}
            <div className="flex" style={{ marginLeft: 32 }}>
              {pairs.map((p) => (
                <div
                  key={p}
                  className="font-mono text-center text-text-t4 shrink-0"
                  style={{ width: CELL, fontSize: 8, lineHeight: "20px" }}
                  title={p}
                >
                  {p.length <= 3 ? p : p.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {pairs.map((rowPair, i) => (
              <div key={rowPair} className="flex items-center">
                {/* Row label */}
                <div
                  className="font-mono text-text-t3 shrink-0 text-right pr-1"
                  style={{ width: 32, fontSize: 8 }}
                  title={rowPair}
                >
                  {rowPair.length <= 3 ? rowPair : rowPair.slice(0, 3)}
                </div>

                {/* Cells */}
                {pairs.map((colPair, j) => {
                  const r = data[i]?.[j] ?? null;
                  return (
                    <div
                      key={colPair}
                      className="shrink-0 flex items-center justify-center rounded-sm m-px"
                      style={{
                        width: CELL - 2,
                        height: CELL - 2,
                        background: corrColor(r),
                        fontSize: 7,
                        fontFamily: "monospace",
                      }}
                      title={`${rowPair} / ${colPair}: ${corrText(r)}`}
                    >
                      <span className={corrTextColor(r)} style={{ fontSize: 7 }}>
                        {corrText(r)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {pairs.length > 0 && (
        <p className="text-text-t4 font-mono text-2xs mt-3 border-t border-border/30 pt-2">
          {t("portfolio.corr.pearsonNote")}
        </p>
      )}
    </div>
  );
}
