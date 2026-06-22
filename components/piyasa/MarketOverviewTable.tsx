"use client";

import { useState, useMemo } from "react";
import { useMarketStore } from "@/lib/store/marketStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useCandleStore } from "@/lib/store/candleStore";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";
import type { Timeframe } from "@/lib/okx/candles";

type PairTfKey = `${Pair}_${Timeframe}`;
type SortKey = "pair" | "price" | "chg" | "score";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(p: number): string {
  if (p >= 10_000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 100)    return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)      return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

// ─── Sparkline (pure SVG, no animation, no library) ──────────────────────────

function MiniSparkline({ closes }: { closes: number[] }): React.ReactElement {
  if (closes.length < 2) {
    // Placeholder: thin horizontal centre line
    return (
      <svg viewBox="0 0 64 20" className="w-16 h-5" aria-hidden="true">
        <line x1="2" y1="10" x2="62" y2="10" stroke="#2a2a3a" strokeWidth={0.8} />
      </svg>
    );
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const W = 64, H = 20, PAD = 2;

  const pts = closes
    .map((c, i) => {
      const x = PAD + (i / (closes.length - 1)) * (W - PAD * 2);
      const y = PAD + (1 - (c - min) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const isUp = closes[closes.length - 1] >= closes[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-16 h-5" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  );
}

// ─── Sort header button ───────────────────────────────────────────────────────

function SortHeader({
  label, k, active, desc, onClick, className = "",
}: {
  label: string; k: SortKey; active: boolean; desc: boolean;
  onClick: (k: SortKey) => void; className?: string;
}) {
  return (
    <button
      onClick={() => onClick(k)}
      className={`font-mono text-2xs tracking-wider uppercase transition-colors ${
        active ? "text-text-t1" : "text-text-t4 hover:text-text-t3"
      } ${className}`}
    >
      {label}{active ? (desc ? " ▼" : " ▲") : ""}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const VERDICT_DOT: Record<string, string> = {
  go:   "bg-green-400",
  wait: "bg-yellow-400",
  no:   "bg-red-400/60",
};

/**
 * Responsive grid — sparkline sütunu mobilde display:none ile grid flow'dan çıkar.
 * Mobile (5 col): Coin / Fiyat / 24h% / Score / dot
 * Desktop (6 col): Coin / Fiyat / 24h% / Trend / Score / dot
 */
const GRID = "[grid-template-columns:44px_1fr_60px_36px_12px] lg:[grid-template-columns:44px_1fr_60px_68px_36px_12px]";

export function MarketOverviewTable(): React.ReactElement {
  const prices  = useMarketStore((s) => s.prices);
  const results = useScoreStore((s) => s.results);
  const candles = useCandleStore((s) => s.candles);

  const [sortKey,  setSortKey]  = useState<SortKey>("score");
  const [sortDesc, setSortDesc] = useState(true);

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDesc((d) => !d);
    else { setSortKey(k); setSortDesc(true); }
  }

  const rows = useMemo(() => {
    const base = PAIRS.map((pair) => {
      const key = `${pair}_1h` as PairTfKey;
      return {
        pair,
        tick:   prices[pair],
        result: results[pair],
        closes: (candles[key] ?? []).slice(-20).map((c) => c.close),
      };
    });

    return [...base].sort((a, b) => {
      if (sortKey === "pair") {
        return sortDesc
          ? b.pair.localeCompare(a.pair)
          : a.pair.localeCompare(b.pair);
      }
      let av: number, bv: number;
      if (sortKey === "price") {
        av = a.tick?.last ?? -1;
        bv = b.tick?.last ?? -1;
      } else if (sortKey === "chg") {
        av = a.tick?.chg ?? -999;
        bv = b.tick?.chg ?? -999;
      } else { // score
        av = a.result?.score ?? -1;
        bv = b.result?.score ?? -1;
      }
      return sortDesc ? bv - av : av - bv;
    });
  }, [prices, results, candles, sortKey, sortDesc]);

  const anyData = rows.some((r) => !!r.tick);

  return (
    <div className="border border-border bg-bg-card rounded-lg overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`grid items-center gap-x-2 px-3 py-1.5 border-b border-border/50 ${GRID}`}>
        <SortHeader label="Coin"  k="pair"  active={sortKey === "pair"}  desc={sortDesc} onClick={handleSort} />
        <SortHeader label="Fiyat" k="price" active={sortKey === "price"} desc={sortDesc} onClick={handleSort} className="text-right" />
        <SortHeader label="24h %" k="chg"   active={sortKey === "chg"}   desc={sortDesc} onClick={handleSort} className="text-right" />
        {/* Trend header — hidden on mobile, visible on desktop */}
        <span className="hidden lg:block font-mono text-2xs tracking-wider uppercase text-text-t4 text-center">
          Trend
        </span>
        <SortHeader label="Score" k="score" active={sortKey === "score"} desc={sortDesc} onClick={handleSort} className="text-right" />
        <span />
      </div>

      {/* ── Rows ────────────────────────────────────────────────────────────── */}
      {!anyData ? (
        <div className="px-3 py-4 text-text-t4 font-mono text-xs text-center">
          Bağlanıyor…
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {rows.map(({ pair, tick, result, closes }) => {
            const chg      = tick?.chg ?? null;
            const verdict  = result?.verdict;
            const score    = result?.score;
            const dir      = result?.direction;
            const chgColor =
              chg === null ? "text-text-t4" :
              chg > 0      ? "text-green-400" :
              chg < 0      ? "text-red-400"   : "text-text-t3";
            const scoreColor =
              verdict === "go"   ? "text-green-400"  :
              verdict === "wait" ? "text-yellow-400" :
              verdict === "no"   ? "text-red-400/70" : "text-text-t4";
            const dirArrow = dir === "LONG" ? "▲" : dir === "SHORT" ? "▼" : "";
            const dotClass = verdict
              ? (VERDICT_DOT[verdict] ?? "bg-border")
              : "bg-border/30";

            return (
              <div
                key={pair}
                className={`grid items-center gap-x-2 px-3 py-1.5 ${GRID}`}
              >
                <span className="font-mono text-xs font-semibold text-text-t2">
                  {pair}
                </span>
                <span translate="no" className="font-mono text-xs tabular-nums text-text-t1 text-right">
                  {tick ? `$${fmtPrice(tick.last)}` : "—"}
                </span>
                <span translate="no" className={`font-mono text-xs tabular-nums text-right ${chgColor}`}>
                  {chg !== null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                </span>
                {/* Sparkline — hidden on mobile via display:none, exits grid flow */}
                <div className="hidden lg:flex items-center justify-center">
                  <MiniSparkline closes={closes} />
                </div>
                <span translate="no" className={`font-mono text-xs tabular-nums text-right ${scoreColor}`}>
                  {score !== undefined ? `${score}${dirArrow}` : "—"}
                </span>
                <div className="flex justify-center">
                  <div className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
