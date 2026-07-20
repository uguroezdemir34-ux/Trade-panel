"use client";

/**
 * MARKET EXTRAS POLLER — Altın/Gümüş/Brent + AAPL/NVDA/TSLA periyodik
 * güncelleme (önceki adı useCommodityPoller — hisse senetleri eklenince
 * genişletildi, tek fetch iki store'u besliyor).
 *
 * /api/global-ticker çağırır (server-side Yahoo Finance proxy, 60sn cache
 * — bkz. o dosyanın header'ı). S&P 500/NASDAQ/DOW/DXY BİLEREK YOK SAYILIR
 * — equityIndexStore/useEquityIndexPoller üzerinden farklı bir kaynaktan
 * (SPY/QQQ/DIA/UUP proxy'leri) geliyorlar ve skor motoruna giriyorlar
 * (bkz. composeScoreInput) — iki kaynağı birleştirmek TickerTape'te
 * mükerrer/çelişkili rozetlere yol açardı (route'un kendisi de artık bu
 * 4 sembolü hiç çekmiyor, bkz. app/api/global-ticker/route.ts).
 *
 * 3dk cadence — useOrderBookPoller ile aynı sınıf ("yavaş değişen bağlam"
 * verisi), useEquityIndexPoller'ın 5dk'sından biraz daha sık (emtia/hisse
 * fiyatları endekslerden daha volatil kabul edilir).
 *
 * SAVUNMACI: her varlık diğerinden bağımsız — biri "N/A" (route'un kendi
 * hata fallback'i) dönerse sadece o atlanır, son bilinen değerinde kalır.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCommodityStore, type CommoditySymbol } from "@/lib/store/commodityStore";
import { useStockTickerStore, type StockSymbol } from "@/lib/store/stockTickerStore";

const POLL_INTERVAL_MS = 3 * 60_000; // 3 dakika

const COMMODITY_NAME_TO_KEY: Record<string, CommoditySymbol> = {
  GOLD: "gold",
  SILVER: "silver",
  BRENT: "brent",
};

const STOCK_NAME_TO_KEY: Record<string, StockSymbol> = {
  AAPL: "aapl",
  NVDA: "nvda",
  TSLA: "tsla",
};

interface GlobalTickerAsset {
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

// Route-gated: sadece /karar'dayken çalışır — tek tüketicisi TickerTape
// (app/karar/page.tsx'te render ediliyor, grep ile doğrulandı, başka hiçbir
// sayfa commodityStore/stockTickerStore'u okumuyor). Bug taramasında
// bulundu: önceden AppShell'de global mount edildiği için diğer 8+ sayfada
// da gereksiz yere çalışıyordu.
export function useMarketExtrasPoller(delayMs = 0): void {
  const setCommodity = useCommodityStore((s) => s.setCommodity);
  const setStock = useStockTickerStore((s) => s.setStock);
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname !== "/karar") return;

    async function poll(): Promise<void> {
      try {
        const res = await fetch("/api/global-ticker");
        if (!res.ok) return;
        const raw = (await res.json()) as GlobalTickerAsset[] | { error: string };
        if (!Array.isArray(raw)) return;

        const now = Date.now();
        for (const asset of raw) {
          if (asset.price === "N/A") continue; // eksik/bozuk → son bilinen değerde kalır
          const changePct = Number.parseFloat(asset.change);
          const snap = {
            price: asset.price,
            changePct: Number.isFinite(changePct) ? changePct : null,
            updatedAt: now,
          };

          const commodityKey = COMMODITY_NAME_TO_KEY[asset.name];
          if (commodityKey) {
            setCommodity(commodityKey, snap);
            continue;
          }
          const stockKey = STOCK_NAME_TO_KEY[asset.name];
          if (stockKey) setStock(stockKey, snap);
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
  }, [setCommodity, setStock, pathname]);
}
