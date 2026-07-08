"use client";

import { useMemo } from "react";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { computeScoreVelocity, type ScoreVelocity } from "@/lib/score/velocity";
import type { Pair } from "@/lib/constants/pairs";

/**
 * Tek bir parite için skor hızı (velocity). Salt-okunur — scoreHistoryStore'u
 * okur, hiçbir şeye yazmaz. Skor motorunu (useScoreEngine) tetiklemez;
 * yalnızca zaten hesaplanmış geçmiş üzerinde türetilmiş değer üretir.
 */
export function useScoreVelocity(pair: Pair, windowMin: number): ScoreVelocity | null {
  const snaps = useScoreHistoryStore((s) => s.history[pair]);
  return useMemo(() => computeScoreVelocity(snaps, windowMin), [snaps, windowMin]);
}
