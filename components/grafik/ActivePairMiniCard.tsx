"use client";

/**
 * ACTIVE PAIR MINI CARD — War Room overlay'i için GuardianPanel altına
 * eklenen kompakt mini kart (3'lü yatay kaydırılabilir şeridin tek bir
 * kartı — bkz. app/grafik/page.tsx). app/karar/page.tsx'in 9-grid pair
 * kartlarındaki AYNI veri kaynaklarının (QX halkası + 1H/4H/1D yön
 * okları + fiyat) kompakt bir özeti — ama o ~215 satırlık inline JSX
 * bloğu (allResults/allTicks/mtfResults gibi çevre closure'larına sıkı
 * bağlı, ayrı bir reusable component olarak var olmuyor) buraya
 * taşınmadı/çıkarılmadı. Bunun yerine, karar sayfasına HİÇ dokunmadan,
 * aynı ham veri kaynaklarını (scoreStore + marketStore +
 * computeMtfTrend) doğrudan okuyan bağımsız, küçük bir component —
 * ana karar ekranında sıfır regresyon riski.
 *
 * Layout: ScoreRingV2 üstte, 1H/4H/1D okları ALTINDA (dikey grup),
 * fiyat + parite adı bu grubun YANINDA — görev talimatındaki
 * "altına oklar, yanına fiyat" düzenine göre.
 *
 * lib/score/*'a dokunulmadı — sadece scoreStore.results[pair] (zaten
 * hesaplanmış ScoreResult) okunuyor. computeMtfTrend (lib/market/) saf,
 * skor motorunun dışında.
 */

import { useMemo } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { computeMtfTrend } from "@/lib/market/mtfTrend";
import { CoinIcon } from "@/components/karar/CoinIcon";
import { ScoreRingV2 } from "@/components/karar/ScoreRingV2";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice } from "@/lib/i18n/format";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
}

export function ActivePairMiniCard({ pair }: Props): React.ReactElement {
  const result = useScoreStore((s) => s.results[pair]);
  const tick = useMarketStore((s) => s.prices[pair]);
  const locale = useLocale();

  const candles1h = useCandleStore((s) => s.candles[`${pair}_1h`]) ?? EMPTY_CANDLES;
  const candles4h = useCandleStore((s) => s.candles[`${pair}_4h`]) ?? EMPTY_CANDLES;
  const candles1d = useCandleStore((s) => s.candles[`${pair}_1d`]) ?? EMPTY_CANDLES;

  const mtf = useMemo(
    () => computeMtfTrend(pair, candles1h, candles4h, candles1d),
    [pair, candles1h, candles4h, candles1d],
  );

  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border/50 bg-surface-s1 px-3 py-2 font-mono">
      {/* Sol grup: QX halkası üstte, 1H/4H/1D okları altında */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        {result && result.goThreshold !== undefined ? (
          <ScoreRingV2 score={Math.round(result.score)} goThreshold={result.goThreshold} size={40} id={`mini-${pair}`} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center">
            <span className="font-mono text-base text-text-t4">·</span>
          </div>
        )}
        <div className="flex gap-1.5">
          {mtf.trends.map((t) => (
            <span
              key={t.tf}
              className={`text-[9px] font-mono leading-none ${
                t.direction === "up"
                  ? "text-[#22c55e]"
                  : t.direction === "down"
                    ? "text-[#ef4444]/80"
                    : "text-text-t2/50"
              }`}
              title={t.tf.toUpperCase()}
            >
              {t.direction === "up" ? "▲" : t.direction === "down" ? "▼" : "─"}
            </span>
          ))}
        </div>
      </div>

      {/* Sağ grup: parite adı + fiyat */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <CoinIcon pair={pair} size={16} />
          <span className="text-xs font-bold text-text-t1">{pair}</span>
        </div>
        {tick?.last !== undefined ? (
          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-text-t1">
            {formatTickPrice(tick.last, locale)}
          </span>
        ) : (
          <span className="text-sm text-text-t4">—</span>
        )}
      </div>
    </div>
  );
}
