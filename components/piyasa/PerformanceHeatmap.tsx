"use client";

import { useMemo } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";

type TF = "1h" | "4h" | "24h" | "7d";

const TF_LABELS: Record<TF, string> = {
  "1h":  "1S",
  "4h":  "4S",
  "24h": "24S",
  "7d":  "7G",
};

function retColor(pct: number | null): string {
  if (pct === null) return "bg-surface-s1 text-text-t4";
  if (pct >= 8)   return "bg-green-500/30 text-green-300";
  if (pct >= 4)   return "bg-green-500/20 text-green-400";
  if (pct >= 1.5) return "bg-green-500/12 text-green-400";
  if (pct >= 0.3) return "bg-green-500/8  text-green-500/80";
  if (pct > -0.3) return "bg-surface-s1   text-text-t3";
  if (pct > -1.5) return "bg-red-500/8    text-red-500/80";
  if (pct > -4)   return "bg-red-500/12   text-red-400";
  if (pct > -8)   return "bg-red-500/20   text-red-400";
  return               "bg-red-500/30   text-red-300";
}

function fmtRet(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

interface PairRow {
  pair: Pair;
  ret1h:  number | null;
  ret4h:  number | null;
  ret24h: number | null;
  ret7d:  number | null;
}

export function PerformanceHeatmap(): React.ReactElement {
  const candles = useCandleStore((s) => s.candles);
  const prices  = useMarketStore((s) => s.prices);

  const rows = useMemo((): PairRow[] => {
    return PAIRS.map((pair) => {
      const c1h = candles[`${pair}_1h`];
      const c4h = candles[`${pair}_4h`];
      const c1d = candles[`${pair}_1d`];
      const live = prices[pair]?.last ?? null;

      // 1h: current vs 1 1h-candle ago
      let ret1h: number | null = null;
      if (c1h && c1h.length >= 2 && live !== null) {
        const prev = c1h[c1h.length - 2].close;
        if (prev > 0) ret1h = ((live - prev) / prev) * 100;
      }

      // 4h: current vs 1 4h-candle ago
      let ret4h: number | null = null;
      if (c4h && c4h.length >= 2 && live !== null) {
        const prev = c4h[c4h.length - 2].close;
        if (prev > 0) ret4h = ((live - prev) / prev) * 100;
      }

      // 24h: from marketStore chg (most accurate)
      const ret24h = prices[pair]?.chg ?? null;

      // 7d: current vs open of 7 daily candles ago
      let ret7d: number | null = null;
      if (c1d && c1d.length >= 8 && live !== null) {
        const prev = c1d[c1d.length - 8].open;
        if (prev > 0) ret7d = ((live - prev) / prev) * 100;
      }

      return { pair, ret1h, ret4h, ret24h, ret7d };
    });
  }, [candles, prices]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.ret24h ?? -999) - (a.ret24h ?? -999)),
    [rows],
  );

  const tfs: TF[] = ["1h", "4h", "24h", "7d"];

  return (
    <div className="border border-border bg-bg-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] items-center gap-x-0 px-3 py-1.5 border-b border-border/50">
        <span className="font-mono text-2xs tracking-wider uppercase text-text-t4">Coin</span>
        {tfs.map((tf) => (
          <span key={tf} className="font-mono text-2xs tracking-wider uppercase text-text-t4 text-right">
            {TF_LABELS[tf]}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/20">
        {sorted.map(({ pair, ret1h, ret4h, ret24h, ret7d }) => {
          const vals: (number | null)[] = [ret1h, ret4h, ret24h, ret7d];
          return (
            <div
              key={pair}
              className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] items-center gap-x-0 px-3 py-1"
            >
              <span className="font-mono text-xs font-semibold text-text-t2">{pair}</span>
              {vals.map((v, i) => (
                <span
                  key={i}
                  translate="no"
                  className={`font-mono text-2xs tabular-nums text-right px-1 py-0.5 rounded ${retColor(v)}`}
                >
                  {fmtRet(v)}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
