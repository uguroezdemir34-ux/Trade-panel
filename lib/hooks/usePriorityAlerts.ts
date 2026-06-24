"use client";

import { useEffect, useRef } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useWatchlistStore } from "@/lib/store/watchlistStore";
import { browserNotify } from "@/lib/notify/browser";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { Verdict } from "@/lib/score/orchestrator";

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes — per-pair, independent of useGoAlerts

export function usePriorityAlerts(): void {
  const results = useScoreStore((s) => s.results);
  const goAlertsEnabled = useSettingsStore((s) => s.goAlertsEnabled);
  const watchlistPairs = useWatchlistStore((s) => s.pairs);

  const prevVerdicts = useRef<Partial<Record<Pair, Verdict>>>({});
  const lastFiredAt = useRef<Partial<Record<Pair, number>>>({});

  useEffect(() => {
    const now = Date.now();
    const transitions: Array<{ pair: Pair; score: number; dir: string | undefined }> = [];

    // Pass 1: ref update for ALL pairs — independent of watchlist or guards.
    // Transitions collected here; refs always updated even for non-watchlist pairs
    // so future watchlist additions don't miss the next GO transition.
    for (const pair of PAIRS) {
      const result = results[pair];
      const prev = prevVerdicts.current[pair];
      const curr = result?.verdict;

      if (curr !== undefined) {
        prevVerdicts.current[pair] = curr;
      }

      if (curr === "go" && prev !== "go" && prev !== undefined) {
        const dir = result?.direction !== "NEUTRAL" ? result?.direction : undefined;
        transitions.push({ pair, score: result?.score ?? 0, dir });
      }
    }

    // Pass 2: notification decision — strictly AFTER ref updates, filtered by watchlist.
    if (!goAlertsEnabled) return;
    if (watchlistPairs.length === 0) return; // hydration guard

    for (const { pair, score, dir } of transitions) {
      if (!watchlistPairs.includes(pair)) continue;

      const lastFired = lastFiredAt.current[pair] ?? 0;
      if (now - lastFired < COOLDOWN_MS) continue;

      lastFiredAt.current[pair] = now;
      browserNotify(
        `⭐ GO — ${pair}`,
        `${dir ? dir + " · " : ""}Score ${score} · İzleme listesi`,
      );
    }
  }, [results, goAlertsEnabled, watchlistPairs]);
}
