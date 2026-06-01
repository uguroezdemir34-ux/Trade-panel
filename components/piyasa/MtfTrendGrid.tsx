"use client";

/**
 * MTF TREND GRID — Tüm pair'ler için çok-zaman-dilimli yön matrisi.
 *
 * 15 pair desteği: results map'ten dinamik olarak render eder.
 * Kompakt tablo: pair | 1H | 4H | 1D | Score | sınıf
 */

import { useT } from "@/lib/i18n/context";
import type { MtfTrendResult, MtfClass, TrendDirection } from "@/lib/market/mtfTrend";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useScoreStore } from "@/lib/store/scoreStore";

interface Props {
  results: Partial<Record<Pair, MtfTrendResult>>;
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

export function MtfTrendGrid({ results }: Props): React.ReactElement {
  const t = useT();
  const scoreResults = useScoreStore((s) => s.results);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-3">
      <h3 className="text-text-t3 mb-2 font-mono text-2xs tracking-widest uppercase">
        {t("piyasa.mtf.title")}
      </h3>

      {/* Header */}
      <div className="mb-0.5 grid grid-cols-[44px_1fr_1fr_1fr_32px_60px] gap-x-1 px-1">
        <span />
        {(["1h", "4h", "1d"] as const).map((tf) => (
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
          const cls: MtfClass = result?.cls ?? "no_data";
          const scoreResult = scoreResults[pair];
          const score = scoreResult?.score;
          const verdict = scoreResult?.verdict;
          const scoreColor = verdict === "go" ? "text-green-400" : verdict === "wait" ? "text-yellow-400" : verdict === "no" ? "text-red-400/70" : "text-text-t4";

          return (
            <div
              key={pair}
              className="grid grid-cols-[44px_1fr_1fr_1fr_32px_60px] items-center gap-x-1 py-0.5 px-1"
            >
              <span className="text-text-t2 font-mono text-xs font-semibold">{pair}</span>

              {(["1h", "4h", "1d"] as const).map((tf) => {
                const tr = result?.trends.find((x) => x.tf === tf);
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
