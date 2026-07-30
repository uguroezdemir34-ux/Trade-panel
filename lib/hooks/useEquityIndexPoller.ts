"use client";

/**
 * EQUITY INDEX POLLER — S&P500/Nasdaq/DXY/Dow proxy'leri (SPY/QQQ/UUP/DIA) periyodik güncelleme.
 *
 * /api/macro/equity-index çağırır (server-side Finnhub proxy — key client'a
 * hiç sızmaz, bkz. o dosyanın header'ı). 5dk cadence — useNewsPoller'dan
 * (20dk) daha sık ama useOrderBookPoller'dan (3dk) daha seyrek, "yavaş
 * değişen bağlam" verisi sınıfına uygun.
 *
 * SAVUNMACI: her index (spy/qqq/uup/dow) diğerinden bağımsız — biri eksik/bozuksa
 * sadece o atlanır, diğerleri son bilinen değerinde güncellenir. Route zaten
 * hiç throw etmez, ama fetch/JSON hatası burada da ayrıca yutulur.
 *
 * Ardışık hata backoff: MAX_CONSECUTIVE_FAILURES cycle üst üste hiçbir index
 * güncellenemezse (route erişilemiyor / key yok / Finnhub down) bir sonraki
 * cycle 2x ertelenir. Sabit setInterval yerine kendini yeniden zamanlayan
 * setTimeout kullanılıyor çünkü gecikme dinamik (backoff'a göre değişiyor) —
 * setInterval bunu desteklemez. Agresif değil: taban frekans zaten 5dk.
 *
 * Piyasa saatleri (FAZ 4): lib/score/macroScore.ts'teki isUSMarketOpen()
 * (salt okunur import — o dosyaya hiç dokunulmadı) her cycle başında
 * kontrol edilir. ABD borsası kapalıyken (hafta sonu/tatil) fetch tamamen
 * atlanır — Finnhub'a gereksiz istek gitmez, backoff sayacı da etkilenmez
 * (kapalı piyasa bir hata değil).
 */

import { useEffect, useRef } from "react";
import { useEquityIndexStore, type EquityIndexSymbol } from "@/lib/store/equityIndexStore";
import { isUSMarketOpen } from "@/lib/score/macroScore";

const POLL_INTERVAL_MS = 5 * 60_000; // 5 dakika
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_MULTIPLIER = 2;

const SYMBOL_KEYS: { symbol: string; key: EquityIndexSymbol }[] = [
  { symbol: "SPY", key: "spy" },
  { symbol: "QQQ", key: "qqq" },
  { symbol: "UUP", key: "uup" },
  { symbol: "DIA", key: "dow" },
];

interface IndexQuote {
  price: number;
  changePct: number | null;
}

interface EquityIndexResponse {
  available?: boolean;
  indices?: Partial<Record<string, IndexQuote | null>>;
}

export function useEquityIndexPoller(delayMs = 0): void {
  const setIndex = useEquityIndexStore((s) => s.setIndex);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailuresRef = useRef(0);
  // AppShell route-gating turunda bulundu: self-rescheduling setTimeout
  // zincirinde unmount tam bir poll() fetch'i beklerken olursa, in-flight
  // çağrı tamamlandığında .then(scheduleNext) koşulsuz yeni bir (artık
  // takip edilmeyen) timer kuruyordu — nadir bir yarış koşulunda "hayalet"
  // bir poller kalabiliyordu. useMarketStream.ts'in REST fallback'indeki
  // aynı desenle (module-level restFallbackStartedAt bayrağı) aynı çözüm —
  // burada instance-scoped bir ref yeterli, bu hook singleton değil.
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    async function poll(): Promise<void> {
      // ABD borsası kapalıyken (hafta sonu/tatil) fetch'i tamamen atla —
      // hata değil, backoff sayacını etkilemez (FAZ 4).
      if (!isUSMarketOpen(new Date()).open) return;
      try {
        const res = await fetch("/api/macro/equity-index");
        if (!res.ok) {
          consecutiveFailuresRef.current += 1;
          return;
        }
        const raw = (await res.json()) as EquityIndexResponse;
        if (!raw.available || !raw.indices) {
          consecutiveFailuresRef.current += 1;
          return;
        }

        let anyUpdated = false;
        const now = Date.now();
        for (const { symbol, key } of SYMBOL_KEYS) {
          const q = raw.indices[symbol];
          if (q && typeof q.price === "number" && isFinite(q.price) && q.price > 0) {
            setIndex(key, {
              price: q.price,
              changePct: typeof q.changePct === "number" && isFinite(q.changePct) ? q.changePct : null,
              updatedAt: now,
            });
            anyUpdated = true;
          }
          // eksik/bozuk index → sessizce atla, o key son bilinen değerinde kalır
        }
        consecutiveFailuresRef.current = anyUpdated ? 0 : consecutiveFailuresRef.current + 1;
      } catch {
        consecutiveFailuresRef.current += 1;
      }
    }

    function scheduleNext(): void {
      // Tek choke point — hem ilk çağrının hem sonraki her döngünün
      // .then(scheduleNext)'i buradan geçiyor, unmount sonrası ikisi de
      // burada durur.
      if (stoppedRef.current) return;
      const backoff =
        consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES ? BACKOFF_MULTIPLIER : 1;
      timerRef.current = setTimeout(() => {
        void poll().then(scheduleNext);
      }, POLL_INTERVAL_MS * backoff);
    }

    startTimerRef.current = setTimeout(() => {
      void poll().then(scheduleNext);
    }, delayMs);

    return () => {
      stoppedRef.current = true;
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // delayMs is a mount-time constant, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIndex]);
}
