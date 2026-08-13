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

import { useEffect } from "react";
import { captureMessage } from "@sentry/nextjs";
import { useStaggeredPoller } from "@/lib/hooks/useStaggeredPoller";
import { fetchPositions } from "@/lib/okx/positions";
import { fetchBinancePositions } from "@/lib/binance/positions";
import { fetchBybitPositions } from "@/lib/bybit/positions";
import { fetchGateioPositions } from "@/lib/gateio/positions";
import { fetchKucoinPositions } from "@/lib/kucoin/positions";
import { fetchMexcPositions } from "@/lib/mexc/positions";
import { fetchKrakenPositions } from "@/lib/kraken/positions";
import { usePositionStore } from "@/lib/store/positionStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { dispatchNotification } from "@/lib/notify/dispatch";
import { decideAdherence, type GoSignalCandidate } from "@/lib/risk/position-adoption";
import { ADHERENCE_CONFIG } from "@/lib/risk/adherence-score";
import { checkPositionGuardrails } from "@/lib/risk/positionGuardrails";
import { isSupportedPair } from "@/lib/constants/pairs";
import { usePositionRiskStore } from "@/lib/store/positionRiskStore";
import type { Position } from "@/lib/okx/positions";

const POLL_INTERVAL_MS = 10_000;
// Yeni açılan pozisyonlar bu süreden kısa ise reconcile yapılmaz
const MIN_OPEN_AGE_MS = 30_000;

export function usePositionPoller(delayMs = 0): void {
  const setPositions = usePositionStore((s) => s.setPositions);
  const setPositionFetchError = usePositionStore((s) => s.setPositionFetchError);
  const credsLoaded = useCredentialStore((s) => s._loaded);

  // warnedKeys'i localStorage'dan bir kez yükle — ilk fetchAll() (delayMs
  // sonra) çalışmadan ÖNCE tamamlanır (senkron read), bu yüzden bir sonraki
  // useStaggeredPoller effect'inden ayrı, kendi effect'i (bkz. positionRiskStore.ts
  // header'ı — modül-scope'ta değil, hydration mismatch riskini önlemek için).
  useEffect(() => {
    usePositionRiskStore.getState().hydrateWarnedKeys();
  }, []);

  async function fetchAll(): Promise<void> {
    const { okxProd, okxDemo, bnbFutures, bybitFutures, gateioFutures, kucoinFutures, mexcFutures, krakenFutures } = useCredentialStore.getState();
    const { activeExchange: exchange, demoMode } = useSettingsStore.getState();

    let positions: Position[] | null = null;
    if (exchange === "binance") {
      positions = await fetchBinancePositions(bnbFutures);
    } else if (exchange === "bybit") {
      positions = await fetchBybitPositions(bybitFutures);
    } else if (exchange === "gateio") {
      positions = await fetchGateioPositions(gateioFutures);
    } else if (exchange === "kucoin") {
      positions = await fetchKucoinPositions(kucoinFutures);
    } else if (exchange === "mexc") {
      positions = await fetchMexcPositions(mexcFutures);
    } else if (exchange === "kraken") {
      positions = await fetchKrakenPositions(krakenFutures);
    } else {
      // AccountBalanceCard/useBalancePoller'daki aynı demoMode ? okxDemo :
      // okxProd deseni — bug taramasında bulundu: burada hiç uygulanmıyordu,
      // demo modda bile pozisyonlar hep prod hesabından çekiliyordu.
      const clientCreds = demoMode ? okxDemo : okxProd;
      positions = await fetchPositions(demoMode, clientCreds);
    }

    if (positions === null) {
      // fetchPositions() (lib/okx/positions.ts) şu an her başarısızlıkta
      // sadece null dönüyor — ayrıntılı bir hata mesajı taşımıyor (bu
      // dosya + positionStore.ts dışında bir değişiklik gerektirirdi,
      // bu turun kapsamı dışında tutuldu). Bu yüzden sabit bir teknik
      // işaretçi ("fetch_failed") kullanılıyor — accountStore'daki
      // "HTTP_401"/"PROXY_ERROR" gibi ayrıntılı kodların aksine.
      //
      // Sentry'ye SADECE durum ok/idle'dan error'a GEÇERKEN bir kez
      // gönderiliyor (bu yüzden setPositionFetchError'DAN ÖNCE, ESKİ
      // durum okunuyor) — 10sn'lik poller her başarısız denemede tekrar
      // çağırsaydı (örn. yanlış API key kalıcı olarak takılıysa) Sentry'yi
      // spam'lerdi. Bir sonraki başarılı fetch (setPositions → status:"ok")
      // bu durumu sıfırlar, tekrar başarısız olursa yeniden bir kez loglanır.
      const wasAlreadyError = usePositionStore.getState().positionFetchStatus === "error";
      setPositionFetchError("fetch_failed");
      if (!wasAlreadyError) {
        captureMessage("Pozisyon verisi alınamadı", {
          level: "warning",
          extra: { exchange, demoMode },
        });
      }
      return;
    }

    setPositions(positions);
    reconcileOpenTrades(positions);
    void adoptNewPositions(positions);
    checkAndNotifyViolations(positions);
  }

  // Resume-jitter (visibilitychange, 0-2sn) dahil — bkz. useStaggeredPoller.ts
  // header'ı. Bu, en sık poll eden iki hook'tan (bkz. useBalancePoller.ts)
  // biri, kademeli olarak diğerlerine genişletilecek (kullanıcı kararı).
  useStaggeredPoller(fetchAll, POLL_INTERVAL_MS, { delayMs, enabled: credsLoaded });
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

    // Bildirim: reconcile kapanışını Telegram/Discord/Webhook'a bildir —
    // önceden burada doğrudan createChannel("telegram") çağrılıyordu, bu
    // client-side ASLA çalışmıyordu (env Layer 1 sırrı client bundle'ına
    // giremez, bkz. lib/notify/dispatch.ts dosya başı yorumu).
    void dispatchNotification({
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

/**
 * GUARDRAILS — kaldıraç/SL ihlali tespiti (bkz. lib/risk/positionGuardrails.ts).
 * Engelleme değil, uyarı: positionRiskStore güncellenir (banner bunu okur),
 * YENİ ihlaller (henüz Telegram gönderilmemiş) için bir kez bildirim atılır.
 * Dedup mantığı positionRiskStore.applyViolations()'ta — bkz. o dosyanın
 * header'ı (localStorage persist, "düzelene/kapanana kadar bir kez" garantisi).
 */
function checkAndNotifyViolations(livePositions: Position[]): void {
  const violations = checkPositionGuardrails(livePositions);
  const newlyViolated = usePositionRiskStore.getState().applyViolations(violations);

  for (const v of newlyViolated) {
    void dispatchNotification({
      kind: "position_risk_violation",
      // PositionViolation.pair (lib/risk/positionGuardrails.ts) genel
      // string — NotifyMessage.pair Pair|undefined bekliyor. isSupportedPair
      // zaten bu codebase'in kurulu konvansiyonu (bkz. AiCheckButton.tsx).
      pair: isSupportedPair(v.pair) ? v.pair : undefined,
      direction: v.direction,
      reasonText: v.message,
      timestamp: Date.now(),
    }).catch(() => {/* ignore */});
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
