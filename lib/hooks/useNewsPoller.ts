/**
 * NEWS POLLER — Haber Akışı şeridi için periyodik güncelleme.
 *
 * /api/news çağırır (server-side RSS+Finnhub proxy), sonucu newsStore'a
 * yazar. 20dk cadence — kullanıcının istediği 15-30dk aralığının ortası.
 * Tek bir global istek (per-pair değil), OKX rate limitine hiç girmiyor
 * (tamamen farklı hostlar) — useMacroPoller/useOrderBookPoller'dan bile
 * daha hafif bir yük.
 */

"use client";

import { useEffect, useRef } from "react";
import { useNewsStore } from "@/lib/store/newsStore";
import type { NewsItem } from "@/lib/news/types";

const POLL_INTERVAL_MS = 20 * 60_000; // 20 dakika

export function useNewsPoller(delayMs = 0): void {
  const setItems = useNewsStore((s) => s.setItems);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function poll(): Promise<void> {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) return;
        const raw = (await res.json()) as { items?: NewsItem[] };
        if (Array.isArray(raw.items)) setItems(raw.items);
      } catch {
        // Sessizce atla — sonraki cycle'da tekrar dener
      }
    }

    startTimerRef.current = setTimeout(() => {
      void poll();
      timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    }, delayMs);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // delayMs is a mount-time constant, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setItems]);
}
