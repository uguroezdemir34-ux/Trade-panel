"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store/marketStore";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { browserNotify } from "@/lib/notify/browser";
import { playPriceAlert } from "@/lib/notify/audio";
import type { Pair } from "@/lib/constants/pairs";

export function usePriceAlarms(): void {
  const prices = useMarketStore((s) => s.prices);
  const audioEnabled = useSettingsStore((s) => s.audioAlertsEnabled);
  // Load alarms from localStorage on mount
  const load = usePriceAlarmStore((s) => s.load);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      load();
      loaded.current = true;
    }
  }, [load]);

  // Track which alarms have been notified (in-memory, per session)
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    const { alarms, markTriggered } = usePriceAlarmStore.getState();

    for (const alarm of alarms) {
      if (alarm.status !== "active") continue;
      if (notified.current.has(alarm.id)) continue;

      const tick = prices[alarm.pair as Pair];
      if (!tick) continue;

      const currentPrice = tick.last;
      const triggered =
        alarm.condition === "above"
          ? currentPrice >= alarm.targetPrice
          : currentPrice <= alarm.targetPrice;

      if (triggered) {
        notified.current.add(alarm.id);
        markTriggered(alarm.id);
        const condStr = alarm.condition === "above" ? "▲ üzerine çıktı" : "▼ altına indi";
        if (audioEnabled) playPriceAlert();
        browserNotify(
          `🔔 ${alarm.pair} Fiyat Alarmı`,
          `${alarm.label ? alarm.label + " — " : ""}${alarm.targetPrice.toLocaleString()} ${condStr}`,
        );
        sendAlarmNotification(alarm.pair as Pair, alarm.targetPrice, alarm.condition, currentPrice, alarm.label).catch(() => {
          // fire-and-forget
        });
      }
    }
  }, [prices]);
}

async function sendAlarmNotification(
  pair: Pair,
  targetPrice: number,
  condition: "above" | "below",
  currentPrice: number,
  label?: string,
): Promise<void> {
  const credState = useCredentialStore.getState();

  const conditionText =
    condition === "above"
      ? `▲ ${targetPrice.toLocaleString()} üzerine çıktı`
      : `▼ ${targetPrice.toLocaleString()} altına indi`;

  const reasonText = label ? `${label} — ${conditionText}` : conditionText;

  const body: Record<string, unknown> = {
    msg: {
      kind: "price_alarm",
      pair,
      entry: currentPrice,
      tp1: targetPrice,
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
