"use client";

import { useEffect } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { PAIRS } from "@/lib/constants/pairs";

/**
 * Records each score computation into the rolling history store.
 * Mounts once in AppShell alongside useScoreEngine.
 */
export function useScoreHistory(): void {
  const computedAt = useScoreStore((s) => s.computedAt);
  const results = useScoreStore((s) => s.results);
  const addSnapshot = useScoreHistoryStore((s) => s.addSnapshot);

  useEffect(() => {
    for (const pair of PAIRS) {
      const ts = computedAt[pair];
      const result = results[pair];
      if (!ts || !result) continue;
      addSnapshot(pair, {
        score: result.score,
        verdict: result.verdict,
        direction: result.direction,
        ts,
      });
    }
  }, [computedAt, results, addSnapshot]);
}
