"use client";

/**
 * VOLATILITY RANK CARD — ATR(14)% per pair on 1h candles.
 *
 * ATR% = ATR(14) / last_price × 100
 * Sorted descending. Shows which pairs are moving the most.
 * Hidden when fewer than 5 pairs have candle data.
 */

import { useMemo } from "react";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS } from "@/lib/constants/pairs";
import { atr } from "@/lib/indicators/atr";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { useT } from "@/lib/i18n/context";

export function VolatilityRankCard(): React.ReactElement | null {
  const t = useT();
  const allCandles = useCandleStore((s) => s.candles);
  const prices = useMarketStore((s) => s.prices);

  const rows = useMemo(() => {
    const out: { pair: string; atrPct: number; atrAbs: number }[] = [];

    for (const pair of PAIRS) {
      const candles = allCandles[`${pair}_1h`] ?? EMPTY_CANDLES;
      const price = prices[pair]?.last;
      if (candles.length < 15 || !price) continue;

      const atrVal = atr(candles.map(toIndicatorCandle), { period: 14 });
      if (atrVal === null) continue;

      out.push({
        pair,
        atrAbs: atrVal,
        atrPct: (atrVal / price) * 100,
      });
    }

    return out.sort((a, b) => b.atrPct - a.atrPct);
  }, [allCandles, prices]);

  if (rows.length < 5) return null;

  const maxPct = rows[0].atrPct;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-3">
      <div className="mb-2">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          📊 {t("piyasa.volatilityRank.title")}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r, i) => {
          const barW = (r.atrPct / maxPct) * 100;
          const color =
            i === 0
              ? "bg-amber-400/70"
              : r.atrPct > maxPct * 0.6
              ? "bg-blue-400/60"
              : "bg-border/50";

          return (
            <div key={r.pair} className="flex items-center gap-2 font-mono text-xs">
              <span className="text-text-t4 w-4 text-right tabular-nums text-2xs">{i + 1}</span>
              <span className="text-text-t2 font-semibold w-10 shrink-0">{r.pair}</span>
              <div className="flex-1 h-1.5 rounded-full bg-border/20 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${barW}%` }} />
              </div>
              <span className="text-text-t3 w-12 text-right tabular-nums">
                {r.atrPct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-text-t4 font-mono text-2xs mt-2">{t("piyasa.volatilityRank.desc")}</p>
    </div>
  );
}
