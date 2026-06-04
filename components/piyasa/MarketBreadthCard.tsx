"use client";

/**
 * MARKET BREADTH CARD — GO/WAIT/NO distribution across all 15 pairs.
 *
 * Reads from scoreStore. Helps traders understand overall market conditions:
 * many GO signals = bullish environment; many NO signals = risk-off.
 * Hidden until at least 5 pairs have scores.
 */

import { useMemo } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { PAIRS } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";

export function MarketBreadthCard(): React.ReactElement | null {
  const t = useT();
  const results = useScoreStore((s) => s.results);

  const data = useMemo(() => {
    const scored = PAIRS.map((p) => results[p]).filter(Boolean);
    if (scored.length < 5) return null;

    const go = scored.filter((r) => r!.verdict === "go").length;
    const wait = scored.filter((r) => r!.verdict === "wait").length;
    const no = scored.length - go - wait;

    // Directional split among GO pairs
    const goPairs = PAIRS.filter((p) => results[p]?.verdict === "go");
    const goLongs = goPairs.filter((p) => results[p]?.direction === "LONG").length;
    const goShorts = goPairs.filter((p) => results[p]?.direction === "SHORT").length;

    // Top 3 GO pairs by score
    const topGo = PAIRS
      .filter((p) => results[p]?.verdict === "go")
      .sort((a, b) => (results[b]?.score ?? 0) - (results[a]?.score ?? 0))
      .slice(0, 3);

    return { go, wait, no, total: scored.length, goLongs, goShorts, topGo };
  }, [results]);

  if (!data) return null;

  const { go, wait, no, total, goLongs, goShorts, topGo } = data;
  const goPct = (go / total) * 100;
  const waitPct = (wait / total) * 100;
  const noPct = (no / total) * 100;

  const bias = go > no + 1 ? "bullish" : no > go + 1 ? "bearish" : "neutral";
  const biasColor = bias === "bullish" ? "#22c55e" : bias === "bearish" ? "#ef4444" : "#f59e0b";
  const biasLabel = bias === "bullish" ? "Risk-On" : bias === "bearish" ? "Risk-Off" : "Mixed";

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          📡 {t("piyasa.marketBreadth.title")}
        </h3>
        <span className="font-mono text-xs font-semibold" style={{ color: biasColor }}>
          {biasLabel}
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-3">
        {go > 0 && (
          <div className="bg-green-500/70 rounded-l-full" style={{ width: `${goPct}%` }} />
        )}
        {wait > 0 && (
          <div className="bg-yellow-500/60" style={{ width: `${waitPct}%` }} />
        )}
        {no > 0 && (
          <div className="bg-red-500/50 rounded-r-full" style={{ width: `${noPct}%` }} />
        )}
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <div className="text-green-400 font-mono text-lg font-bold">{go}</div>
          <div className="text-text-t4 font-mono text-2xs">GO</div>
        </div>
        <div>
          <div className="text-yellow-400 font-mono text-lg font-bold">{wait}</div>
          <div className="text-text-t4 font-mono text-2xs">WAIT</div>
        </div>
        <div>
          <div className="text-red-400 font-mono text-lg font-bold">{no}</div>
          <div className="text-text-t4 font-mono text-2xs">NO</div>
        </div>
      </div>

      {/* GO pairs directional split */}
      {go > 0 && (
        <div className="flex items-center gap-3 text-2xs font-mono border-t border-border/30 pt-2">
          {goLongs > 0 && (
            <span className="text-green-400">▲ {goLongs} Long{goLongs !== 1 ? "s" : ""}</span>
          )}
          {goShorts > 0 && (
            <span className="text-red-400">▼ {goShorts} Short{goShorts !== 1 ? "s" : ""}</span>
          )}
          {topGo.length > 0 && (
            <span className="text-text-t4 ml-auto">
              {topGo.map((p) => {
                const dir = results[p]?.direction;
                return `${p}${dir === "LONG" ? "▲" : "▼"}`;
              }).join(" ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
