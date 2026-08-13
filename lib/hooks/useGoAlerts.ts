"use client";

/**
 * GO ALERTS HOOK — Sends a Telegram notification when any pair
 * transitions from a non-GO verdict to GO.
 *
 * Cooldown: a pair won't re-alert within COOLDOWN_MS (30 min) to
 * prevent spam when scores fluctuate around the GO threshold.
 *
 * dispatchNotification() → POST /api/telegram/signal reaches BOTH
 * Telegram channels: VIP always, and (best-effort, only if
 * TELEGRAM_PUBLIC_CHAT_ID is configured) the public channel with the
 * same plain go_signal text — see the "go_signal" branch at the end of
 * that route. Previously this hook's alerts never reached the public
 * channel (fixed) — resolvePublicChatId() is DB/decrypt-backed and can
 * only run server-side, so the actual public send lives in the route,
 * not here.
 */

import { useEffect, useRef } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { dispatchNotification } from "@/lib/notify/dispatch";
import { browserNotify } from "@/lib/notify/browser";
import { playGoAlert } from "@/lib/notify/audio";
import { checkHumanTraderApprovalAtFireTime } from "@/lib/signal/humanTraderCheck";
import type { Pair } from "@/lib/constants/pairs";
import type { Verdict, ScoreResult } from "@/lib/score/orchestrator";
import type { NotifyMessage } from "@/lib/notify/types";

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
  // İnsan trader kontrolü — ATEŞLENME ANINDA taze hesaplanır (bkz.
  // useSignalFirehose.ts'in AYNI çağrısı, birebir gerekçe). direction
  // undefined ise (NEUTRAL) hiç denenmez — anlamlı bir S/R yönü yok.
  const candleState = useCandleStore.getState();
  const marketState = useMarketStore.getState();
  const currentPrice = marketState.prices[pair]?.last ?? null;
  const humanCheck =
    direction && currentPrice
      ? checkHumanTraderApprovalAtFireTime(
          direction,
          currentPrice,
          candleState.candles[`${pair}_1h`] ?? EMPTY_CANDLES,
          candleState.candles[`${pair}_4h`] ?? EMPTY_CANDLES,
        )
      : undefined;

  const msg: NotifyMessage = {
    kind: "go_signal",
    pair,
    direction,
    score,
    reasonText: `Score ${score} — GO threshold crossed`,
    timestamp: Date.now(),
    humanCheck,
  };

  // Telegram (Layer 1/2) + Discord + genel Webhook — tek merkezi orkestratör.
  await dispatchNotification(msg);

  // Web push tetikleyicisi — ayrı bir altyapı (Web Push/VAPID), ChannelName/
  // NotifyChannel sistemine dahil DEĞİL, bilerek dispatchNotification'a
  // taşınmadı. Fire-and-forget, silent on failure.
  void fetch("/api/push/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pair, score, direction }),
  }).catch(() => { /* ignore */ });
}
