"use client";

/**
 * SCORE MOMENTUM ALERTS — Pre-GO Telegram notification.
 *
 * Fires when a pair's score rises ≥8 points across the last 4 snapshots
 * AND the current score is in the 75-84 range (approaching GO but not there yet).
 *
 * Cooldown: 45 min per pair to avoid spam on fluctuating scores.
 * Enabled only when goAlertsEnabled is on (reuses the same setting).
 */

import { useEffect, useRef } from "react";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { browserNotify } from "@/lib/notify/browser";
import { playMomentumAlert } from "@/lib/notify/audio";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

const COOLDOWN_MS = 45 * 60 * 1000;
const MIN_SNAPSHOTS = 4;
const RISE_THRESHOLD = 8;
const SCORE_LOWER = 75;
const SCORE_UPPER = 84;

export function useScoreMomentumAlerts(): void {
  const history = useScoreHistoryStore((s) => s.history);
  const goAlertsEnabled = useSettingsStore((s) => s.goAlertsEnabled);
  const audioAlertsEnabled = useSettingsStore((s) => s.audioAlertsEnabled);
  const lastAlerted = useRef<Partial<Record<Pair, number>>>({});

  useEffect(() => {
    if (!goAlertsEnabled) return;

    const now = Date.now();

    for (const pair of PAIRS) {
      const snaps = history[pair];
      if (!snaps || snaps.length < MIN_SNAPSHOTS) continue;

      const recent = snaps.slice(-MIN_SNAPSHOTS);
      const oldest = recent[0];
      const current = recent[recent.length - 1];

      if (current.verdict === "go") continue; // GO alerts handle this

      const rise = current.score - oldest.score;
      const inRange = current.score >= SCORE_LOWER && current.score <= SCORE_UPPER;

      if (rise < RISE_THRESHOLD || !inRange) continue;

      const lastTime = lastAlerted.current[pair] ?? 0;
      if (now - lastTime < COOLDOWN_MS) continue;

      lastAlerted.current[pair] = now;
      const dir = current.direction !== "NEUTRAL" ? current.direction : undefined;
      if (audioAlertsEnabled) playMomentumAlert();
      browserNotify(
        `📈 ${pair} Momentum`,
        `Skor ${current.score} (+${rise}) — GO eşiğine yaklaşıyor`,
      );
      sendMomentumAlert(pair, current.score, rise, dir).catch(() => {
        // fire-and-forget
      });
    }
  }, [history, goAlertsEnabled, audioAlertsEnabled]);
}

async function sendMomentumAlert(
  pair: Pair,
  score: number,
  rise: number,
  direction: "LONG" | "SHORT" | undefined,
): Promise<void> {
  const credState = useCredentialStore.getState();

  const dirText = direction === "LONG" ? " ▲ LONG" : direction === "SHORT" ? " ▼ SHORT" : "";
  const reasonText = `Skor ${score}${dirText} — son 4 okumada +${rise} puan yükseldi, GO eşiğine yaklaşıyor`;

  const body: Record<string, unknown> = {
    msg: {
      kind: "score_momentum",
      pair,
      direction,
      score,
      rise,
      reasonText,
      timestamp: Date.now(),
    },
  };

  if (credState.telegram?.botToken) body.botToken = credState.telegram.botToken;
  if (credState.telegram?.chatId) body.chatId = credState.telegram.chatId;

  await fetch("/api/telegram/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
