"use client";

/**
 * TRADE INSIGHTS CARD — Auto-generated actionable findings from trade history.
 *
 * Computes up to 5 insights from the trade dataset:
 *   • Best/worst pair by win rate (min 3 trades)
 *   • Best UTC hour range by win rate (top 3-hour block)
 *   • Score sweet spot (bucket with highest avgR, min 3 trades)
 *   • Current LONG vs SHORT split with win rate comparison
 *   • Time-in-trade insight (optimal holding time)
 *
 * Requires at least 10 trades to show.
 */

import { useMemo } from "react";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: TradeRecord[];
}

interface Insight {
  icon: string;
  text: string;
  color: string;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function computeInsights(trades: TradeRecord[]): Insight[] {
  if (trades.length < 10) return [];
  const insights: Insight[] = [];

  // 1. Best pair by win rate (min 3 trades)
  const pairMap: Record<string, { wins: number; total: number }> = {};
  for (const t of trades) {
    if (!pairMap[t.pair]) pairMap[t.pair] = { wins: 0, total: 0 };
    pairMap[t.pair].total++;
    if (t.pnlUsd > 0) pairMap[t.pair].wins++;
  }
  const eligiblePairs = Object.entries(pairMap)
    .filter(([, v]) => v.total >= 3)
    .sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total);

  if (eligiblePairs.length >= 1) {
    const [bestPair, best] = eligiblePairs[0];
    const wr = best.wins / best.total;
    if (wr >= 0.55) {
      insights.push({
        icon: "🏆",
        text: `${bestPair} en iyi pariteniz — ${pct(wr)} kazanma oranı (${best.total} işlem)`,
        color: "text-green-400",
      });
    }
    if (eligiblePairs.length >= 2) {
      const [worstPair, worst] = eligiblePairs[eligiblePairs.length - 1];
      const wr2 = worst.wins / worst.total;
      if (wr2 <= 0.40) {
        insights.push({
          icon: "⚠",
          text: `${worstPair} zor parite — ${pct(wr2)} kazanma oranı (${worst.total} işlem). Lotunuzu azaltın.`,
          color: "text-amber-400",
        });
      }
    }
  }

  // 2. Best 3-hour UTC window
  const hourMap: Record<number, { wins: number; total: number }> = {};
  for (let h = 0; h < 24; h++) hourMap[h] = { wins: 0, total: 0 };
  for (const t of trades) {
    if (!t.openedAt) continue;
    const h = new Date(t.openedAt).getUTCHours();
    hourMap[h].total++;
    if (t.pnlUsd > 0) hourMap[h].wins++;
  }
  // Find best 3-hour window with at least 3 trades total
  let bestWindowWr = 0;
  let bestWindowStart = -1;
  for (let h = 0; h < 24; h++) {
    const total = hourMap[h].total + hourMap[(h + 1) % 24].total + hourMap[(h + 2) % 24].total;
    const wins = hourMap[h].wins + hourMap[(h + 1) % 24].wins + hourMap[(h + 2) % 24].wins;
    if (total >= 3) {
      const wr = wins / total;
      if (wr > bestWindowWr) { bestWindowWr = wr; bestWindowStart = h; }
    }
  }
  if (bestWindowStart >= 0 && bestWindowWr >= 0.60) {
    const endH = (bestWindowStart + 3) % 24;
    insights.push({
      icon: "⏰",
      text: `En iyi saat aralığınız ${bestWindowStart}:00-${endH}:00 UTC — ${pct(bestWindowWr)} kazanma oranı`,
      color: "text-blue-400",
    });
  }

  // 3. LONG vs SHORT comparison
  const longs = trades.filter((t) => t.direction === "LONG");
  const shorts = trades.filter((t) => t.direction === "SHORT");
  if (longs.length >= 3 && shorts.length >= 3) {
    const longWr = longs.filter((t) => t.pnlUsd > 0).length / longs.length;
    const shortWr = shorts.filter((t) => t.pnlUsd > 0).length / shorts.length;
    const diff = Math.abs(longWr - shortWr);
    if (diff >= 0.15) {
      const better = longWr > shortWr ? "LONG" : "SHORT";
      const betterWr = Math.max(longWr, shortWr);
      const worseWr = Math.min(longWr, shortWr);
      insights.push({
        icon: better === "LONG" ? "▲" : "▼",
        text: `${better} işlemleriniz daha güçlü: ${pct(betterWr)} vs ${pct(worseWr)} (${better === "LONG" ? "SHORT" : "LONG"})`,
        color: better === "LONG" ? "text-green-400" : "text-red-400",
      });
    }
  }

  // 4. Score sweet spot — best avgR by score bucket
  const buckets: Record<string, number[]> = { "<80": [], "80-84": [], "85-89": [], "90-94": [], "95+": [] };
  for (const t of trades) {
    if (t.score == null || t.rMultiple == null) continue;
    const s = t.score;
    const key = s < 80 ? "<80" : s <= 84 ? "80-84" : s <= 89 ? "85-89" : s <= 94 ? "90-94" : "95+";
    buckets[key].push(t.rMultiple);
  }
  let bestBucket = "";
  let bestBucketAvgR = -Infinity;
  for (const [key, rs] of Object.entries(buckets)) {
    if (rs.length < 3) continue;
    const avg = rs.reduce((s, r) => s + r, 0) / rs.length;
    if (avg > bestBucketAvgR) { bestBucketAvgR = avg; bestBucket = key; }
  }
  if (bestBucket && bestBucketAvgR > 0.3) {
    insights.push({
      icon: "🎯",
      text: `Skor ${bestBucket} aralığı en verimli — ortalama +${bestBucketAvgR.toFixed(2)}R (${buckets[bestBucket].length} işlem)`,
      color: "text-purple-400",
    });
  }

  return insights.slice(0, 5);
}

export function TradeInsightsCard({ trades }: Props): React.ReactElement | null {
  const insights = useMemo(() => computeInsights(trades), [trades]);

  if (insights.length === 0) return null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 mb-3 font-mono text-2xs tracking-widest uppercase">
        💡 Trade Insights
      </h3>
      <div className="flex flex-col gap-2.5">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-sm leading-tight shrink-0 mt-0.5">{ins.icon}</span>
            <span className={`font-mono text-xs leading-relaxed ${ins.color}`}>
              {ins.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
