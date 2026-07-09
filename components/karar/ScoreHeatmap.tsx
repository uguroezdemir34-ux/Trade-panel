"use client";

/**
 * SCORE HEATMAP — 24 coin'in skor+yön özetini tek grid'de gösterir.
 *
 * Tetiklenme: sadece scoreStore.results değiştiğinde (yani zaten
 * useScoreEngine'in candle-close cadence'inde) — sürekli animasyon yok,
 * statik bir görselleştirme.
 *
 * Performans kısıtı (bilinçli, Görsel Kalite Paketi araştırmasının sonucu
 * — bkz. CLAUDE.md §9): hesaplama render'ın senkron yolunda değil,
 * requestIdleCallback'e (setTimeout(0) fallback — useScoreEngine.ts'teki
 * yieldToEventLoop ile aynı desen) ertelenmiş bir effect içinde çalışır.
 * Bu, useScoreEngine'in kendi per-pair döngüsündeki yield noktalarıyla
 * aynı tick'te çakışıp ana thread'i birlikte meşgul etme riskini azaltır.
 *
 * Saf hesaplama lib/market/heatmapLayout.ts'te — bu component sadece
 * zamanlama + render. useScoreEngine/orchestrator'a hiç dokunmaz.
 */

import { useEffect, useState } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { computeHeatmapCells, type HeatmapCell } from "@/lib/market/heatmapLayout";
import type { Pair } from "@/lib/constants/pairs";

function scheduleIdle(cb: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => cb(), { timeout: 200 });
  } else {
    setTimeout(cb, 0);
  }
}

interface ScoreHeatmapProps {
  onSelect: (pair: Pair) => void;
}

export function ScoreHeatmap({ onSelect }: ScoreHeatmapProps): React.ReactElement | null {
  const allResults = useScoreStore((s) => s.results);
  const [cells, setCells] = useState<HeatmapCell[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    scheduleIdle(() => {
      if (cancelled) return;
      setCells(computeHeatmapCells(allResults));
    });
    return () => {
      cancelled = true;
    };
  }, [allResults]);

  if (!cells || cells.length === 0) return null;

  return (
    <div className="border-border bg-bg-card/40 flex flex-wrap gap-1 rounded-lg border p-2">
      {cells.map((cell) => (
        <button
          key={cell.pair}
          onClick={() => onSelect(cell.pair)}
          style={{ flexGrow: cell.weight, flexBasis: "64px" }}
          className={`min-w-[64px] rounded px-2 py-3 text-center font-mono text-[10px] transition-colors ${cell.colorClass}`}
        >
          <div className="font-bold">{cell.pair}</div>
          <div className="text-[9px] opacity-80">{cell.score}</div>
        </button>
      ))}
    </div>
  );
}
