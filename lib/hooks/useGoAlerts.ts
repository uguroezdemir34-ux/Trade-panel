"use client";

/**
 * GO ALERTS HOOK — Sends a Telegram notification when any pair
 * transitions from a non-GO verdict to GO.
 *
 * Cooldown: a pair won't re-alert within COOLDOWN_MS (30 min) to
 * prevent spam when scores fluctuate around the GO threshold.
 */

import { useEffect, useRef } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { browserNotify } from "@/lib/notify/browser";
import { playGoAlert } from "@/lib/notify/audio";
import type { Pair } from "@/lib/constants/pairs";
import type { Verdict, ScoreResult } from "@/lib/score/orchestrator";

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function useGoAlerts(): void {
  const results = useScoreStore((s) => s.results);
  const goAlertsEnabled = useSettingsStore((s) => s.goAlertsEnabled);
  const audioAlertsEnabled = useSettingsStore((s) => s.audioAlertsEnabled);

  // Track previous verdicts without causing re-renders
  const prevVerdicts = useRef<Partial<Record<Pair, Verdict>>>({});
  // Track last alert time per pair for cooldown
  const lastAlerted = useRef<Partial<Record<Pair, number>>>({});

  useEffect(() => {
    if (!goAlertsEnabled) return;

    const now = Date.now();
    const pairs = Object.keys(results) as Pair[];

    for (const pair of pairs) {
      const result = results[pair];
      if (!result) continue;

      const prev = prevVerdicts.current[pair];
      const curr = result.verdict;

      // Transition from non-GO → GO
      if (curr === "go" && prev !== "go" && prev !== undefined) {
        const lastTime = lastAlerted.current[pair] ?? 0;
        if (now - lastTime >= COOLDOWN_MS) {
          lastAlerted.current[pair] = now;
          const dir = result.direction !== "NEUTRAL" ? result.direction : undefined;
          if (audioAlertsEnabled) playGoAlert();
          browserNotify(
            `🚀 GO — ${pair}`,
            `${dir ? dir + " · " : ""}Score ${result.score}`,
          );
          sendGoAlert(pair, result.score, dir).catch(() => {
            // fire-and-forget; silently ignore network errors
          });
        }
      }

      prevVerdicts.current[pair] = curr;
    }
  }, [results, goAlertsEnabled, audioAlertsEnabled]);
}

async function sendGoAlert(
  pair: Pair,
  score: ScoreResult["score"],
  direction: "LONG" | "SHORT" | undefined,
): Promise<void> {
  const credState = useCredentialStore.getState();
  const body: Record<string, unknown> = {
    msg: {
      kind: "go_signal",
      pair,
      direction,
      score,
      reasonText: `Score ${score} — GO threshold crossed`,
      timestamp: Date.now(),
    },
  };

  // Layer 2 — pass browser credentials when env vars not set server-side
  if (credState.telegram?.botToken) body.botToken = credState.telegram.botToken;
  if (credState.telegram?.chatId) body.chatId = credState.telegram.chatId;

  await fetch("/api/telegram/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Web push trigger — fire-and-forget, silent on failure
  void fetch("/api/push/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, score, direction }),
  }).catch(() => { /* ignore */ });
}
