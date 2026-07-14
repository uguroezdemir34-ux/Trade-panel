"use client";

/**
 * POSITION POLLER — Açık pozisyonları periyodik çeker + reconcile eder.
 *
 * activeExchange'e göre doğru borsadan çeker:
 *   okx     → OKX /api/v5/account/positions
 *   binance → Binance /fapi/v2/positionRisk
 *   bybit   → Bybit /v5/position/list
 *
 * Reconciliation:
 *   Exchange'de kapanmış ama tradesStore'da hâlâ "open" olan trade'leri
 *   otomatik kapatır. Freqtrade/Hummingbot pattern.
 *
 *   Güvenlik: 30s minimum açık yaşı — yeni açılan pozisyonun
 *   ilk poller döngüsünde yanlışlıkla kapatılmaması için.
 */

import { useEffect, useRef } from "react";
import { fetchPositions } from "@/lib/okx/positions";
import { fetchBinancePositions } from "@/lib/binance/positions";
import { fetchBybitPositions } from "@/lib/bybit/positions";
import { usePositionStore } from "@/lib/store/positionStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { createChannel } from "@/lib/notify/registry";
import { decideAdherence, type GoSignalCandidate } from "@/lib/risk/position-adoption";
import { ADHERENCE_CONFIG } from "@/lib/risk/adherence-score";
import type { Position } from "@/lib/okx/positions";

const POLL_INTERVAL_MS = 10_000;
// Yeni açılan pozisyonlar bu süreden kısa ise reconcile yapılmaz
const MIN_OPEN_AGE_MS = 30_000;

export function usePositionPoller(delayMs = 0): void {
  const setPositions = usePositionStore((s) => s.setPositions);
  const credsLoaded = useCredentialStore((s) => s._loaded);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAll(): Promise<void> {
    const { okxProd, bnbFutures, bybitFutures } = useCredentialStore.getState();
    const exchange = useSettingsStore.getState().activeExchange;

    let positions: Position[] | null = null;
    if (exchange === "binance") {
      positions = await fetchBinancePositions(bnbFutures);
    } else if (exchange === "bybit") {
      positions = await fetchBybitPositions(bybitFutures);
    } else {
      positions = await fetchPositions(okxProd);
    }

    if (positions === null) return;

    setPositions(positions);
    reconcileOpenTrades(positions);
    void adoptNewPositions(positions);
  }

  useEffect(() => {
    if (!credsLoaded) return;

    startTimerRef.current = setTimeout(() => {
      void fetchAll();
      timerRef.current = setInterval(() => void fetchAll(), POLL_INTERVAL_MS);
    }, delayMs);
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credsLoaded]);
}

/**
 * Exchange'den gelen güncel pozisyon listesini tradesStore ile karşılaştırır.
 * Exchange'de olmayan ama "open" statüsündeki trade'leri kapatır.
 *
 * Bu mekanizma; SL algo tetiklenmesi, TP dolması, borsa likidasyonu ve
 * manuel kapatma durumlarını yakalar.
 */
function reconcileOpenTrades(livePositions: Position[]): void {
  const { trades, closeTradeById } = useTradesStore.getState();
  const prices = useMarketStore.getState().prices;
  const now = Date.now();

  const openTrades = trades.filter((t) => t.status === "open");
  if (openTrades.length === 0) return;

  for (const trade of openTrades) {
    // Yeni açılan pozisyonları reconcile etme — poller gecikmesi kaynaklı false positive riski
    if (now - trade.openedAt < MIN_OPEN_AGE_MS) continue;

    const stillOnExchange = livePositions.some(
      (p) => p.pair === trade.pair && p.direction === trade.direction,
    );
    if (stillOnExchange) continue;

    // Exchange'de bu pozisyon yok → kapanmış (SL/TP/liq/manuel)
    const exitPrice = prices[trade.pair]?.last ?? trade.entryPrice;
    console.log(
      `[Reconcile] ${trade.direction} ${trade.pair} exchange'de yok → kapatılıyor @ ${exitPrice}`,
    );

    closeTradeById({
      id: trade.id,
      exitPrice,
      reason: "manual", // gerçek sebep bilinmiyor; OKX reconciler daha sonra düzeltebilir
      now,
    });

    // Telegram: reconcile kapanışını bildir
    const telegram = createChannel("telegram");
    if (telegram.isImplemented && telegram.isConfigured()) {
      void telegram.send({
        kind: "trade_closed",
        pair: trade.pair,
        direction: trade.direction,
        entry: trade.entryPrice,
        pnl: (exitPrice - trade.entryPrice) * (trade.direction === "SHORT" ? -1 : 1) * trade.qty,
        reasonText: "Exchange reconciled — position closed on exchange (SL/TP/liq/manual)",
        timestamp: now,
      }).catch(() => {/* ignore */});
    }
  }
}

/**
 * ADHERENCE — "orphan adoption": exchange'de daha önce hiç görülmemiş yeni
 * bir pozisyon tespit edildiğinde, go_signals'a bakıp panelin son sinyaliyle
 * uyumlu mu (system_with) yoksa ters mi (system_against) karar verir ve
 * riskStore.disciplineEntries'e otomatik bir kayıt ekler.
 *
 * Dedup: positionKey (pair_direction_cTime) zaten disciplineEntries'te
 * varsa hiçbir network isteği atılmaz — sadece gerçekten yeni bir pozisyon
 * için tek seferlik bir go-signals sorgusu yapılır.
 */
async function adoptNewPositions(livePositions: Position[]): Promise<void> {
  const { disciplineEntries, logEvent } = useRiskStore.getState();

  const adoptedKeys = new Set(
    disciplineEntries
      .filter((e) => e.source === "auto-position-open")
      .map((e) => e.positionKey as string),
  );

  for (const pos of livePositions) {
    if (pos.direction !== "LONG" && pos.direction !== "SHORT") continue;

    const positionKey = `${pos.pair}_${pos.direction}_${pos.cTime}`;
    if (adoptedKeys.has(positionKey)) continue;

    try {
      const sinceMs = pos.cTime - ADHERENCE_CONFIG.WINDOW_MIN * 60_000;
      const res = await fetch(
        `/api/go-signals?pair=${encodeURIComponent(pos.pair)}&sinceMs=${sinceMs}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) continue;

      const data = (await res.json()) as {
        candidates?: Array<{ direction: string; signalTs: number }>;
      };
      const candidates: GoSignalCandidate[] = (data.candidates ?? []).filter(
        (c): c is GoSignalCandidate => c.direction === "LONG" || c.direction === "SHORT",
      );

      const decision = decideAdherence(pos.direction, candidates, pos.cTime, ADHERENCE_CONFIG.WINDOW_MIN);
      if (!decision.type) continue;

      logEvent(decision.type, {
        source: "auto-position-open",
        pair: pos.pair,
        direction: pos.direction,
        positionKey,
        matchedSignalTs: decision.matchedSignalTs,
        entryPx: pos.entryPx,
      });
    } catch {
      // Network/route hatası — sessizce atla. positionKey adopte edilmedi,
      // bir sonraki 10sn'lik poll cycle'da otomatik tekrar denenir.
    }
  }
}
