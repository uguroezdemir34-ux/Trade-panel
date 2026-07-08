import type { ScoreSnapshot } from "@/lib/store/scoreHistoryStore";

export interface ScoreVelocity {
  delta: number;
  windowMin: number;
  /** Gerçek geçen süre (dk) — snapshot cadence'i düzensiz olabileceğinden windowMin'den farklı olabilir */
  actualMin: number;
}

const MS_PER_MIN = 60_000;

/**
 * snaps zaman sırasına göre artan (eski→yeni) olmalı — scoreHistoryStore garantisi.
 * windowMin içindeki en eski snapshot ile son snapshot arasındaki skor farkını döndürür.
 * Snapshot cadence'i skor motoruna bağlı (~15dk, candle kapanışı tetikler) ve sabit değil,
 * bu yüzden pencere snapshot sayısı yerine zaman damgasıyla (ts) belirlenir.
 */
export function computeScoreVelocity(
  snaps: ScoreSnapshot[] | undefined,
  windowMin: number,
): ScoreVelocity | null {
  if (!snaps || snaps.length < 2) return null;
  const latest = snaps[snaps.length - 1];
  const cutoff = latest.ts - windowMin * MS_PER_MIN;

  let base = snaps[0];
  for (const s of snaps) {
    if (s.ts >= cutoff) {
      base = s;
      break;
    }
  }
  if (base.ts === latest.ts) return null;

  return {
    delta: latest.score - base.score,
    windowMin,
    actualMin: Math.round((latest.ts - base.ts) / MS_PER_MIN),
  };
}
