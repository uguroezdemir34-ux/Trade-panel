/**
 * ORDER BOOK POLLER — top-20 derinlik periyodik güncelleme (Anomali Işığı Faz 2).
 *
 * - Tüm PAIRS için `fetchOrderBook` çağırır, `computeOrderBookImbalance` ile
 *   türetir, orderBookStore'a yazar.
 * - Derinlik 5→20: top-5 neredeyse her zaman best bid/ask'ın kendisini
 *   "duvar" seçiyordu (mesafe ~0), tooltip hep "0.000%" gösteriyordu.
 *   Rate limit istek SAYISINA bağlı (sz'ye değil), maliyet ihmal edilebilir.
 * - 3 dakika cadence — OI/funding'den (5dk) daha sık ama candle'dan (dakikalar)
 *   çok daha seyrek; macro veri gibi "yavaş değişen" sınıfta.
 * - runBatched(MAX_CONCURRENT=3, staggerMs=250) — useCandlePoller ile aynı
 *   rate-limit disiplini, OKX'in paylaşılan Vercel IP public limitini
 *   (~20 req/2s) aşmamak için eşzamanlı istek sayısı ve başlangıç gecikmesi
 *   sınırlanır.
 */

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PAIRS } from "@/lib/constants/pairs";
import { fetchOrderBook } from "@/lib/okx/orderbook";
import { computeOrderBookImbalance } from "@/lib/market/orderbook-imbalance";
import { runBatched } from "@/lib/okx/candleFetch";
import { useOrderBookStore } from "@/lib/store/orderBookStore";

const POLL_INTERVAL_MS = 180_000; // 3 dakika
const MAX_CONCURRENT = 3;
const STAGGER_MS = 250;

/**
 * Route-gated: sadece /karar'dayken çalışır — orderBookStore'un üç
 * tüketicisi de (app/karar/page.tsx, SqueezeRadarBanner, FlowAlignmentRow)
 * grep ile doğrulandı, sadece /karar'da render ediliyor. Bug taramasında
 * bulundu: önceden AppShell'de global mount edildiği için diğer 8+ sayfada
 * da gereksiz yere çalışıyordu (kullanıcı onayıyla, sadece bu iki poller
 * için — candle/position/news poller'ları benzer bir kısıtlamayı
 * KALDIRAMAZ, bkz. o hook'ların kendi dosyaları — reconciliation/Telegram/
 * global ticker bağımlılıkları var).
 */
export function useOrderBookPoller(delayMs = 0): void {
  const setImbalance = useOrderBookStore((s) => s.setImbalance);
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname !== "/karar") return;

    async function pollAll(): Promise<void> {
      const tasks = PAIRS.map((pair) => async () => {
        const snap = await fetchOrderBook(pair, 20);
        const result = computeOrderBookImbalance(snap);
        if (result) setImbalance(pair, result);
      });
      await runBatched(tasks, MAX_CONCURRENT, STAGGER_MS);
    }

    startTimerRef.current = setTimeout(() => {
      void pollAll();
      timerRef.current = setInterval(() => void pollAll(), POLL_INTERVAL_MS);
    }, delayMs);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // delayMs is a mount-time constant, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setImbalance, pathname]);
}
