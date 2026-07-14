"use client";

/**
 * MTF TREND GRID — Tüm pair'ler için çok-zaman-dilimli yön matrisi.
 *
 * 15 pair desteği: results map'ten dinamik olarak render eder.
 * Kompakt tablo: pair | 1H | 4H | 1D | Score | sınıf
 */

import { useT } from "@/lib/i18n/context";
import type { MtfTrendResult, MtfClass, TrendDirection, TimeframeTrend } from "@/lib/market/mtfTrend";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useScoreStore } from "@/lib/store/scoreStore";

interface Props {
  results: Partial<Record<Pair, MtfTrendResult>>;
  /** 15m oku — AYRI tutuldu: results/MtfTrendResult (cls/upCount/downCount)
   *  hâlâ SADECE 1h/4h/1d'ye dayanıyor (score engine'in kendi 3-TF
   *  hesabıyla aynı, computeMtfTrend() değiştirilmedi). 15m sadece
   *  görüntülenen 4. bir sütun, sınıflandırmayı ETKİLEMİYOR. */
  trends15m?: Partial<Record<Pair, TimeframeTrend>>;
}

const CLS_COLOR: Record<MtfClass, string> = {
  strong_up:   "text-signal-green",
  up:          "text-signal-green",
  mixed:       "text-signal-amber",
  down:        "text-signal-red",
  strong_down: "text-signal-red",
  no_data:     "text-text-t4",
};

const DIR_ICON: Record<TrendDirection, string> = { up: "▲", flat: "—", down: "▼" };
const DIR_COLOR: Record<TrendDirection, string> = {
  up:   "text-signal-green",
  flat: "text-text-t3",
  down: "text-signal-red",
};

export function MtfTrendGrid({ results, trends15m }: Props): React.ReactElement {
  const t = useT();
  const scoreResults = useScoreStore((s) => s.results);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-3">
      <h3 className="text-text-t3 mb-2 font-mono text-2xs tracking-widest uppercase">
        {t("piyasa.mtf.title")}
      </h3>

      {/* Header — 15m eklendi (4 sütun), gap-x-1 → gap-x-0.5 mobilde taşmasın diye */}
      <div className="mb-0.5 grid grid-cols-[38px_1fr_1fr_1fr_1fr_32px_56px] gap-x-0.5 px-1">
        <span />
        {(["15m", "1h", "4h", "1d"] as const).map((tf) => (
          <span key={tf} className="text-text-t4 text-center font-mono text-[9px] uppercase tracking-wider">
            {t(`piyasa.mtf.tf.${tf}`)}
          </span>
        ))}
        <span className="text-text-t4 text-center font-mono text-[9px] uppercase tracking-wider">Sc</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-border/30 flex flex-col divide-y">
        {PAIRS.map((pair) => {
          const result = results[pair];
          // cls SADECE result'tan (1h/4h/1d, computeMtfTrend() değişmedi) —
          // 15m sınıflandırmaya hiç girmiyor, sadece ayrı bir görüntü sütunu.
          const cls: MtfClass = result?.cls ?? "no_data";
          const scoreResult = scoreResults[pair];
          const score = scoreResult?.score;
          const verdict = scoreResult?.verdict;
          const scoreColor = verdict === "go" ? "text-green-400" : verdict === "wait" ? "text-yellow-400" : verdict === "no" ? "text-red-400/70" : "text-text-t4";
          const tr15m = trends15m?.[pair];

          return (
            <div
              key={pair}
              className="grid grid-cols-[38px_1fr_1fr_1fr_1fr_32px_56px] items-center gap-x-0.5 py-0.5 px-1"
            >
              <span className="text-text-t2 font-mono text-xs font-semibold">{pair}</span>

              {(["15m", "1h", "4h", "1d"] as const).map((tf) => {
                const tr = tf === "15m" ? tr15m : result?.trends.find((x) => x.tf === tf);
                const dir: TrendDirection = tr?.direction ?? "flat";
                const hasData = !!(tr && tr.lastClose !== null);
                return (
                  <div key={tf} className="text-center">
                    <span className={`font-mono text-sm font-bold ${hasData ? DIR_COLOR[dir] : "text-text-t4"}`}>
                      {hasData ? DIR_ICON[dir] : "—"}
                    </span>
                  </div>
                );
              })}

              <span className={`text-center font-mono text-xs font-semibold tabular-nums ${scoreColor}`}>
                {score !== undefined ? score : "—"}
              </span>

              <span className={`truncate font-mono text-[9px] tracking-widest uppercase ${CLS_COLOR[cls]}`}>
                {t(`piyasa.mtf.cls.${cls}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
