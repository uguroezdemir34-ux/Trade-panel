"use client";

/**
 * COMMODITY POLLER — Altın/Gümüş/Brent periyodik güncelleme.
 *
 * /api/global-ticker çağırır (server-side Yahoo Finance proxy, 60sn cache
 * — bkz. o dosyanın header'ı). Dönen 6 varlıktan sadece GOLD/SILVER/BRENT
 * alınır — S&P 500/NASDAQ/DXY bilerek YOK SAYILIR, çünkü bunlar zaten
 * equityIndexStore/useEquityIndexPoller üzerinden farklı bir kaynaktan
 * (SPY/QQQ/UUP proxy'leri) geliyor ve skor motoruna giriyor (bkz.
 * composeScoreInput) — iki kaynağı birleştirmek TickerTape'te mükerrer/
 * çelişkili rozetlere yol açardı.
 *
 * 3dk cadence — useOrderBookPoller ile aynı sınıf ("yavaş değişen bağlam"
 * verisi), useEquityIndexPoller'ın 5dk'sından biraz daha sık (emtia
 * fiyatları hisse endekslerinden daha volatil kabul edilir).
 *
 * SAVUNMACI: her emtia diğerinden bağımsız — biri "N/A" (route'un kendi
 * hata fallback'i) dönerse sadece o atlanır, son bilinen değerinde kalır.
 */

import { useEffect, useRef } from "react";
import { useCommodityStore, type CommoditySymbol } from "@/lib/store/commodityStore";

const POLL_INTERVAL_MS = 3 * 60_000; // 3 dakika

const NAME_TO_KEY: Record<string, CommoditySymbol> = {
  GOLD: "gold",
  SILVER: "silver",
  BRENT: "brent",
};

interface GlobalTickerAsset {
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

export function useCommodityPoller(delayMs = 0): void {
  const setCommodity = useCommodityStore((s) => s.setCommodity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function poll(): Promise<void> {
      try {
        const res = await fetch("/api/global-ticker");
        if (!res.ok) return;
        const raw = (await res.json()) as GlobalTickerAsset[] | { error: string };
        if (!Array.isArray(raw)) return;

        const now = Date.now();
        for (const asset of raw) {
          const key = NAME_TO_KEY[asset.name];
          if (!key || asset.price === "N/A") continue; // eksik/bozuk → son bilinen değerde kalır
          const changePct = Number.parseFloat(asset.change);
          setCommodity(key, {
            price: asset.price,
            changePct: Number.isFinite(changePct) ? changePct : null,
            updatedAt: now,
          });
        }
      } catch {
        // sessizce vazgeç — bir sonraki cycle'da yeniden denenir
      }
    }

    function scheduleNext(): void {
      timerRef.current = setTimeout(() => {
        void poll().then(scheduleNext);
      }, POLL_INTERVAL_MS);
    }

    startTimerRef.current = setTimeout(() => {
      void poll().then(scheduleNext);
    }, delayMs);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // delayMs is a mount-time constant, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCommodity]);
}
