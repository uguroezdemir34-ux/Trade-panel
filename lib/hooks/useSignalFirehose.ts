/**
 * SIGNAL FIREHOSE — Skor motoru 'go' verdict'e geçtiğinde Telegram sinyali gönderir.
 *
 * Tetiklenme kuralları (eski panel maybeFireSignal() ile birebir):
 *   1. verdict: non-go → go geçişi (go kalırsa tekrar atma)
 *   2. 2 dakika cooldown per pair (30s poll aralığında duplicate önleme)
 *   3. demoMode = true → sessiz (kağıt trading, gerçek sinyal gitmez)
 *   4. direction = NEUTRAL → atla
 *
 * Stop/TP hesabı: 1H ATR + swing seviyelerinden yapısal stop + ADX-adaptive TP.
 *
 * pendingConfirmAt/prevVerdicts/lastFiredAt (aşağıda) tetikleme mantığının
 * TEK gerçek kaynağı — bellekte (useRef), sayfa yenilenince sıfırlanır.
 * signalConfirmStore.ts'e yapılan yazılar sadece bu ref'lerin UI'a görünür
 * bir yansıması (VerdictBadge'in "teyit bekleniyor/bilinmiyor" rozeti için),
 * tetikleme koşullarından hiçbirini değiştirmez.
 */

"use client";

import { useEffect, useRef } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { ScoreResult, Verdict } from "@/lib/score/orchestrator";
import { atr } from "@/lib/indicators/atr";
import { adx as computeAdxFn } from "@/lib/indicators/adx";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { findSwingLevels } from "@/lib/sr/swing";
import { computeStructuralStop } from "@/lib/sizer/stop";
import { computeAdaptiveTPs } from "@/lib/sizer/take-profit";
import type { NotifyMessage } from "@/lib/notify/types";
import { dispatchNotification } from "@/lib/notify/dispatch";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";
import { SCORE_ENGINE_VERSION } from "@/lib/score/version";
import { useMacroStore } from "@/lib/store/macroStore";
import { computeOiDivergence } from "@/lib/market/oi-divergence";
import { useSignalConfirmStore } from "@/lib/store/signalConfirmStore";

const SIGNAL_COOLDOWN_MS = 2 * 60 * 1000;   // 2 dakika
const CONFIRM_DELAY_MS   = 5 * 60 * 1000;   // 5 dakika — momentary false-positive koruması

export function useSignalFirehose(): void {
  const results = useScoreStore((s) => s.results);
  const demoMode = useSettingsStore((s) => s.demoMode);

  const prevVerdicts     = useRef<Partial<Record<Pair, Verdict>>>({});
  const lastFiredAt      = useRef<Partial<Record<Pair, number>>>({});
  // GO geçişinden 5 dk sonrasının epoch ms değeri — süre dolmadan sinyal atılmaz
  const pendingConfirmAt = useRef<Partial<Record<Pair, number>>>({});
  const appendGoSignal = useGoSignalLogStore((s) => s.appendGoSignal);

  useEffect(() => {
    const now = Date.now();

    for (const pair of PAIRS) {
      const result = results[pair];
      if (!result) continue;

      const verdict     = result.verdict;
      const prevVerdict = prevVerdicts.current[pair];

      const isGoTransition = verdict === "go" && prevVerdict !== "go";
      const lastFired      = lastFiredAt.current[pair] ?? 0;
      const cooldownOk     = now - lastFired > SIGNAL_COOLDOWN_MS;
      const pendingAt      = pendingConfirmAt.current[pair];

      // GO düştü → bekleyen onayı iptal et
      if (prevVerdict === "go" && verdict !== "go" && pendingAt != null) {
        delete pendingConfirmAt.current[pair];
        // UI görünürlüğü — bkz. signalConfirmStore.ts header'ı. Tetikleme
        // mantığını etkilemez, sadece yukarıdaki satırın bir yansıması.
        useSignalConfirmStore.getState().clear(pair);
      }

      // non-go → go geçişi: onay saatini kaydet, henüz sinyal atma
      if (isGoTransition && cooldownOk && !demoMode && result.direction !== "NEUTRAL" && pendingAt == null) {
        const pendingUntil = now + CONFIRM_DELAY_MS;
        pendingConfirmAt.current[pair] = pendingUntil;
        // UI görünürlüğü — SADECE bu session'da GERÇEKTEN gözlemlenen bir
        // geçişte yazılır (prevVerdict tanımlıysa, yani bu pair'in önceki
        // durumunu bu session'da gördüysek). prevVerdict === undefined ise
        // (sayfa yeni yenilendi, bu pair'in ilk cycle'ı) bu satır kasıtlı
        // olarak store'a YAZMIYOR — aksi halde saatlerdir stabil bir GO,
        // yenileme sonrası "teyit bekleniyor 5:00" gibi görünürdü, ki bu
        // teyitli bir sinyali zayıf gösteren tam ters bir yanlış bilgi olur.
        // pendingConfirmAt.current (yukarıdaki satır) HER durumda set
        // edilir — gerçek tetikleme mantığı bundan etkilenmez, sadece
        // görüntüleme bu durumda "pending" yerine "unknown" kalır (store'da
        // hiç kayıt olmadığı için, bkz. VerdictBadge.tsx useConfirmStatus).
        if (prevVerdict !== undefined) {
          useSignalConfirmStore.getState().setPending(pair, pendingUntil);
        }
      }

      // 5 dk bekleme doldu + hâlâ GO → sinyal at
      const currentPending = pendingConfirmAt.current[pair];
      if (verdict === "go" && currentPending != null && now >= currentPending && !demoMode) {
        delete pendingConfirmAt.current[pair];
        lastFiredAt.current[pair] = now;
        useSignalConfirmStore.getState().setConfirmed(pair, now);
        if (result.direction !== "NEUTRAL") {
          const rawPrice = useMarketStore.getState().prices[pair]?.last;
          const livePrice = rawPrice ?? 0;
          const oiResult = useMacroStore.getState().oiVelocity[pair] ?? null;
          const oiDivergence = computeOiDivergence(oiResult, result.direction as "LONG" | "SHORT");
          appendGoSignal({
            ts: now,
            pair,
            direction: result.direction as "LONG" | "SHORT",
            score: result.score,
            effectiveThreshold: result.effectiveThreshold,
            triggerPriceAtGo: livePrice,
            priceWasStale: !rawPrice || rawPrice <= 0,
            pullbackActive: result.pullbackActive,
            regime: result.regime,
            sub: result.sub,
            sweepBonus: result.sweepBonus,
            regimeBonus: result.regimeBonus,
            blocks: result.blocks,
            softBlocks: result.softBlocks,
            engineVersion: SCORE_ENGINE_VERSION,
            oiDivergence,
            triggeredGates: result.triggeredShadowGates,
          });
          fireSignal(pair, result).catch((err) => {
            console.warn(`[signal-firehose] ${pair} sinyal gönderimi başarısız:`, err);
          });
        }
      }

      prevVerdicts.current[pair] = verdict;
    }
  }, [results, demoMode, appendGoSignal]);
}

// ── Signal hesabı + gönderim ───────────────────────────────────────

async function fireSignal(
  pair: Pair,
  result: ScoreResult,
): Promise<void> {
  if (result.direction === "NEUTRAL") return;

  // Store snapshot — getState() re-render tetiklemez
  const candleState = useCandleStore.getState();
  const marketState = useMarketStore.getState();

  const candles1h = candleState.candles[`${pair}_1h`] ?? EMPTY_CANDLES;
  const livePrice = marketState.prices[pair]?.last ?? null;
  if (!livePrice) return;

  // Stop + TP hesabı (ATR + swing)
  let stopPrice: number | undefined;
  let tp1: number | undefined;
  let tp2: number | undefined;

  if (candles1h.length >= 15) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indCandles = (candles1h as any[]).map(toIndicatorCandle);
    const atrVal = atr(indCandles, { period: 14 });

    if (atrVal && atrVal > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const swing = findSwingLevels(candles1h as any);
      const stopRes = computeStructuralStop(
        result.direction as "LONG" | "SHORT",
        livePrice,
        atrVal,
        swing.swingLow,
        swing.swingHigh,
      );
      stopPrice = stopRes.stopPrice;

      const adxVal =
        candles1h.length >= 29
          ? (computeAdxFn(indCandles, 14)?.adx ?? null)
          : null;

      const tpRes = computeAdaptiveTPs(
        result.direction as "LONG" | "SHORT",
        livePrice,
        atrVal,
        adxVal,
      );
      tp1 = tpRes.tp1Price;
      tp2 = tpRes.tp2Price;
    }
  }

  // Reason özeti — en anlamlı 2 faktör
  const r = result.reasons;
  const parts: string[] = [];
  if (r.trend) parts.push(r.trend);
  if (r.adx) parts.push(r.adx);
  if (r.sweep) parts.push(r.sweep);
  const reasonText = parts.slice(0, 2).join(" · ");

  const msg: NotifyMessage = {
    kind: "trade_opened",
    pair,
    direction: result.direction as "LONG" | "SHORT",
    entry: livePrice,
    stopPrice,
    tp1,
    tp2,
    score: result.score,
    reasonText,
    timestamp: Date.now(),
    // /api/telegram/signal route'unun paylaşım kartı üretebilmesi için —
    // bu fonksiyon SADECE GO + 5dk teyit sonrası çağrılıyor (bkz. dosya başı
    // yorumu), yani route bunu her zaman "confirmed" bir sinyal olarak
    // işleyebilir.
    sub: result.sub,
  };

  // Telegram (Layer 1/2) + Discord + genel Webhook — tek merkezi orkestratör.
  const dispatchResult = await dispatchNotification(msg);
  if (dispatchResult.telegram && !dispatchResult.telegram.ok) {
    console.warn("[QUANTIX] Telegram sinyal başarısız:", dispatchResult.telegram.errorMessage);
  }
  if (dispatchResult.discord && !dispatchResult.discord.ok) {
    console.warn("[QUANTIX] Discord sinyal hatası:", dispatchResult.discord.errorMessage);
  }
  if (dispatchResult.webhook && !dispatchResult.webhook.ok) {
    console.warn("[QUANTIX] Webhook sinyal hatası:", dispatchResult.webhook.errorMessage);
  }
}
