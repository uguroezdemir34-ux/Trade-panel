"use client";

/**
 * SQUEEZE RADAR BANNER — volatilite sıkışması gösteren coinlerin listesi.
 *
 * scoreStore'a hiç dokunmaz, sadece candleStore'daki 1h mumlardan türetir
 * (allResults/allTicks gibi mevcut bileşenlerin okuduğu diğer store'larla
 * aynı "tüm map'i oku, useMemo'da filtrele" deseni — bkz. goPairs/
 * marketPulseIndex). useScoreEngine'e hiç dokunmaz.
 */

import { useMemo } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import { useT } from "@/lib/i18n/context";
import { computeSqueezeRadar } from "@/lib/market/squeezeRadar";

export function SqueezeRadarBanner(): React.ReactElement | null {
  const t = useT();
  const allCandles = useCandleStore((s) => s.candles);

  const entries = useMemo(() => computeSqueezeRadar(allCandles), [allCandles]);

  if (entries.length === 0) return null;

  return (
    <div
      className="border-border bg-bg-card/40 flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs"
      title={t("karar.squeezeRadarDesc")}
    >
      <span className="text-text-t3 shrink-0 text-2xs tracking-widest uppercase">
        {t("karar.squeezeRadarLabel")}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map((e) => (
          <span key={e.pair} className="text-text-t2">
            <span className="font-bold">{e.pair}</span>{" "}
            <span className="text-text-t4">P{e.percentile}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
