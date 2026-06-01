"use client";

/**
 * CORRELATION WARNING — Warns when a new trade would be correlated with open positions.
 *
 * Appears above PositionSizer when verdict=GO and there's an existing position
 * in a pair with Pearson correlation ≥ 0.70 in the same direction.
 *
 * Uses last 30 daily candles for correlation computation.
 */

import { useMemo } from "react";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { dailyReturns, pearson } from "@/lib/market/correlation";
import type { Pair } from "@/lib/constants/pairs";

const CORR_THRESHOLD = 0.70;
const WINDOW = 30;

interface Props {
  pair: Pair;
  direction: "LONG" | "SHORT";
}

export function CorrelationWarning({ pair, direction }: Props): React.ReactElement | null {
  const allCandles = useCandleStore((s) => s.candles);
  const positions = usePositionStore((s) => s.positions);

  const warnings = useMemo(() => {
    const newCandles = allCandles[`${pair}_1d`] ?? EMPTY_CANDLES;
    if (newCandles.length < 8) return [];

    const newCloses = newCandles.slice(-WINDOW - 1).map((c) => c.close);
    const newRet = dailyReturns(newCloses);

    const out: { posPair: string; corr: number; dir: string }[] = [];

    for (const pos of positions) {
      if (pos.pair === pair) continue; // same pair — already blocked elsewhere

      const posCandles = allCandles[`${pos.pair}_1d`] ?? EMPTY_CANDLES;
      if (posCandles.length < 8) continue;

      const posCloses = posCandles.slice(-WINDOW - 1).map((c) => c.close);
      const posRet = dailyReturns(posCloses);

      const r = pearson(newRet, posRet);
      if (r === null || r < CORR_THRESHOLD) continue;

      // Only warn when both trades go in the same direction (compound risk)
      if (pos.direction !== direction) continue;

      out.push({ posPair: pos.pair, corr: r, dir: pos.direction });
    }

    return out;
  }, [pair, direction, allCandles, positions]);

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-400 text-sm shrink-0">⚠</span>
        <div>
          <div className="text-amber-400 font-mono text-xs font-semibold">
            Yüksek Korelasyon Uyarısı
          </div>
          <div className="text-amber-300/80 font-mono text-2xs mt-0.5 leading-relaxed">
            {warnings.map((w, i) => (
              <span key={i}>
                {w.posPair} ile {(w.corr * 100).toFixed(0)}% korelasyon ({w.dir}).{" "}
              </span>
            ))}
            İki işlem aynı yönde hareket ederek riski artırabilir.
          </div>
        </div>
      </div>
    </div>
  );
}
