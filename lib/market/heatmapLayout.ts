import type { ScoreResult } from "@/lib/score/orchestrator";
import type { Pair } from "@/lib/constants/pairs";
import type { Tick } from "@/lib/ws/types";

/**
 * ISI HARİTASI (HEATMAP) LAYOUT — 24 coin evreninin skor+yön özetini tek
 * bir grid'de görselleştirmek için saf hesap.
 *
 * Bölüm 2 (Bloomberg Terminal düzeni): hacme göre ilk 3 pair "large" (2×2
 * Bloomberg-tarzı hücre, tam 3 katmanlı görünüm — isim+fiyat/skor/%chg),
 * kalan 21 pair "normal" (kompakt PAIR+skor, %chg sadece ok/renk rozeti).
 * Kalan hücreler önceki gibi skora göre sıralı — bu davranış zaten vardı,
 * değişmedi.
 *
 * D3/d3-hierarchy gibi bir treemap kütüphanesi hâlâ yok (CLAUDE.md
 * "gereksiz bağımlılık ekleme" prensibi) — CSS Grid'in kendi span/dense
 * paketleme mekanizması yeterli (bkz. ScoreHeatmap.tsx).
 *
 * Saf türetme — results[pair] (scoreStore) ve tick'ler (marketStore,
 * useMarketStream'in WS akışından — useScoreEngine'den TAMAMEN bağımsız)
 * okunur, skor motoruna hiç dokunulmaz. Geçerli sonuç yoksa null.
 */

export interface HeatmapCell {
  pair: Pair;
  score: number;
  verdict: ScoreResult["verdict"];
  direction: ScoreResult["direction"];
  /** Theme-aware Tailwind class'ları (text + bg) */
  colorClass: string;
  /** "large" = hacme göre ilk 3 (2×2 Bloomberg hücresi), "normal" = geri kalan */
  size: "large" | "normal";
  /** Sadece "large" hücrelerde gösterilir — tick yoksa null, sorun değil */
  price: number | null;
  chg: number | null;
}

function colorClassFor(result: ScoreResult): string {
  if (result.verdict === "go" && result.direction === "LONG") {
    return "text-signal-green bg-soft-green";
  }
  if (result.verdict === "go" && result.direction === "SHORT") {
    return "text-signal-red bg-soft-red";
  }
  if (result.direction === "LONG") return "text-signal-green/70 bg-soft-green/50";
  if (result.direction === "SHORT") return "text-signal-red/70 bg-soft-red/50";
  // "heatmap-cell-neutral" — sadece cyber-terminal temasında kontrast artırımı
  // hedefi (bkz. globals.css), diğer temalarda ek bir etkisi yok.
  return "text-text-t3 bg-text-t3/10 heatmap-cell-neutral";
}

/**
 * Skor sayısı için text-shadow glow rengi — colorClassFor() ile AYNI
 * verdict/direction dallanmasını kullanır ama dolgu/renk class'ına hiç
 * dokunmaz, sadece "large" hücrelerde tüketilecek ayrı bir görsel katman
 * (bkz. ScoreHeatmap.tsx). colorClassFor()'un kendisi değiştirilmedi.
 */
export function glowShadowFor(
  verdict: ScoreResult["verdict"],
  direction: ScoreResult["direction"],
): string | undefined {
  if (verdict === "go" && direction === "LONG") return "0 0 10px rgba(34, 197, 94, 0.55)";
  if (verdict === "go" && direction === "SHORT") return "0 0 10px rgba(239, 68, 68, 0.55)";
  if (direction === "LONG") return "0 0 8px rgba(34, 197, 94, 0.35)";
  if (direction === "SHORT") return "0 0 8px rgba(239, 68, 68, 0.35)";
  return undefined;
}

const LARGE_CELL_COUNT = 3;

export function computeHeatmapCells(
  results: Partial<Record<Pair, ScoreResult | null | undefined>>,
  ticksByPair: Partial<Record<Pair, Tick>> = {},
): HeatmapCell[] | null {
  const valid = Object.entries(results).filter(
    (entry): entry is [Pair, ScoreResult] => entry[1] != null,
  );
  if (valid.length === 0) return null;

  const topVolumePairs = new Set(
    valid
      .map(([pair]) => pair)
      .filter((pair) => (ticksByPair[pair]?.vol24h ?? 0) > 0)
      .sort((a, b) => (ticksByPair[b]?.vol24h ?? 0) - (ticksByPair[a]?.vol24h ?? 0))
      .slice(0, LARGE_CELL_COUNT),
  );

  const cells = valid.map(([pair, result]) => {
    const tick = ticksByPair[pair];
    return {
      pair,
      score: result.score,
      verdict: result.verdict,
      direction: result.direction,
      colorClass: colorClassFor(result),
      size: (topVolumePairs.has(pair) ? "large" : "normal") as "large" | "normal",
      price: tick?.last ?? null,
      chg: tick?.chg ?? null,
    };
  });

  return cells.sort((a, b) => b.score - a.score);
}
