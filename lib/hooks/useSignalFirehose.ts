/**
 * SIGNAL FIREHOSE — Skor motoru 'go' verdict'e geçtiğinde Telegram sinyali gönderir.
 *
 * Tetiklenme kuralları (eski panel maybeFireSignal() ile birebir):
 *   1. verdict: non-go → go geçişi (go kalırsa tekrar atma)
 *   2. 2 dakika cooldown per pair (30s poll aralığında duplicate önleme)
 *   3. demoMode = true → sessiz (kağıt trading, gerçek sinyal gitmez)
 *   4. forwardTestMode = true → console.info ile logla, Telegram'a gitme
 *   5. direction = NEUTRAL → atla
 *
 * Stop/TP hesabı: 1H ATR + swing seviyelerinden yapısal stop + ADX-adaptive TP.
 */

"use client";

import { useEffect, useRef } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { ScoreResult, Verdict } from "@/lib/score/orchestrator";
import type { TelegramCreds } from "@/lib/store/credentialStore";
import { atr } from "@/lib/indicators/atr";
import { adx as computeAdxFn } from "@/lib/indicators/adx";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { findSwingLevels } from "@/lib/sr/swing";
import { computeStructuralStop } from "@/lib/sizer/stop";
import { computeAdaptiveTPs } from "@/lib/sizer/take-profit";
import type { NotifyMessage } from "@/lib/notify/types";
import { sendDiscordMessage } from "@/lib/notify/discord/channel";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";
import { SCORE_ENGINE_VERSION } from "@/lib/score/version";
import { useMacroStore } from "@/lib/store/macroStore";
import { computeOiDivergence } from "@/lib/market/oi-divergence";

const SIGNAL_COOLDOWN_MS = 2 * 60 * 1000; // 2 dakika

export function useSignalFirehose(): void {
  const results = useScoreStore((s) => s.results);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const forwardTestMode = useSettingsStore((s) => s.forwardTestMode);
  const tgCreds = useCredentialStore((s) => s.telegram);

  // Ref'ler: değişim tetiklemez, sadece tracking için
  const prevVerdicts = useRef<Partial<Record<Pair, Verdict>>>({});
  const lastFiredAt = useRef<Partial<Record<Pair, number>>>({});
  const appendGoSignal = useGoSignalLogStore((s) => s.appendGoSignal);

  useEffect(() => {
    const now = Date.now();

    for (const pair of PAIRS) {
      const result = results[pair];
      if (!result) continue;

      const verdict = result.verdict;
      const prevVerdict = prevVerdicts.current[pair];

      // non-go → go geçişi kontrolü
      const isGoTransition = verdict === "go" && prevVerdict !== "go";
      const lastFired = lastFiredAt.current[pair] ?? 0;
      const cooldownOk = now - lastFired > SIGNAL_COOLDOWN_MS;

      if (isGoTransition && cooldownOk && !demoMode) {
        lastFiredAt.current[pair] = now;
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
          });
        }
        void fireSignal(pair, result, tgCreds, forwardTestMode);
      }

      prevVerdicts.current[pair] = verdict;
    }
  }, [results, demoMode, forwardTestMode, tgCreds, appendGoSignal]);
}

// ── Signal hesabı + gönderim ───────────────────────────────────────

async function fireSignal(
  pair: Pair,
  result: ScoreResult,
  tgCreds: TelegramCreds | null,
  forwardTestMode: boolean,
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
  };

  if (forwardTestMode) {
    console.info("[QUANTIX FWD-TEST] Sinyal:", msg);
    return;
  }

  // Send to Telegram and Discord in parallel
  const discordUrl = useSettingsStore.getState().discordWebhookUrl;

  await Promise.allSettled([
    (async () => {
      try {
        const payload: Record<string, unknown> = { msg };
        if (tgCreds) {
          payload.botToken = tgCreds.botToken;
          payload.chatId = tgCreds.chatId;
        }
        const res = await fetch("/api/telegram/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          console.warn("[QUANTIX] Telegram sinyal başarısız:", data.error);
        }
      } catch (e) {
        console.warn("[QUANTIX] Telegram sinyal ağ hatası:", e);
      }
    })(),
    discordUrl
      ? sendDiscordMessage(discordUrl, msg).catch((e) => {
          console.warn("[QUANTIX] Discord sinyal hatası:", e);
        })
      : Promise.resolve(),
  ]);
}
