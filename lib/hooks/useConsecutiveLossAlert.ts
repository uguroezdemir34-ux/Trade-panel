"use client";

/**
 * CONSECUTIVE LOSS ALERT — fires when a trader closes 3+ losses in a row.
 *
 * Checks only trades closed during the current calendar day (UTC) to avoid
 * flagging stale history on first load. Cooldown: once per streak milestone
 * (i.e., alerts at 3, then again at 5, then at 7 — never re-fires for the
 * same streak length).
 *
 * Enabled when goAlertsEnabled is on (reuses the same setting).
 */

import { useEffect, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { browserNotify } from "@/lib/notify/browser";

const LOSS_THRESHOLDS = [3, 5, 7] as const;

export function useConsecutiveLossAlert(): void {
  const trades = useTradesStore((s) => s.trades);
  const goAlertsEnabled = useSettingsStore((s) => s.goAlertsEnabled);
  // Track which streak lengths have already fired a notification this session
  const alertedAt = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!goAlertsEnabled) return;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const todayClosed = trades
      .filter((t) => t.status === "closed" && t.exit != null && t.exit.closedAt >= todayMs)
      .sort((a, b) => a.exit!.closedAt - b.exit!.closedAt);

    // Count consecutive losses from the end
    let streak = 0;
    for (let i = todayClosed.length - 1; i >= 0; i--) {
      if (todayClosed[i].exit!.pnlUsd < 0) {
        streak++;
      } else {
        break;
      }
    }

    for (const threshold of LOSS_THRESHOLDS) {
      if (streak >= threshold && !alertedAt.current.has(threshold)) {
        alertedAt.current.add(threshold);
        const msg =
          threshold >= 5
            ? `🛑 ${streak} ardışık zarar — Bugün işlemi durdur`
            : `⚠️ ${streak} ardışık zarar — Stratejiyi gözden geçir`;
        browserNotify("Ardışık Zarar Alarmı", msg);
        sendLossAlert(streak, threshold).catch(() => {});
        break; // only fire the highest applicable threshold at once
      }
    }

    // Reset alerted set when streak drops below 3 (e.g., a winning trade came in)
    if (streak < 3) {
      alertedAt.current.clear();
    }
  }, [trades, goAlertsEnabled]);
}

async function sendLossAlert(streak: number, threshold: number): Promise<void> {
  const credState = useCredentialStore.getState();

  const severity = threshold >= 5 ? "DURDUR" : "UYARI";
  const reasonText =
    threshold >= 5
      ? `${streak} ardışık zarar — Bugün işlemi durdur, sistemi sıfırla`
      : `${streak} ardışık zarar — Stratejiyi ve psikolojiyi gözden geçir`;

  const body: Record<string, unknown> = {
    msg: {
      kind: "consecutive_loss",
      streak,
      severity,
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
