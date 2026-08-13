/**
 * SCORE ENGINE HOOK — candleStore tetiklendiğinde ScoreInput oluşturup
 * computeScore çalıştırır, sonucu scoreStore'a yazar.
 *
 * Render optimizasyonu:
 *   - Yalnızca candleStore.candles değiştiğinde (her ~30s) hesaplar
 *   - Diğer store'lar getState() ile okunur — subscription yok, re-render yok
 */

"use client";

import { useEffect } from "react";

// --- debug instrumentation (?debug=1 only) ---
function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("debug") === "1"; }
  catch { return false; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function perfLog(entry: Record<string, unknown>): void {
  if (!isDebug()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__PERF_LOG__) w.__PERF_LOG__ = [];
  w.__PERF_LOG__.push({ ...entry, _ts: Date.now() });
}
// --- end debug ---
import { PAIRS } from "@/lib/constants/pairs";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useMacroStore } from "@/lib/store/macroStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { composeScoreInput } from "@/lib/score/composeScoreInput";
import { computeScore } from "@/lib/score/orchestrator";
// GÖLGE MOD (deneysel, henüz canlı skora bağlı DEĞİL) — bkz. aşağıdaki
// fundingPercentile çağrısı. lib/score/scorers.ts'e hiç dokunulmadı.
import { scoreFundingPercentile, type FundingSample } from "@/lib/score/fundingPercentile";
import { inferDirection, type DirectionInput } from "@/lib/score/direction";
import { detectSRLevels } from "@/lib/sr/detect";
import { checkHumanTraderApproval } from "@/lib/signal/humanTraderCheck";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { oiVelocityScoreOrZero } from "@/lib/market/oi-velocity";
import { computeMtfTrend } from "@/lib/market/mtfTrend";
import { detectLiquiditySweep } from "@/lib/sr/sweep";
import { SR_SCALE_FACTOR } from "@/lib/score/version";
import { adx as computeAdx } from "@/lib/indicators/adx";
import { evaluateBtcMovement, deriveBtcMovementInput, BTC_COOLDOWN_CONSTANTS } from "@/lib/risk/btc-cooldown";
import { computeTimeQuality } from "@/lib/market/timeQuality";
import type { Pair } from "@/lib/constants/pairs";

/**
 * IDLE SLOT SCHEDULING — cycle'ın 9 parite üzerindeki senkron işini böler.
 *
 * ÖNCEKİ davranış: her pair'den sonra KOŞULSUZ bir yield (requestIdleCallback
 * timeout:50 / setTimeout(0) fallback) — cycle başına sabit 9 yield, cihazın
 * o an gerçekten boş olup olmadığına bakılmaksızın.
 *
 * YENİ davranış: requestIdleCallback'in KENDİ IdleDeadline'ını kullanarak
 * dinamik bütçeleme — bir idle slot'ta ne kadar boş zaman VARSA o kadar pair
 * art arda (yield'siz) işlenir, sadece kalan süre azaldığında (veya
 * didTimeout ile ZORLA çalıştırıldıysa) yeni bir idle slot istenir. Sabit
 * "her N pair'de bir" batch'lemesi yerine bunun tercih edilme sebebi: cihaz/
 * an'a göre KENDİLİĞİNDEN uyarlanıyor — sayfa geçişi gibi ana thread'in
 * meşgul olduğu anlarda idle slot'lar zaten kısa/az geliyor (didTimeout
 * sıklaşır) ve döngü otomatik olarak DAHA SIK yield eder (bugünkünden daha
 * konservatif); cihaz gerçekten boşken (arka planda/etkileşimsizken) tek
 * slot'ta birden fazla pair işlenip toplam yield sayısı azalır. Sabit "2-3
 * pair'de bir" batch'i bu iki durumu ayırt edemez — meşgul anda da aynı
 * sabit grup boyutunu kullanır, ki tam yaşanan donmanın sebebi bu olabilir.
 *
 * requestIdleCallback yoksa (fallback), gerçek bir IdleDeadline yok — bunun
 * yerine küçük, sabit bir zaman bütçesi (FALLBACK_BUDGET_MS) `performance.now()`
 * farkıyla taklit edilir; setTimeout(0) ile gerçek bir event-loop turu alınır.
 */
interface IdleDeadlineLike {
  readonly didTimeout: boolean;
  timeRemaining: () => number;
}

/** Yeni bir idle slot'ta, timeRemaining() bunun altına düşünce yeni slot istenir. */
const MIN_REMAINING_MS = 3;
/** requestIdleCallback yoksa (eski WebView vb.) bir "slot"un taklit edilen bütçesi. */
const FALLBACK_BUDGET_MS = 8;

function requestIdleSlot(): Promise<IdleDeadlineLike> {
  return new Promise<IdleDeadlineLike>((resolve) => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback((deadline) => resolve(deadline), { timeout: 50 });
    } else {
      const start = performance.now();
      setTimeout(() => {
        resolve({
          didTimeout: false,
          timeRemaining: () => Math.max(0, FALLBACK_BUDGET_MS - (performance.now() - start)),
        });
      }, 0);
    }
  });
}

/**
 * `items` üzerinde `work`'ü sırayla çalıştırır, idle-slot bütçelemesiyle
 * pair'ler ARASINDA ne zaman yield edileceğine karar verir.
 *
 * BİLİNÇLİ TASARIM — İLK öğe hiçbir zaman bir idle slot beklemez: `deadline`
 * ilk iterasyonda `null` başlar, ve slot isteme kararı işTEN SONRA verilir
 * (aşağıdaki döngüde `await work(item)` her zaman `deadline` kontrolünden
 * ÖNCE gelir). Yani ilk öğenin işi eskisi gibi (yieldToEventLoop() dönemi)
 * KOŞULSUZ hemen başlar, gecikme YOK — dinamik bütçeleme SADECE öğeler
 * ARASI bekleme kararını değiştiriyor, cycle'ın BAŞLAMA anını değil. (Bu,
 * bir önceki turda "ilk requestIdleSlot() bekletmesi bilinçli mi, sayfa
 * geçişinde cycle'ın başlangıcını geciktirir mi" sorusuna yanıt: O TASARIM
 * bilinçli değildi, gözden kaçmıştı — burada düzeltildi. Artık cycle'ın
 * başlaması, meşgul bir ana thread'de bile, eski koddaki kadar gecikmesiz.)
 *
 * requestIdleSlotFn/isCancelled test edilebilirlik için enjekte edilir —
 * bkz. tests/integration/score-engine-idle-scheduling.test.ts (requestIdleCallback
 * mock'lanıp karar dallarının — sabit yüksek/düşük timeRemaining, didTimeout — kaç
 * kez yeni slot istediği doğrulanıyor, gerçek zamanlama değil karar mantığı test edilir).
 */
export async function runWithIdleBudget<T>(
  items: readonly T[],
  work: (item: T) => void | Promise<void>,
  options: {
    requestIdleSlotFn?: () => Promise<IdleDeadlineLike>;
    isCancelled?: () => boolean;
  } = {},
): Promise<{ yieldCount: number }> {
  const requestIdleSlotFn = options.requestIdleSlotFn ?? requestIdleSlot;
  const isCancelled = options.isCancelled ?? (() => false);
  let deadline: IdleDeadlineLike | null = null;
  let yieldCount = 0;
  for (const item of items) {
    if (isCancelled()) break;
    await work(item);
    if (deadline === null || deadline.didTimeout || deadline.timeRemaining() <= MIN_REMAINING_MS) {
      deadline = await requestIdleSlotFn();
      yieldCount++;
    }
  }
  return { yieldCount };
}

// Skip-retry fast path throttle (modül seviyesi — candleStore equality fn'i
// bir hook değil, useRef kullanamıyor). Kalıcı skip'te kalan pariteler
// (örn. candle verisi hiç gelmeyen pair'ler) yüzünden fast path'in
// candleStore'un HER güncellemesinde (WS canlı mum tick'leri dahil) motoru
// tetiklemesini önler — throttle penceresi dolmadıysa normal candle
// ts/confirm karşılaştırmasına düşülür, gerçek bir değişiklik yine yakalanır.
let _lastSkipRecheckAt = 0;
const SKIP_RECHECK_THROTTLE_MS = 3_000;

export function useScoreEngine(): void {
  // Trigger: only when 15m/1h/4h last candle timestamps/confirm flags change.
  // Prevents score recomputation on 1d-only polls or identity-equal updates.
  const candles = useCandleStore(
    (s) => s.candles,
    (prev, next) => {
      // Fast path: any pair never scored OR skipped → trigger immediately so
      // insufficient-data pairs get re-evaluated every cycle instead of
      // waiting for their next candle ts/confirm change (which may be up to
      // 60 minutes away for 1h bars). undefined = never scored, null =
      // skipped (composeScoreInput returned null) — both should retry.
      const { results } = useScoreStore.getState();
      if (PAIRS.some((p) => results[p] === undefined || results[p] === null)) {
        const now = Date.now();
        if (now - _lastSkipRecheckAt >= SKIP_RECHECK_THROTTLE_MS) {
          _lastSkipRecheckAt = now;
          return false;
        }
        // Throttled — kalıcı skip'te kalan pair(ler) yüzünden burada spin
        // etmek yerine aşağıdaki normal candle ts/confirm karşılaştırmasına
        // düş, gerçek bir veri değişikliği yine yakalanır.
      }

      for (const pair of PAIRS) {
        for (const tf of ["15m", "1h", "4h"] as const) {
          const key = `${pair}_${tf}` as const;
          const p = prev[key];
          const n = next[key];
          if (p === n) continue;
          if (!p || !n || p.length !== n.length) return false;
          const pL = p[p.length - 1];
          const nL = n[n.length - 1];
          if (!pL || !nL) return false;
          if (pL.ts !== nL.ts || pL.confirm !== nL.confirm) return false;
        }
      }
      return true;
    },
  );
  const setResult  = useScoreStore((s) => s.setResult);
  const setSkipped = useScoreStore((s) => s.setSkipped);
  const scorerWeights = useSettingsStore((s) => s.scorerWeights);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const engineT0 = isDebug() ? performance.now() : 0;

    // Snapshot — subscription yok, re-render tetiklemiyor
    const marketStore = useMarketStore.getState();
    const macroStore = useMacroStore.getState();
    const accountStore = useAccountStore.getState();
    const positionStore = usePositionStore.getState();
    const tradesStore = useTradesStore.getState();

    // BTC 1H ADX — piyasa geneli chop tespiti (tüm çiftler için ortak)
    const btcCandles1h = candles["BTC_1h"] ?? EMPTY_CANDLES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const btcAdx1h = btcCandles1h.length >= 14
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (computeAdx((btcCandles1h as any[]).map(toIndicatorCandle), 14)?.adx ?? null)
      : null;

    // BTC S/R proximity gate — BTC kendi seviyesine ≤%0.5 yakınsa altcoin threshold +8
    const btcCandles4h = candles["BTC_4h"] ?? EMPTY_CANDLES;
    const btcPrice = marketStore.prices["BTC"]?.last ?? null;
    let btcNearSR = false;
    if (btcPrice && btcPrice > 0 && btcCandles4h.length >= 10 && btcCandles1h.length >= 10) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const btcC4h = (btcCandles4h as any[]).map(toIndicatorCandle);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const btcC1h = (btcCandles1h as any[]).map(toIndicatorCandle);
      const btcSR = detectSRLevels(btcC4h, btcC1h, btcPrice, "NEUTRAL", null);
      const distR = btcSR.levels.nearest_resistance?.distance_pct ?? Infinity;
      const distS = btcSR.levels.nearest_support?.distance_pct ?? Infinity;
      btcNearSR = Math.min(distR, distS) <= 0.5;
    }

    // BTC cooldown tetikleyicisi (bkz. lib/risk/btc-cooldown.ts) — PAIRS döngüsünden
    // ÖNCE çalışır ki BTC'nin kendisi dahil TÜM paritelerin bu cycle'daki
    // composeScoreInput() çağrıları güncel cooldown değerini görsün. Kasıtlı tasarım:
    // BtcCooldown sınıfının KENDİ localStorage persist'i (ham 'ug52_btccd' key'i)
    // KULLANILMIYOR — riskStore.setBtcCooldown()/setBtcSelfCooldown() zaten
    // lib/store/persist.ts üzerinden user-scoped persist yapıyor (bkz. d3a72e5
    // ug52_ → ug52_{userId}_ migrasyonu); iki ayrı persist yolu birbirinden
    // sapardı. Bunun yerine evaluateBtcMovement() saf fonksiyonu + burada
    // tekrarlanan "max al, uzat" mantığı kullanılıyor. Sadece KAPANMIŞ
    // (confirm===true) mumlar kullanılıyor — composeScoreInput.ts'teki
    // repainting-fix disiplinine uygun.
    {
      const btcConfirmed1h = btcCandles1h.filter((c) => c.confirm);
      const btcConfirmed4h = btcCandles4h.filter((c) => c.confirm);
      const movementInput = deriveBtcMovementInput(
        btcConfirmed1h[btcConfirmed1h.length - 1],
        btcConfirmed1h[btcConfirmed1h.length - 2],
        btcConfirmed4h[btcConfirmed4h.length - 1],
        btcConfirmed4h[btcConfirmed4h.length - 2],
      );
      if (movementInput) {
        const movement = evaluateBtcMovement(movementInput);
        if (movement.triggered) {
          const rs = useRiskStore.getState();
          rs.setBtcCooldown(
            Math.max(rs.btcCooldownUntil, now + BTC_COOLDOWN_CONSTANTS.ALT_COOLDOWN_MS),
            movement.reason,
          );
          rs.setBtcSelfCooldown(
            Math.max(rs.btcSelfCooldownUntil, now + BTC_COOLDOWN_CONSTANTS.SELF_COOLDOWN_MS),
          );
        }
      }
    }
    // riskStore snapshot BURADAN SONRA alınıyor — yukarıdaki setBtcCooldown/
    // setBtcSelfCooldown çağrıları store'u güncellemiş olabilir, PAIRS döngüsündeki
    // (BTC dahil) composeScoreInput() çağrılarının aynı cycle içinde güncel
    // değeri görmesi gerekiyor.
    const riskStore = useRiskStore.getState();

    void (async () => {
    const workPair = (pair: Pair): void => {
      const candles4h = candles[`${pair}_4h`] ?? EMPTY_CANDLES;
      const candles1h = candles[`${pair}_1h`] ?? EMPTY_CANDLES;
      const candles15m = candles[`${pair}_15m`] ?? EMPTY_CANDLES;
      const candles1d = candles[`${pair}_1d`] ?? EMPTY_CANDLES;

      const livePrice = marketStore.prices[pair]?.last ?? null;
      const fg = macroStore.fgValue ?? 50;
      const fundingResult = macroStore.funding[pair as Pair] ?? null;
      const fundingRate = fundingResult?.fundingRate ?? null;

      const oiVelocityResult = macroStore.oiVelocity[pair as Pair] ?? null;
      const oiVelocityScore = oiVelocityScoreOrZero(oiVelocityResult);

      const openPositions = positionStore.positions.map((p) => ({
        pair: p.pair,
        direction: p.direction as "LONG" | "SHORT",
      }));

      const trades = tradesStore.trades
        .filter((t) => t.status === "closed" && t.exit != null)
        .map((t) => ({
          score: t.entryContext.score,
          pnlUsd: t.exit!.pnlUsd,
          closedAt: t.exit!.closedAt,
        }));

      const protocol = accountStore.drawdownProtocol;
      const drawdownProtocol = {
        tier: protocol.tier,
        minScore:
          protocol.tier === "locked"
            ? 999
            : protocol.tier === "restricted"
              ? 90
              : protocol.tier === "caution"
                ? 85
                : 80,
        label: protocol.label,
        reason: "",
      };

      // Pre-compute indicator candles (reused for sweep detection + S/R)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c4hInd = (candles4h as any[]).map(toIndicatorCandle);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c1hInd = (candles1h as any[]).map(toIndicatorCandle);
      const sweepDetection = detectLiquiditySweep(c1hInd, c4hInd);
      const sweep15m = sweepDetection
        ? {
            type: (sweepDetection.direction === "LONG" ? "bullish_sweep" : "bearish_sweep") as
              | "bullish_sweep"
              | "bearish_sweep",
            strength: sweepDetection.wickRatio,
          }
        : { type: null as null, strength: 0 };

      const input = composeScoreInput({
        pair,
        livePrice,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles4h: candles4h as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles1h: candles1h as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles15m: candles15m as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles1d: candles1d as any,
        fg,
        eventSkipUntil: null,
        btcCooldownUntil: riskStore.btcCooldownUntil || null,
        btcCooldownReason: riskStore.btcCooldownReason,
        btcSelfCooldownUntil: riskStore.btcSelfCooldownUntil || null,
        lockReleasedAt: riskStore.lockReleasedAt || null,
        openPositions,
        drawdownProtocol,
        trades,
        fundingRate,
        oiVelocityScore,
        oiVelocityResult,
        btcAdx1h,
        btcNearSR,
        srModifier: 0,
        sweep15m,
        timeQuality: computeTimeQuality(now),
        now,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mtfResult = computeMtfTrend(pair as Pair, candles1h as any, candles4h as any, candles1d as any);

      if (input) {
        try {
          // Pre-compute direction → S/R modifier (same pattern as server)
          const { direction } = inferDirection({
            px15: input.px15,
            px1h: input.px,
            px4h: input.px4h,
            ema21_15m: input.ema21_15m,
            ema50_1h: input.ema50_1h,
            ema200_1h: input.ema200_1h,
            ema50_4h: input.ema50_4h,
          } as DirectionInput);

          // GÖLGE MOD — lib/score/fundingPercentile.ts'i mevcut scoreFunding()'in
          // (scorers.ts, orchestrator.ts'in computeScore()'u içinde çağrılıyor)
          // YANINDA, paralel çalıştırır. Sonuç HİÇBİR YERE yazılmıyor, sadece
          // console.debug ile loglanıyor — result/verdict/skor hiç etkilenmiyor.
          // scorers.ts/orchestrator.ts/composeScoreInput.ts'e dokunulmadı.
          try {
            const rawHistory = macroStore.fundingHistory[pair as Pair] ?? [];
            const fundingSamples: FundingSample[] = rawHistory.map((s) => ({
              rate: s.rate,
              ageHours: (now - s.timestamp) / 3_600_000,
            }));
            const oldestSampleAgeHours =
              fundingSamples.length > 0
                ? Math.max(...fundingSamples.map((s) => s.ageHours))
                : 0;
            const shadowResult = scoreFundingPercentile(
              fundingRate,
              direction,
              fundingSamples,
              oldestSampleAgeHours,
            );
            console.debug("[shadow] sub_funding_percentile", {
              pair,
              ...shadowResult,
              sampleCount: fundingSamples.length,
              oldestSampleAgeHours: +oldestSampleAgeHours.toFixed(1),
            });
          } catch (shadowErr) {
            // Gölge hesaplama asla ana akışı etkilememeli — sessizce yutulmaz,
            // ama fırlatılmaz da (best-effort, tıpkı postToXBestEffort gibi).
            console.debug("[shadow] sub_funding_percentile hata:", shadowErr);
          }

          const srResult = detectSRLevels(c4hInd, c1hInd, input.px, direction, input.volRatio);
          const srModifier = srResult.modifier * SR_SCALE_FACTOR;
          // checkSrHardBlock (lib/score/blocks.ts) için ham detay — srModifier
          // ile AYNI srResult'tan, ayrıca hesap YAPILMIYOR. nearest_resistance/
          // nearest_support SrLevelEntry (price/type/strength/distance_pct)
          // döner, orchestrator.ts'in SrProximity'si (distance_pct/strength)
          // bunun yapısal bir alt kümesi — dönüşüm gerekmiyor.
          const scoreT0 = isDebug() ? performance.now() : 0;
          // Hysteresis: bir önceki cycle'da bu pair için hesaplanan verdict.
          // undefined/skip sentinel (null) → smoothing atlanır (computeScore
          // içindeki applyHysteresis geriye dönük uyumlu tasarlandı).
          const prevVerdict = useScoreStore.getState().results[pair as Pair]?.verdict ?? null;
          const result = computeScore({
            ...input,
            srModifier,
            srNearestResistance: srResult.levels.nearest_resistance,
            srNearestSupport: srResult.levels.nearest_support,
            srBreakoutOverride: srResult.meta.breakoutOverride,
            scorerWeights: scorerWeights ?? null,
            mtfResult,
            prevVerdict,
          });
          perfLog({ type: "score_compute", pair, durationMs: +((performance.now() - scoreT0).toFixed(2)) });

          // İNSAN TRADER KONTROLÜ (1. tur — çizim yok, sadece deterministik
          // sayısal onay) — lib/score/*'a hiç dokunmadan, computeScore()'un
          // ÇIKTISI post-process ediliyor. Sadece verdict "go" + yön belliyse
          // çalışır (NEUTRAL/wait/no için gereksiz). srResult ZATEN yukarıda
          // (satır 414) skor için hesaplanmıştı — tekrar hesaplanmıyor.
          let finalResult = result;
          if (result.verdict === "go" && result.direction !== "NEUTRAL") {
            const humanCheck = checkHumanTraderApproval({
              direction: result.direction,
              currentPrice: input.px,
              candles1h,
              srResult,
              volRatio: input.volRatio,
            });
            if (!humanCheck.approved) {
              finalResult = { ...result, verdict: "wait" };
              console.debug(
                `[humanTraderCheck] ${pair} GO→WAIT (reddedildi):`,
                humanCheck.reasons.join(" | "),
              );
            }
          }
          setResult(pair as Pair, finalResult, now);
        } catch {
          // Ignore scoring errors — stale result remains until next candle update
        }
      } else {
        // composeScoreInput returned null: insufficient candles for this pair.
        // Write null sentinel so equality fn stops treating this pair as
        // "never scored" — prevents perpetual re-trigger on data-starved pairs.
        setSkipped(pair as Pair, now);
      }
    };

    // runWithIdleBudget: ilk pair yield'siz hemen başlar (deadline null →
    // "hemen çalıştır" dalı), sonraki pair'ler arasında idle-slot bütçesine
    // göre dinamik yield kararı verilir — bkz. fonksiyon üstü yorum.
    const { yieldCount } = await runWithIdleBudget(PAIRS, workPair, { isCancelled: () => cancelled });
    // Eski koddaki "if (cancelled) return;" davranışı korunuyor — cancel
    // olduysa final perfLog de atlanır (runWithIdleBudget içindeki `break`
    // bunu kendi başına yapmaz, döngüden çıkıp fonksiyonu normal tamamlar).
    if (cancelled) return;
    perfLog({
      type: "engine_cycle",
      totalMs: +((performance.now() - engineT0).toFixed(1)),
      pairs: PAIRS.length,
      yieldCount,
    });
    })();
    return () => { cancelled = true; };
  }, [candles, setResult, scorerWeights]);
}
