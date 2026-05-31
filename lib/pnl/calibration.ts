/**
 * CALIBRATION STATS — TradeSnapshot listesinden skor ve bağlam analizi.
 *
 * Skor bucket'ları, yön/çift performansı, exit dağılımı, macro korelasyon.
 * EntryContext yalnızca toplam skoru sakladığından kriter bazlı analiz yoktur.
 */

import type { TradeSnapshot } from "@/lib/trades/types";

// ═══════════════ TYPES ═══════════════

export interface ScoreBucket {
  label: string;
  minScore: number;
  maxScore: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgPnlUsd: number;
  totalPnlUsd: number;
  avgRMultiple: number | null;
}

export interface SegmentStats {
  label: string;
  tradeCount: number;
  winCount: number;
  winRate: number;
  avgPnlUsd: number;
  totalPnlUsd: number;
}

export interface ExitBucket {
  reason: string;
  count: number;
  pct: number;
  avgPnlUsd: number;
}

export interface FgZone {
  label: string;
  minVal: number;
  maxVal: number;
  tradeCount: number;
  winRate: number;
  avgPnlUsd: number;
}

export interface CalibrationStats {
  totalTrades: number;
  scoreBuckets: ScoreBucket[];
  directionStats: SegmentStats[];
  pairStats: SegmentStats[];
  exitBuckets: ExitBucket[];
  fgZones: FgZone[];
  counterTrendStats: SegmentStats[];
  avgRMultiple: number | null;
  positiveRCount: number;
  positiveRPct: number;
}

// ═══════════════ HELPERS ═══════════════

function bucketTrades(
  trades: TradeSnapshot[],
  minScore: number,
  maxScore: number,
): TradeSnapshot[] {
  return trades.filter(
    (t) => t.entryContext.score >= minScore && t.entryContext.score <= maxScore,
  );
}

function segStats(
  trades: TradeSnapshot[],
  label: string,
): SegmentStats {
  const wins = trades.filter((t) => (t.exit?.pnlUsd ?? 0) > 0);
  const totalPnl = trades.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);
  return {
    label,
    tradeCount: trades.length,
    winCount: wins.length,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    avgPnlUsd: trades.length > 0 ? totalPnl / trades.length : 0,
    totalPnlUsd: totalPnl,
  };
}

// ═══════════════ MAIN FUNCTION ═══════════════

export function computeCalibrationStats(
  snapshots: readonly TradeSnapshot[],
): CalibrationStats {
  const closed = snapshots.filter(
    (t) => t.status === "closed" && t.exit != null,
  ) as TradeSnapshot[];

  const totalTrades = closed.length;

  // ── Score Buckets ──
  const BUCKET_DEFS: { label: string; min: number; max: number }[] = [
    { label: "<80", min: 0, max: 79 },
    { label: "80–84", min: 80, max: 84 },
    { label: "85–89", min: 85, max: 89 },
    { label: "90–94", min: 90, max: 94 },
    { label: "95+", min: 95, max: 200 },
  ];

  const scoreBuckets: ScoreBucket[] = BUCKET_DEFS.map(({ label, min, max }) => {
    const group = bucketTrades(closed, min, max);
    const wins = group.filter((t) => (t.exit?.pnlUsd ?? 0) > 0);
    const totalPnl = group.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);
    const rValues = group
      .map((t) => t.exit?.rMultiple)
      .filter((r): r is number => r != null);
    const avgR = rValues.length > 0
      ? rValues.reduce((a, b) => a + b, 0) / rValues.length
      : null;

    return {
      label,
      minScore: min,
      maxScore: max,
      tradeCount: group.length,
      winCount: wins.length,
      lossCount: group.length - wins.length,
      winRate: group.length > 0 ? wins.length / group.length : 0,
      avgPnlUsd: group.length > 0 ? totalPnl / group.length : 0,
      totalPnlUsd: totalPnl,
      avgRMultiple: avgR,
    };
  });

  // ── Direction Stats ──
  const directionStats: SegmentStats[] = ["LONG", "SHORT"].map((dir) =>
    segStats(
      closed.filter((t) => t.direction === dir),
      dir,
    ),
  );

  // ── Pair Stats ──
  const pairs = [...new Set(closed.map((t) => t.pair))].sort();
  const pairStats: SegmentStats[] = pairs.map((p) =>
    segStats(closed.filter((t) => t.pair === p), p),
  );

  // ── Exit Distribution ──
  const EXIT_REASONS = ["tp1", "tp2", "sl", "manual", "trail"] as const;
  const exitBuckets: ExitBucket[] = EXIT_REASONS.map((reason) => {
    const group = closed.filter((t) => t.exit?.reason === reason);
    const totalPnl = group.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);
    return {
      reason,
      count: group.length,
      pct: totalTrades > 0 ? group.length / totalTrades : 0,
      avgPnlUsd: group.length > 0 ? totalPnl / group.length : 0,
    };
  }).filter((b) => b.count > 0);

  // ── F&G Zones ──
  const FG_ZONES: { label: string; min: number; max: number }[] = [
    { label: "Ext. Fear (<25)", min: 0, max: 24 },
    { label: "Fear (25–45)", min: 25, max: 45 },
    { label: "Neutral (46–55)", min: 46, max: 55 },
    { label: "Greed (56–75)", min: 56, max: 75 },
    { label: "Ext. Greed (>75)", min: 76, max: 100 },
  ];

  const fgZones: FgZone[] = FG_ZONES.map(({ label, min, max }) => {
    const group = closed.filter(
      (t) =>
        t.entryContext.fgValue != null &&
        t.entryContext.fgValue >= min &&
        t.entryContext.fgValue <= max,
    );
    const wins = group.filter((t) => (t.exit?.pnlUsd ?? 0) > 0);
    const totalPnl = group.reduce((s, t) => s + (t.exit?.pnlUsd ?? 0), 0);
    return {
      label,
      minVal: min,
      maxVal: max,
      tradeCount: group.length,
      winRate: group.length > 0 ? wins.length / group.length : 0,
      avgPnlUsd: group.length > 0 ? totalPnl / group.length : 0,
    };
  }).filter((z) => z.tradeCount > 0);

  // ── Counter-trend ──
  const counterTrendStats: SegmentStats[] = [
    segStats(closed.filter((t) => t.entryContext.counterTrend === true), "Counter-Trend"),
    segStats(closed.filter((t) => t.entryContext.counterTrend !== true), "With-Trend"),
  ].filter((s) => s.tradeCount > 0);

  // ── R-Multiple ──
  const rVals = closed
    .map((t) => t.exit?.rMultiple)
    .filter((r): r is number => r != null);
  const avgRMultiple =
    rVals.length > 0 ? rVals.reduce((a, b) => a + b, 0) / rVals.length : null;
  const positiveRCount = rVals.filter((r) => r > 0).length;
  const positiveRPct = rVals.length > 0 ? positiveRCount / rVals.length : 0;

  return {
    totalTrades,
    scoreBuckets,
    directionStats,
    pairStats,
    exitBuckets,
    fgZones,
    counterTrendStats,
    avgRMultiple,
    positiveRCount,
    positiveRPct,
  };
}
