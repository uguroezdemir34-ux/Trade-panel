"use client";

/**
 * CORRELATION CARD — Pair-to-BTC 30-day daily return correlation.
 *
 * Uses 1d candles from the candle store. Hidden until BTC has ≥10 candles.
 * Color coding: |r| ≥ 0.8 = very high, ≥ 0.6 = high, ≥ 0.4 = moderate.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

const WINDOW = 30; // last N daily candles for correlation

function dailyReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;
  const xs = x.slice(-n);
  const ys = y.slice(-n);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx;
    const ey = ys[i] - my;
    num += ex * ey;
    dx2 += ex * ex;
    dy2 += ey * ey;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}

function corrColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.8) return r > 0 ? "text-green-300" : "text-red-300";
  if (abs >= 0.6) return r > 0 ? "text-green-400/80" : "text-red-400/80";
  if (abs >= 0.4) return "text-yellow-400/80";
  return "text-text-t4";
}

function corrBar(r: number): { width: number; color: string } {
  return {
    width: Math.abs(r) * 100,
    color: Math.abs(r) >= 0.8 ? (r > 0 ? "bg-green-400/50" : "bg-red-400/50") :
           Math.abs(r) >= 0.6 ? (r > 0 ? "bg-green-400/35" : "bg-red-400/35") :
           Math.abs(r) >= 0.4 ? "bg-yellow-400/35" : "bg-border/30",
  };
}

export function CorrelationCard(): React.ReactElement | null {
  const t = useT();
  const allCandles = useCandleStore((s) => s.candles);

  const rows = useMemo(() => {
    const btcCandles = allCandles["BTC_1d"] ?? EMPTY_CANDLES;
    if (btcCandles.length < 10) return null;

    const btcCloses = btcCandles.slice(-WINDOW - 1).map((c) => c.close);
    const btcRet = dailyReturns(btcCloses);

    const out: { pair: Pair; r: number }[] = [];
    for (const pair of PAIRS) {
      if (pair === "BTC") continue;
      const candles = allCandles[`${pair}_1d`] ?? EMPTY_CANDLES;
      if (candles.length < 10) continue;
      const closes = candles.slice(-WINDOW - 1).map((c) => c.close);
      const ret = dailyReturns(closes);
      const r = pearson(btcRet, ret);
      if (r !== null) out.push({ pair, r });
    }
    return out.sort((a, b) => b.r - a.r);
  }, [allCandles]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          BTC Korelasyon · {WINDOW}g
        </h3>
        <span className="text-text-t4 font-mono text-2xs">
          Pearson r
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {rows.map(({ pair, r }) => {
          const bar = corrBar(r);
          return (
            <div key={pair} className="grid items-center gap-x-2 font-mono text-xs" style={{ gridTemplateColumns: "40px 1fr 40px" }}>
              <span className="text-text-t2 text-2xs font-semibold">{pair}</span>
              <div className="h-2 rounded-sm bg-border/20 overflow-hidden">
                <div className={`h-full rounded-sm ${bar.color}`} style={{ width: `${bar.width}%` }} />
              </div>
              <span className={`tabular-nums text-right text-2xs ${corrColor(r)}`}>
                {r >= 0 ? "+" : ""}{r.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-text-t4 font-mono text-2xs mt-3">
        {t("piyasa.correlationCard.desc")}
      </p>
    </div>
  );
}
