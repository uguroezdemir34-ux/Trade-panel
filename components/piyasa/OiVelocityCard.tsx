"use client";

/**
 * OI VELOCITY CARD — Open Interest ivme analizi (BTC + ETH).
 *
 * Gösterir:
 *  - Rejim etiketi (aggressive_long, short_squeeze_risk, vb.)
 *  - OI ivme skoru [-10, +10] (renk kodlu)
 *  - Büyüklük (weak/moderate/strong/extreme)
 *  - OI % değişim + fiyat % değişim
 *  - Snapshot sayısı (kaç ölçüm birikti)
 */

import type { OiVelocityResult } from "@/lib/market/oi-velocity";

interface Props {
  btc: OiVelocityResult | null;
  eth: OiVelocityResult | null;
  loading: boolean;
}

const REGIME_META: Record<
  string,
  { label: string; emoji: string; color: string; tone: "bull" | "bear" | "neutral" }
> = {
  aggressive_long:    { label: "Agresif Long", emoji: "🟢", color: "#22C55E", tone: "bull" },
  short_squeeze_risk: { label: "Short Squeeze Riski", emoji: "🔴", color: "#EF4444", tone: "bear" },
  long_unwind:        { label: "Long Kapanıyor", emoji: "🟡", color: "#F59E0B", tone: "neutral" },
  bear_exhaustion:    { label: "Bear Yorgunluğu", emoji: "🔵", color: "#3B82F6", tone: "neutral" },
  neutral:            { label: "Nötr", emoji: "⚪", color: "rgb(var(--text-t3))", tone: "neutral" },
};

const MAG_META: Record<string, string> = {
  weak:    "Zayıf",
  moderate:"Orta",
  strong:  "Güçlü",
  extreme: "Aşırı",
};

function scoreColor(score: number): string {
  if (score >= 3) return "#22C55E";
  if (score >= 1) return "#86EFAC";
  if (score <= -3) return "#EF4444";
  if (score <= -1) return "#FCA5A5";
  return "rgb(var(--text-t3))";
}

function PairRow({
  pair,
  result,
}: {
  pair: string;
  result: OiVelocityResult | null;
}) {
  if (!result) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-text-t2 w-10 font-mono text-xs font-semibold">{pair}</span>
        <span className="text-text-t4 font-mono text-2xs">Veri bekleniyor...</span>
      </div>
    );
  }

  const regime = REGIME_META[result.regime] ?? REGIME_META.neutral;

  return (
    <div className="py-1.5">
      {/* Top row: pair name + regime + score */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-t2 w-10 shrink-0 font-mono text-xs font-semibold">
          {pair}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="text-[10px]">{regime.emoji}</span>
          <span
            className="truncate font-mono text-[10px] font-medium"
            style={{ color: regime.color }}
          >
            {regime.label}
          </span>
        </div>
        <span
          className="shrink-0 font-mono text-xs font-bold tabular-nums"
          style={{ color: scoreColor(result.oiVelocityScore) }}
        >
          {result.oiVelocityScore >= 0 ? "+" : ""}
          {result.oiVelocityScore.toFixed(1)}
        </span>
      </div>

      {/* Bottom row: magnitude + deltas + sample count */}
      <div className="mt-0.5 flex items-center gap-3">
        <span className="text-text-t4 font-mono text-[9px]">
          {MAG_META[result.magnitude] ?? result.magnitude}
        </span>
        <span className="text-text-t3 font-mono text-[9px] tabular-nums">
          OI {result.oiChangePct >= 0 ? "+" : ""}
          {result.oiChangePct.toFixed(2)}%
        </span>
        <span className="text-text-t3 font-mono text-[9px] tabular-nums">
          Fiyat {result.priceChangePct >= 0 ? "+" : ""}
          {result.priceChangePct.toFixed(2)}%
        </span>
        <span className="text-text-t4 ml-auto font-mono text-[9px]">
          n={result.periodCount}
        </span>
      </div>
    </div>
  );
}

export function OiVelocityCard({ btc, eth, loading }: Props): React.ReactElement {
  const hasData = btc !== null || eth !== null;

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          OI Velocity
        </span>
        {loading && (
          <span className="text-text-t4 font-mono text-2xs animate-pulse">
            güncelleniyor...
          </span>
        )}
        {!loading && !hasData && (
          <span className="text-text-t4 font-mono text-2xs">
            ~5dk sonra
          </span>
        )}
      </div>

      <div className="divide-border divide-y">
        <PairRow pair="BTC" result={btc} />
        <PairRow pair="ETH" result={eth} />
      </div>

      {/* Note: 2+ snapshots needed */}
      {!hasData && !loading && (
        <p className="text-text-t4 mt-2 font-mono text-[9px] leading-relaxed">
          İlk ölçüm tamamlandı, ivme hesabı için 2+ OI snapshot gerekli (~10dk).
        </p>
      )}
    </div>
  );
}
