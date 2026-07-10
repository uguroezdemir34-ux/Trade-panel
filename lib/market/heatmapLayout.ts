import type { ScoreResult } from "@/lib/score/orchestrator";
import type { Pair } from "@/lib/constants/pairs";

/**
 * ISI HARİTASI (HEATMAP/TREEMAP) LAYOUT — 24 coin evreninin skor+yön
 * özetini tek bir grid'de görselleştirmek için saf hesap.
 *
 * D3/d3-hierarchy gibi bir treemap kütüphanesi eklenmedi (CLAUDE.md
 * "gereksiz bağımlılık ekleme" prensibi) — 24 sabit eleman için tam
 * rectangle-packing algoritması yerine basit bir "flex-grow ağırlıklı grid"
 * yeterli: her hücrenin `weight`'i CSS flex-grow olarak kullanılır, tarayıcı
 * satır içi orantılı boyutlandırmayı kendisi yapar. Gerçek squarified
 * treemap'e göre daha az hassas ama 24 eleman için görsel fark ihmal
 * edilebilir, bakım yükü çok daha düşük.
 *
 * Saf türetme — results[pair]'den okur, skor motoruna hiç dokunmaz.
 * Geçerli sonuç yoksa null (diğer Görev'lerdeki disiplinle aynı).
 */

export interface HeatmapCell {
  pair: Pair;
  score: number;
  verdict: ScoreResult["verdict"];
  direction: ScoreResult["direction"];
  /** CSS flex-grow için ağırlık — büyük skor daha büyük hücre */
  weight: number;
  /** Theme-aware Tailwind class'ları (text + bg) */
  colorClass: string;
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

export function computeHeatmapCells(
  results: Partial<Record<Pair, ScoreResult | null | undefined>>,
): HeatmapCell[] | null {
  const valid = Object.entries(results).filter(
    (entry): entry is [Pair, ScoreResult] => entry[1] != null,
  );
  if (valid.length === 0) return null;

  const cells = valid.map(([pair, result]) => ({
    pair,
    score: result.score,
    verdict: result.verdict,
    direction: result.direction,
    // Min 1 — skoru 0 olan bir coin de görünür kalsın, tamamen kaybolmasın
    weight: Math.max(1, result.score),
    colorClass: colorClassFor(result),
  }));

  return cells.sort((a, b) => b.score - a.score);
}
