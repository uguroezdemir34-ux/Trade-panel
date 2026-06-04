/**
 * PATTERN DISCOVERY — Backtest verisiyle istatistiksel örüntüler bulur.
 *
 * Analiz boyutları:
 *   - Skor aralığı (50-60, 60-70, 70-80, 80-90, 90+)
 *   - Yön (LONG / SHORT / ALL)
 *
 * Çıktı: Her kombinasyon için win rate, avg R, EV, çıkış dağılımı.
 * Min 3 trade şartı: az trade'li bucket'lar gürültülü olur.
 *
 * Skor motoru değişmez — salt analiz aracıdır.
 */

import type { BacktestTrade } from "@/lib/backtest/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PatternRow {
  scoreBucket: string;          // "60–70" gibi
  scoreMin: number;
  scoreMax: number;
  direction: "LONG" | "SHORT" | "ALL";
  n: number;
  winRate: number | null;
  avgR: number | null;
  avgNetPnlPct: number | null;
  evR: number | null;           // EV in R-multiples
  tp1Rate: number | null;       // TP1'de kapananların oranı
  tp2Rate: number | null;
  slRate: number | null;
  timeoutRate: number | null;
}

// ─── Bucket definitions ───────────────────────────────────────────────────────

const BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "50–60", min: 50, max: 60 },
  { label: "60–70", min: 60, max: 70 },
  { label: "70–80", min: 70, max: 80 },
  { label: "80–90", min: 80, max: 90 },
  { label: "90+",   min: 90, max: 101 },
];

const MIN_TRADES_PER_BUCKET = 3;

// ─── Main function ────────────────────────────────────────────────────────────

export function discoverPatterns(trades: BacktestTrade[]): PatternRow[] {
  if (trades.length === 0) return [];

  const rows: PatternRow[] = [];

  for (const bucket of BUCKETS) {
    // ALL directions row
    const allRow = computeRow(trades, bucket, "ALL");
    if (allRow.n >= MIN_TRADES_PER_BUCKET) rows.push(allRow);

    // Direction-split rows (only if enough trades)
    const longRow  = computeRow(trades, bucket, "LONG");
    const shortRow = computeRow(trades, bucket, "SHORT");
    if (longRow.n >= MIN_TRADES_PER_BUCKET)  rows.push(longRow);
    if (shortRow.n >= MIN_TRADES_PER_BUCKET) rows.push(shortRow);
  }

  return rows;
}

/** Compute pattern stats for a specific bucket + direction combo */
function computeRow(
  trades: BacktestTrade[],
  bucket: { label: string; min: number; max: number },
  direction: "LONG" | "SHORT" | "ALL",
): PatternRow {
  const filtered = trades.filter(
    (t) =>
      t.score >= bucket.min &&
      t.score < bucket.max &&
      (direction === "ALL" || t.direction === direction),
  );

  if (filtered.length === 0) {
    return {
      scoreBucket: bucket.label,
      scoreMin: bucket.min,
      scoreMax: bucket.max,
      direction,
      n: 0,
      winRate: null,
      avgR: null,
      avgNetPnlPct: null,
      evR: null,
      tp1Rate: null,
      tp2Rate: null,
      slRate: null,
      timeoutRate: null,
    };
  }

  const wins   = filtered.filter((t) => t.rMultiple > 0);
  const losses = filtered.filter((t) => t.rMultiple <= 0);
  const winRate  = wins.length / filtered.length;
  const lossRate = losses.length / filtered.length;

  const avgR = filtered.reduce((s, t) => s + t.rMultiple, 0) / filtered.length;

  const avgNetPnlPct =
    filtered.reduce((s, t) => s + (t.netPnlPct ?? t.pnlPct), 0) / filtered.length;

  // EV in R
  const avgWinR  = wins.length > 0  ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
  const avgLossR = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.rMultiple), 0) / losses.length : 0;
  const evR = winRate * avgWinR - lossRate * avgLossR;

  const tp1Rate     = filtered.filter((t) => t.exitReason === "tp1").length / filtered.length;
  const tp2Rate     = filtered.filter((t) => t.exitReason === "tp2").length / filtered.length;
  const slRate      = filtered.filter((t) => t.exitReason === "sl").length / filtered.length;
  const timeoutRate = filtered.filter((t) => t.exitReason === "timeout").length / filtered.length;

  return {
    scoreBucket: bucket.label,
    scoreMin: bucket.min,
    scoreMax: bucket.max,
    direction,
    n: filtered.length,
    winRate,
    avgR,
    avgNetPnlPct,
    evR,
    tp1Rate,
    tp2Rate,
    slRate,
    timeoutRate,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Summarize overall win rate and EV across all patterns */
export function summarizePatterns(rows: PatternRow[]): {
  bestBucket: PatternRow | null;
  worstBucket: PatternRow | null;
  strongestEdge: number | null;
} {
  const valid = rows.filter((r) => r.evR !== null && r.n >= 5);
  if (valid.length === 0) return { bestBucket: null, worstBucket: null, strongestEdge: null };

  const best  = valid.reduce((a, b) => (b.evR! > a.evR! ? b : a));
  const worst = valid.reduce((a, b) => (b.evR! < a.evR! ? b : a));

  return {
    bestBucket: best,
    worstBucket: worst,
    strongestEdge: best.evR,
  };
}
