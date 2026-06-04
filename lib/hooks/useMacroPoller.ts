/**
 * MACRO POLLER — F&G, dominans ve funding rate periyodik güncelleme.
 *
 * - İlk yüklemede hemen çeker
 * - Sonra her 5 dakikada günceller (macro data yavaş değişir)
 * - macroStore.refreshAll() yazar
 */

"use client";

import { useEffect, useRef } from "react";
import { useMacroStore } from "@/lib/store/macroStore";

const POLL_INTERVAL_MS = 5 * 60_000; // 5 dakika

export function useMacroPoller(delayMs = 0): void {
  const refreshAll = useMacroStore((s) => s.refreshAll);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startTimerRef.current = setTimeout(() => {
      refreshAll();
      timerRef.current = setInterval(refreshAll, POLL_INTERVAL_MS);
    }, delayMs);
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // delayMs is a mount-time constant, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAll]);
}
