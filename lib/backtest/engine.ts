/**
 * BACKTEST ENGINE — Pure function. No React, no Zustand, no browser APIs.
 *
 * Algorithm:
 *   1. Build a 4h→1h pointer map (O(n+m) alignment)
 *   2. Iterate 1h bars from index WARMUP onward (sliding window)
 *   3. For each bar: compose score input → computeScore
 *   4. GO verdict → compute SL/TP → simulateExit on future bars
 *   5. Accumulate trades, compute stats
 *
 * Timeframes used:
 *   - 1h bars: primary iteration (one signal-check per bar)
 *   - 4h bars: trend context window (last 200 4h bars aligned by ts)
 *   - 15m proxy: last 25 1h bars (same data — px15/ema21_15m approximation)
 *
 * Macro frozen:
 *   - F&G = frozenFg (default 50/neutral)
 *   - OI velocity = null (not available in history)
 *   - Funding = null (ignored in scoring)
 *   - Risk state = default ("normal" tier, no cooldowns)
 */

import { composeScoreInput } from "@/lib/score/composeScoreInput";
import { computeScore } from "@/lib/score/orchestrator";
import { evaluateBtcMovement, deriveBtcMovementInput, BTC_COOLDOWN_CONSTANTS } from "@/lib/risk/btc-cooldown";
import { computeTimeQuality } from "@/lib/market/timeQuality";
import { computeAdaptiveTPs } from "@/lib/sizer/take-profit";
import { computeStructuralStop } from "@/lib/sizer/stop";
import type { Candle } from "@/lib/okx/candles";
import { simulateExit, simpleAtr } from "./exitSimulator";
import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  ScoreBucket,
  DirectionStats,
  BacktestStats,
} from "./types";
import type { Pair } from "@/lib/constants/pairs";
import type { Trade } from "@/lib/bucket/stats";
import type { ScoreInput, Verdict } from "@/lib/score/orchestrator";
import type { SweepInput } from "@/lib/score/scorers";

/** Minimum bars of 1h context required before a signal is valid */
const WARMUP = 210;
/** Use last 200 4h bars for trend context */
const C4H_WINDOW = 200;
/** Use last 200 1d bars for daily trend context (composeScoreInput needs ≥50 for ema50_1d) */
const C1D_WINDOW = 200;
/** Use last 25 1h bars as 15m proxy (ema21_15m approximation) */
const C15M_PROXY = 25;
/** Maximum 1h bars to hold a trade before timing out */
const MAX_HOLD_BARS = 48;
/** Yield to event loop every N bars to keep UI responsive */
const YIELD_EVERY = 100;

/** Frozen risk/macro state for backtesting */
const FROZEN_STATE = {
  eventSkipUntil: null,
  btcCooldownUntil: null,
  btcCooldownReason: "",
  btcSelfCooldownUntil: null,
  lockReleasedAt: null,
  openPositions: [] as ScoreInput["openPositions"],
  drawdownProtocol: {
    tier: "normal" as const,
    minScore: 80,
    label: "Normal",
    reason: "",
  },
  trades: [] as readonly Trade[],
  srModifier: 0,
  sweep15m: { type: null, strength: 0 } as SweepInput,
  // timeQuality BURADA YOK — bar.ts'e bağlı olduğu için sabit dondurulamaz,
  // her bar için computeTimeQuality(bar.ts) ile dinamik hesaplanıp composeScoreInput
  // çağrısında ayrıca override ediliyor (bkz. aşağıdaki ana döngü).
};

/** Align 4h bars to 1h bars (precompute pointer array in O(n+m)) */
function build4hPointers(
  candles1h: readonly Candle[],
  candles4h: readonly Candle[],
): Int32Array {
  const ptrs = new Int32Array(candles1h.length).fill(-1);
  let j = 0;
  for (let i = 0; i < candles1h.length; i++) {
    const ts1h = candles1h[i].ts;
    while (j < candles4h.length - 1 && candles4h[j + 1].ts <= ts1h) j++;
    if (j < candles4h.length && candles4h[j].ts <= ts1h) ptrs[i] = j;
  }
  return ptrs;
}

/** Align 1d bars to 1h bars (precompute pointer array in O(n+m)) — same alignment logic as build4hPointers */
function build1dPointers(
  candles1h: readonly Candle[],
  candles1d: readonly Candle[],
): Int32Array {
  const ptrs = new Int32Array(candles1h.length).fill(-1);
  let j = 0;
  for (let i = 0; i < candles1h.length; i++) {
    const ts1h = candles1h[i].ts;
    while (j < candles1d.length - 1 && candles1d[j + 1].ts <= ts1h) j++;
    if (j < candles1d.length && candles1d[j].ts <= ts1h) ptrs[i] = j;
  }
  return ptrs;
}

function computeRatios(trades: BacktestTrade[]): { sharpe: number | null; sortino: number | null } {
  if (trades.length < 5) return { sharpe: null, sortino: null };
  const rs = trades.map((t) => t.rMultiple);
  const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
  const variance = rs.reduce((s, r) => s + (r - mean) ** 2, 0) / rs.length;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? mean / std : null;
  const downVar = rs.filter((r) => r < 0).reduce((s, r) => s + r ** 2, 0) / rs.length;
  const sortino = downVar > 0 ? mean / Math.sqrt(downVar) : null;
  return { sharpe, sortino };
}

function computeStats(trades: BacktestTrade[]): BacktestStats {
  const wins = trades.filter((t) => t.rMultiple > 0);
  const losses = trades.filter((t) => t.rMultiple <= 0);

  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgR =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length
      : null;

  // Peak-to-trough R drawdown
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const t of trades) {
    equity += t.rMultiple;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }

  // Streak computation
  let curStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let streakType: "win" | "loss" | null = null;
  for (const t of trades) {
    const w = t.rMultiple > 0;
    const type = w ? "win" : "loss";
    if (type === streakType) {
      curStreak++;
    } else {
      if (streakType === "win") maxWinStreak = Math.max(maxWinStreak, curStreak);
      else if (streakType === "loss") maxLossStreak = Math.max(maxLossStreak, curStreak);
      streakType = type;
      curStreak = 1;
    }
  }
  if (streakType === "win") maxWinStreak = Math.max(maxWinStreak, curStreak);
  else if (streakType === "loss") maxLossStreak = Math.max(maxLossStreak, curStreak);

  // Score buckets: <80, 80-84, 85-89, 90-94, 95+
  const BUCKETS: Array<{ label: string; min: number; max: number }> = [
    { label: "<80", min: 0, max: 79 },
    { label: "80-84", min: 80, max: 84 },
    { label: "85-89", min: 85, max: 89 },
    { label: "90-94", min: 90, max: 94 },
    { label: "95+", min: 95, max: 100 },
  ];
  const byScoreBucket: ScoreBucket[] = BUCKETS.map((b) => {
    const bt = trades.filter((t) => t.score >= b.min && t.score <= b.max);
    const bw = bt.filter((t) => t.rMultiple > 0);
    const avgBr = bt.length > 0 ? bt.reduce((s, t) => s + t.rMultiple, 0) / bt.length : null;
    return {
      ...b,
      count: bt.length,
      winCount: bw.length,
      winRate: bt.length > 0 ? (bw.length / bt.length) * 100 : null,
      avgR: avgBr,
    };
  });

  // Direction breakdown
  function dirStats(dir: "LONG" | "SHORT"): DirectionStats {
    const dt = trades.filter((t) => t.direction === dir);
    const dw = dt.filter((t) => t.rMultiple > 0);
    return {
      count: dt.length,
      winCount: dw.length,
      winRate: dt.length > 0 ? (dw.length / dt.length) * 100 : null,
    };
  }

  const grossWins = wins.reduce((s, t) => s + t.rMultiple, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? Infinity : null);

  return {
    totalTrades: trades.length,
    winCount: wins.length,
    loseCount: losses.length,
    winRate,
    avgRMultiple: avgR,
    maxDrawdownR: maxDd,
    maxWinStreak,
    maxLossStreak,
    profitFactor,
    ...computeRatios(trades),
    byScoreBucket,
    byDirection: { LONG: dirStats("LONG"), SHORT: dirStats("SHORT") },
  };
}

/**
 * Run backtest.
 *
 * @param candles1h Full 1h history (oldest → newest)
 * @param candles4h Full 4h history (oldest → newest)
 * @param config Backtest parameters
 * @param onProgress Optional progress callback (0–1)
 */
export async function runBacktest(
  candles1h: readonly Candle[],
  candles4h: readonly Candle[],
  config: BacktestConfig,
  onProgress?: (pct: number) => void,
  /**
   * BTC referans mumları — cooldown simülasyonu için (bkz. lib/risk/btc-cooldown.ts).
   * OPSİYONEL: verilmezse mevcut davranış (btcCooldownUntil/btcSelfCooldownUntil hep null,
   * yani cooldown hiç simüle edilmez) birebir korunur — geriye dönük uyumlu. config.pair
   * "BTC" ise ve self-cooldown simüle edilmek isteniyorsa, caller candles1h/candles4h'in
   * KENDİSİNİ burada da geçirmeli (engine burada otomatik bir fallback UYGULAMAZ).
   */
  btcCandles1h?: readonly Candle[],
  btcCandles4h?: readonly Candle[],
  /**
   * 1D mumlar — canlı sistemle (useScoreEngine.ts) parite için: composeScoreInput()
   * bunlardan ema50_1d hesaplıyor, orchestrator'daki checkDailyTrendOpposite
   * softBlock'u bu değer olmadan HER bar'da tetikleniyordu (verdict hiçbir zaman
   * "go" olamıyordu). OPSİYONEL: verilmezse mevcut davranış (ema50_1d hep null,
   * softBlock her bar'da tetiklenir) birebir korunur — geriye dönük uyumlu.
   */
  candles1d?: readonly Candle[],
): Promise<BacktestResult> {
  const trades: BacktestTrade[] = [];
  const ptrs = build4hPointers(candles1h, candles4h);
  const ptrs1d = candles1d ? build1dPointers(candles1h, candles1d) : null;
  const total = candles1h.length - WARMUP;

  // BTC cooldown historical state — sadece btcCandles1h/4h verildiyse ilerletilir.
  // Pointer'lar SADECE ileri hareket eder (bar.ts artan sırada işlendiği için O(n+m)).
  const btcConfirmed1h = btcCandles1h?.filter((c) => c.confirm) ?? [];
  const btcConfirmed4h = btcCandles4h?.filter((c) => c.confirm) ?? [];
  let btcPtr1h = -1;
  let btcPtr4h = -1;
  let btcAltUntil = 0;
  let btcSelfUntil = 0;
  let btcReason = "";

  // Hysteresis: fonksiyon-lokal — her runBacktest() çağrısı kendi stack frame'inde
  // sıfırdan başlar, bu yüzden pariteler arası SIZINTI yapısal olarak imkansız
  // (bkz. tests/integration/hysteresis.test.ts, "prevVerdict sızmıyor" testi).
  let prevVerdict: Verdict | null = null;

  for (let i = WARMUP; i < candles1h.length; i++) {
    // Progress + yield to event loop every YIELD_EVERY bars
    if ((i - WARMUP) % YIELD_EVERY === 0) {
      onProgress?.((i - WARMUP) / total);
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    const bar = candles1h[i];
    // 15m proxy: last C15M_PROXY 1h bars (closes are same — ema21_15m approximation)
    const c15m = candles1h.slice(Math.max(0, i - C15M_PROXY + 1), i + 1);
    const c1h = candles1h.slice(Math.max(0, i - 209), i + 1);
    const ptr4h = ptrs[i];
    if (ptr4h < 0) continue; // not enough 4h data yet

    // Multi-TF: when signalTf === "4h", only fire on first 1h bar of a new 4h candle
    if (config.signalTf === "4h" && ptrs[i] === ptrs[i - 1]) continue;

    const c4h = candles4h.slice(Math.max(0, ptr4h - C4H_WINDOW + 1), ptr4h + 1);
    const c1d = ptrs1d
      ? candles1d!.slice(Math.max(0, ptrs1d[i] - C1D_WINDOW + 1), ptrs1d[i] + 1)
      : undefined;

    if (c1h.length < 200 || c4h.length < 200 || c15m.length < 20) continue;

    // BTC cooldown historical simülasyon — bar.ts anına kadar bilinen BTC hareketiyle
    // (bkz. lib/risk/btc-cooldown.ts). btcCandles1h/4h verilmediyse btcConfirmed1h/4h
    // boş kalır, aşağıdaki blok hiç tetiklenmez → btcCooldownUntil/btcSelfCooldownUntil
    // FROZEN_STATE'teki gibi null kalır (mevcut davranış korunur).
    if (btcConfirmed1h.length > 1 && btcConfirmed4h.length > 1) {
      while (btcPtr1h + 1 < btcConfirmed1h.length && btcConfirmed1h[btcPtr1h + 1].ts <= bar.ts) btcPtr1h++;
      while (btcPtr4h + 1 < btcConfirmed4h.length && btcConfirmed4h[btcPtr4h + 1].ts <= bar.ts) btcPtr4h++;
      if (btcPtr1h >= 1 && btcPtr4h >= 1) {
        const movementInput = deriveBtcMovementInput(
          btcConfirmed1h[btcPtr1h],
          btcConfirmed1h[btcPtr1h - 1],
          btcConfirmed4h[btcPtr4h],
          btcConfirmed4h[btcPtr4h - 1],
        );
        if (movementInput) {
          const movement = evaluateBtcMovement(movementInput);
          if (movement.triggered) {
            btcAltUntil = Math.max(btcAltUntil, bar.ts + BTC_COOLDOWN_CONSTANTS.ALT_COOLDOWN_MS);
            btcSelfUntil = Math.max(btcSelfUntil, bar.ts + BTC_COOLDOWN_CONSTANTS.SELF_COOLDOWN_MS);
            btcReason = movement.reason;
          }
        }
      }
    }
    const btcCooldownUntil = config.pair !== "BTC" && btcAltUntil > bar.ts ? btcAltUntil : null;
    const btcSelfCooldownUntil = config.pair === "BTC" && btcSelfUntil > bar.ts ? btcSelfUntil : null;

    const composed = composeScoreInput({
      pair: config.pair,
      livePrice: bar.close,
      candles1h: c1h as Candle[],
      candles4h: c4h as Candle[],
      candles15m: c15m as Candle[],
      candles1d: c1d as Candle[],
      fg: config.frozenFg,
      fundingRate: null,
      oiVelocityScore: null,
      now: bar.ts,
      ...FROZEN_STATE,
      btcCooldownUntil,
      btcCooldownReason: btcCooldownUntil || btcSelfCooldownUntil ? btcReason : "",
      btcSelfCooldownUntil,
      timeQuality: computeTimeQuality(bar.ts),
    });
    if (!composed) continue;

    const result = computeScore({
      ...composed,
      scorerWeights: config.scorerWeights ?? null,
      prevVerdict,
    });
    // "continue" ile atlanan bar YOK — bu satır her computeScore() çağrısından
    // hemen sonra, herhangi bir erken çıkıştan ÖNCE çalışır. Böylece prevVerdict
    // her zaman "en son GERÇEKTEN hesaplanan verdict"i temsil eder.
    prevVerdict = result.verdict;
    if (result.verdict !== "go") continue;
    if (config.minScore && result.score < config.minScore) continue;

    if (result.direction !== "LONG" && result.direction !== "SHORT") continue;
    const direction = result.direction;

    // Entry: next bar's open price + entry slippage (market order fills worse)
    const nextBar = candles1h[i + 1];
    if (!nextBar) continue;
    const slippage = config.slippagePct ?? 0;
    const entrySlipFactor = direction === "LONG" ? 1 + slippage : 1 - slippage;
    const entryPrice = nextBar.open * entrySlipFactor;
    const atr = simpleAtr(c1h);
    if (atr <= 0) continue;

    // SL: structural stop (no swing data in backtest → ATR fallback 1.5×)
    const sl = computeStructuralStop(direction, entryPrice, atr, null, null);
    // TP: ADX-adaptive
    const tp = computeAdaptiveTPs(direction, entryPrice, atr, composed.adx);

    const future = candles1h.slice(i + 2);
    const exit = simulateExit(
      direction,
      entryPrice,
      sl.stopPrice,
      tp.tp1Price,
      tp.tp2Price,
      future,
      MAX_HOLD_BARS,
    );

    // Exit slippage: SL and timeout are market orders → slip against direction
    const isMarketExit = exit.exitReason === "sl" || exit.exitReason === "timeout";
    const exitSlipFactor = isMarketExit
      ? (direction === "LONG" ? 1 - slippage : 1 + slippage)
      : 1;
    const effectiveExitPrice = exit.exitPrice * exitSlipFactor;

    const priceDelta = (effectiveExitPrice - entryPrice) * (direction === "LONG" ? 1 : -1);
    const rMultiple = sl.stopDistance > 0 ? priceDelta / sl.stopDistance : 0;
    const pnlPct = entryPrice > 0 ? (priceDelta / entryPrice) * 100 : 0;

    // Fee model: both entry and exit use taker rate (market orders)
    const takerFee = config.takerFee ?? 0.0005;
    const fundingRateHourly = config.fundingRateHourly ?? 0;
    const exitEntryRatio = entryPrice > 0 ? effectiveExitPrice / entryPrice : 1;
    const roundTripFeePct = takerFee * (1 + exitEntryRatio) * 100;
    const fundingCostPct = fundingRateHourly * exit.barsHeld * 100;
    const feesPct = roundTripFeePct + fundingCostPct;
    const netPnlPct = pnlPct - feesPct;

    trades.push({
      pair: config.pair,
      direction,
      entryTs: nextBar.ts,
      entryPrice,
      exitTs: exit.exitTs,
      exitPrice: effectiveExitPrice,
      exitReason: exit.exitReason,
      tp1Price: tp.tp1Price,
      tp2Price: tp.tp2Price,
      stopPrice: sl.stopPrice,
      score: result.score,
      rMultiple,
      pnlPct,
      barsHeld: exit.barsHeld,
      feesPct,
      netPnlPct,
      // Pooled trade-level analiz için (bkz. exportPooledResults, useBacktest.ts) —
      // zaten computeScore()'un döndürdüğü alanlar, saf kopya, skor mantığına dokunulmadı.
      regime: result.regime,
      subScores: result.sub,
      oiBonus: result.oiBonus,
      srModifier: result.srModifier,
      regimeBonus: result.regimeBonus,
      sweepBonus: result.sweepBonus,
    });
  }

  onProgress?.(1);
  return {
    pair: config.pair as Pair,
    trades,
    stats: computeStats(trades),
    runAt: Date.now(),
    dataMonths: config.dataMonths,
    totalBarsScanned: total,
    scorerWeights: config.scorerWeights ?? null,
  };
}
