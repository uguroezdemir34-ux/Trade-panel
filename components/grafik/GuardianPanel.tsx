"use client";

/**
 * GUARDIAN PANEL — War Room overlay'inin C bileşeni.
 *
 * QX Score ring'i (ScoreRingV2, aynen /karar'daki gibi) + mevcut sinyalleri
 * (verdict, regimeCombiner, flow.humanSummary) TEK bir insan-okur cümlede
 * birleştiren salt metinsel bir özet. Hiçbir yeni skor/hesaplama mantığı
 * YOK — lib/score/* burada SADECE zaten var olan ScoreResult alanlarını
 * okumak için, regimeCombiner.ts ve indikatör fonksiyonları /karar
 * sayfasındaki AYNI, onaylanmış Faz 3 deseniyle çağrılıyor (bkz.
 * app/karar/page.tsx satır ~484-506) — burada tekrar edilmesinin sebebi
 * bu panelin /karar'dan bağımsız, kendi candle aboneliğiyle çalışması.
 */

import { useMemo } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useFlowIntelligence } from "@/lib/hooks/useFlowIntelligence";
import { adx } from "@/lib/indicators/adx";
import { bb } from "@/lib/indicators/bb";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { computeDisplayTrends } from "@/lib/market/mtfTrend";
import {
  classifyTrendRegime,
  classifyVolRegime,
  type TrendRegimeLabel,
} from "@/lib/market/regimeCombiner";
import type { AtrRegime } from "@/lib/indicators/atr-percentile";
import { ScoreRingV2 } from "@/components/karar/ScoreRingV2";
import { VerdictBadge } from "@/components/karar/VerdictBadge";
import { useT } from "@/lib/i18n/context";
import type { Pair } from "@/lib/constants/pairs";

/** app/karar/page.tsx'teki AYNI eşleme — regimeCombiner.ts'in i18n key'leri. */
const TREND_REGIME_LABEL_KEY: Record<TrendRegimeLabel, string> = {
  trending_strong: "karar.regimeTrendStrong",
  trending_weak: "karar.regimeTrendWeak",
  ranging_meanrev: "karar.regimeTrendRangingMR",
  ranging: "karar.regimeTrendRanging",
  transitioning: "karar.regimeTrendTransition",
  mixed: "karar.regimeTrendMixed",
  unknown: "karar.regimeTrendUnknown",
};
const VOL_REGIME_LABEL_KEY: Record<AtrRegime, string> = {
  compression: "karar.regimeVolCompression",
  normal: "karar.regimeVolNormal",
  expansion: "karar.regimeVolExpansion",
  extreme_expansion: "karar.regimeVolExtreme",
};

interface Props {
  pair: Pair;
}

export function GuardianPanel({ pair }: Props): React.ReactElement | null {
  const t = useT();
  const result = useScoreStore((s) => s.results[pair]);
  const candles1hRaw = useCandleStore((s) => s.candles[`${pair}_1h`]);
  const candles1h = candles1hRaw ?? EMPTY_CANDLES;
  // 15m/4h/1d — SADECE 4 zamanlı ok dizisi için (görüntü amaçlı,
  // computeDisplayTrends). computeMtfTrend()'e / score engine'e hiç
  // girmiyor — bu panel zaten hiçbir MTF gate hesabı yapmıyordu, bu
  // sadece market kartlarındaki 15M/1H/4H/1D okunun /grafik'teki
  // karşılığı (bkz. lib/market/mtfTrend.ts computeDisplayTrends yorumu).
  const candles15m = useCandleStore((s) => s.candles[`${pair}_15m`]) ?? EMPTY_CANDLES;
  const candles4h = useCandleStore((s) => s.candles[`${pair}_4h`]) ?? EMPTY_CANDLES;
  const candles1d = useCandleStore((s) => s.candles[`${pair}_1d`]) ?? EMPTY_CANDLES;
  const mtfDisplayTrends = useMemo(
    () => (candles1h.length >= 20 ? computeDisplayTrends(candles15m, candles1h, candles4h, candles1d) : null),
    [candles15m, candles1h, candles4h, candles1d],
  );

  const signalDir: "LONG" | "SHORT" = result?.direction === "SHORT" ? "SHORT" : "LONG";
  const flowResult = useFlowIntelligence(pair, signalDir);

  const adxValue = useMemo(() => {
    try {
      if (candles1h.length < 29) return null;
      return adx(candles1h.map(toIndicatorCandle), 14)?.adx ?? null;
    } catch { return null; }
  }, [candles1h]);

  const bbPctValue = useMemo(() => {
    try {
      return bb(candles1h.map((c) => c.close), { period: 20 })?.pct ?? null;
    } catch { return null; }
  }, [candles1h]);

  const trendRegimeLabel = useMemo(
    () =>
      classifyTrendRegime({
        adx: adxValue,
        dirConfidence: result?.dirConfidence ?? 0,
        counterTrend: result?.counterTrend ?? false,
        bbPct: bbPctValue,
        direction: result?.direction ?? "NEUTRAL",
      }),
    [adxValue, bbPctValue, result?.dirConfidence, result?.counterTrend, result?.direction],
  );

  const volRegimeResult = useMemo(() => classifyVolRegime(candles1h), [candles1h]);

  if (!result) {
    return (
      <div className="rounded-lg border border-border/50 bg-surface-s1 px-3 py-2 font-mono text-2xs text-text-t4">
        {t("karar.scoreUnavailable")}
      </div>
    );
  }

  const trendLabel = t(TREND_REGIME_LABEL_KEY[trendRegimeLabel]);
  const volLabel = volRegimeResult ? t(VOL_REGIME_LABEL_KEY[volRegimeResult.label]) : "—";
  const summary = [
    t(`verdict.${result.verdict}`),
    `${result.direction} (${result.dirConfidence}/3)`,
    `${trendLabel} · ${volLabel}`,
    flowResult?.humanSummary,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-s1 px-3 py-2">
      {/* Ring + 15M/1H/4H/1D oku aynı dikey grup içinde — ok dizisi
          halkanın merkezini ortalayacak şekilde altında durur. Renkler
          market kartlarındaki (app/karar/page.tsx) AYNI sabit hex'ler —
          doygun yeşil/kırmızı, her iki temada da yeterli kontrast. */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <ScoreRingV2 score={Math.round(result.score)} goThreshold={result.goThreshold} size={44} id={`guardian-${pair}`} />
        {mtfDisplayTrends && (
          <div className="flex gap-1.5">
            {mtfDisplayTrends.map((tf) => (
              <span key={tf.tf} className="flex flex-col items-center" style={{ gap: "1px" }}>
                <span className="text-2xs font-mono uppercase tracking-wider text-text-t2/70 leading-none">
                  {tf.tf}
                </span>
                <span
                  className={`text-[10px] font-mono leading-none ${
                    tf.direction === "up"
                      ? "text-[#22c55e]"
                      : tf.direction === "down"
                        ? "text-[#ef4444]/80"
                        : "text-text-t2/50"
                  }`}
                >
                  {tf.direction === "up" ? "▲" : tf.direction === "down" ? "▼" : "─"}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 min-w-0 flex-col gap-1">
        <VerdictBadge verdict={result.verdict} />
        <p className="font-mono text-2xs text-text-t3 leading-snug break-words">
          {summary}
        </p>
      </div>
    </div>
  );
}
