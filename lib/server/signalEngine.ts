/**
 * SERVER-SIDE SIGNAL ENGINE — Cron job score computation.
 *
 * Fetches OKX candles directly (public API — no signing needed),
 * runs the same composeScoreInput + computeScore pipeline as the browser.
 * Stateless: deduplication via two-bar comparison (no DB required).
 *
 * Used by: /api/cron/signal-check, /api/cron/daily-summary
 */

import { composeScoreInput } from "@/lib/score/composeScoreInput";
import { computeScore } from "@/lib/score/orchestrator";
import { inferDirection, type DirectionInput } from "@/lib/score/direction";
import { detectSRLevels } from "@/lib/sr/detect";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { SR_SCALE_FACTOR } from "@/lib/score/version";
import { detectLiquiditySweep } from "@/lib/sr/sweep";
import { computeMtfTrend } from "@/lib/market/mtfTrend";
import { computeTimeQuality } from "@/lib/market/timeQuality";
import type { Pair } from "@/lib/constants/pairs";
import type { Candle } from "@/lib/okx/candles";
import { fetchFearGreed } from "@/lib/macro/fetch";
import {
  computeOiVelocityWindow,
  oiVelocityScoreOrZero,
  type OiSnapshot,
  type OiVelocityResult,
} from "@/lib/market/oi-velocity";
import { loadOiSnapshotCache, saveOiSnapshotCache } from "@/lib/db/oiSnapshotCache";

const OKX_BASE = "https://www.okx.com";
const CANDLE_MIN_1H = 200;
const CANDLE_MIN_4H = 200;
const CANDLE_MIN_15M = 20;

// OI snapshot cache — ARTIK modül-seviyesinde in-memory DEĞİL (bkz. Phase 1.0,
// OI Runtime Verification): saatlik cron'un neredeyse her çalışması yeni bir
// serverless container'da (cold start) başlıyor, in-memory Map bu yüzden asla
// 1'den fazla snapshot biriktiremiyordu — computeOiVelocityWindow() en az 2
// istiyor, sonuç hep null/0. Kalıcılık artık oi_snapshot_cache tablosundan
// (lib/db/oiSnapshotCache.ts) geliyor; caller (computeAllSignals) cron
// başında yükleyip sonunda geri yazıyor, appendOiAndGetVelocity() kendisine
// verilen Map'i günceller.
// Phase 1.0 sonrası düzeltme (05 Ağu 2026 — score_history verisiyle ölçüldü):
// 2 saatlik pencere + saatlik cron kombinasyonu, snapshot sayısını
// matematiksel olarak 2-3'te platoluyordu — OI_SNAP_MAX=10'a hiçbir zaman
// ulaşılamıyordu (yaş filtresi adet sınırından önce devreye giriyor).
// 6 saate çıkarmak, computeOiVelocityWindow'un istediği windowSize=5'e daha
// yakın bir veri penceresi sağlıyor. Export edilmiş: hem
// tests/integration/oi-snapshot-trim.test.ts hem gelecekteki okuma bu
// sabitleri gerçek kaynaktan alıyor, tekrar sabit-kodlanmış bir kopya
// sürüklenip yanlış senkron olmasın diye.
export const OI_SNAP_MAX_AGE_MS = 6 * 60 * 60_000; // 6 saat
export const OI_SNAP_MAX = 10;

// Son başarılı fetch değerleri — geçici API kesintisinde frozen default'a düşmesin.
// Cache boşken (ilk soğuk başlangıç) eski davranışa düşülür — kabul edilebilir.
const _lastFundingRate = new Map<string, number>(); // instId → last successful rate
let _lastFg: number | null = null;

/** Frozen risk/macro state — mirrors backtest engine FROZEN_STATE.
 *  srModifier and sweep15m intentionally excluded: computed dynamically in fetchAndScore. */
const FROZEN_STATE = {
  eventSkipUntil: null,
  btcCooldownUntil: null,
  btcCooldownReason: "",
  btcSelfCooldownUntil: null,
  lockReleasedAt: null,
  openPositions: [] as [],
  drawdownProtocol: {
    tier: "normal" as const,
    minScore: 80,
    label: "Normal",
    reason: "",
  },
  trades: [] as [],
  // timeQuality BURADA YOK — latest.ts'e bağlı olduğu için sabit dondurulamaz,
  // computeTimeQuality(latest.ts) ile fetchAndScore() içinde ayrıca override ediliyor.
};

export interface ServerSignalResult {
  pair: Pair;
  verdict: "go" | "wait" | "no";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
  prevVerdict: "go" | "wait" | "no" | null;
  isNewSignal: boolean;
  price: number;
  error?: string;
  debugInputs?: { fg: number; fundingRate: number | null; oiVelocityScore: number };
  // Sub-scores and signal metadata — verdict'ten BAĞIMSIZ, computeServerSignal
  // başarılı her pair için doldurur (sadece error path'te undefined kalır).
  // Önceden burada "populated on GO verdicts" yazıyordu — computeServerSignal'ın
  // kendisi hiç verdict'e göre dallanmadığı için bu YANLIŞTI (score_history
  // eklenirken fark edildi, düzeltildi): go_signals'a yazan cron kodu sadece
  // newSignals'ı filtrelediği için pratikte öyle GÖRÜNÜYORDU, ama alan aslında
  // WAIT/NO'da da hep dolu — score_history bunu şimdi gerçekten kullanıyor.
  signalTs?: number;
  sub?: { trend: number; adx: number; rsi: number; vol: number; bb: number; vwap: number; funding: number; macro: number };
  baseScore?: number;
  effectiveThreshold?: number;
  regime?: string;
  adaptiveRegime?: string;
  atrPercentile?: number | null;
  sweepBonus?: number;
  regimeBonus?: number;
  overextFlags?: number;
  /** detectSRLevels()'in ham (ölçeklenmemiş) cezası — lib/sr/detect.ts, max -30 */
  srModifierRaw?: number;
  /** Skora gerçekte eklenen değer — srModifierRaw × SR_SCALE_FACTOR (lib/score/version.ts) */
  srModifierApplied?: number;
  blocks?: string[];
  softBlocks?: string[];
  pullbackActive?: boolean;
  /** oiVelocityScore hesaplanırken mevcut olan snapshot sayısı — tanısal,
   *  oi_snapshot_cache kalıcılığının gerçekten çalıştığını doğrulamak için
   *  (bkz. migration 014). */
  oiSnapshotCount?: number;
}

/** Fetch OKX public candles — no auth required */
async function fetchOkxCandles(instId: string, bar: string, limit: number): Promise<Candle[]> {
  const url = `${OKX_BASE}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { code: string; data?: string[][] };
    if (json.code !== "0" || !Array.isArray(json.data)) return [];
    return json.data
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        confirm: row[8] === "1",
      }))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/** OKX funding rate — public API, proxy gerektirmez */
async function fetchOkxFundingRate(instId: string): Promise<number | null> {
  const url = `${OKX_BASE}/api/v5/public/funding-rate?instId=${encodeURIComponent(instId)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { code: string; data?: Array<{ fundingRate: string }> };
    if (json.code !== "0" || !json.data?.[0]) return null;
    const rate = parseFloat(json.data[0].fundingRate);
    return isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}

/** OKX open interest — public API, proxy gerektirmez */
async function fetchOkxOpenInterest(
  instId: string,
): Promise<{ oi: number; oiCcy: number } | null> {
  const url = `${OKX_BASE}/api/v5/public/open-interest?instType=SWAP&instId=${encodeURIComponent(instId)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code: string;
      data?: Array<{ oi: string; oiCcy: string }>;
    };
    if (json.code !== "0" || !json.data?.[0]) return null;
    const oi = parseFloat(json.data[0].oi);
    const oiCcy = parseFloat(json.data[0].oiCcy);
    if (!isFinite(oi) && !isFinite(oiCcy)) return null;
    return { oi: isFinite(oi) ? oi : 0, oiCcy: isFinite(oiCcy) ? oiCcy : 0 };
  } catch {
    return null;
  }
}

/** OI snapshot'ı (caller'dan verilen kalıcı) cache'e ekle, velocity skoru +
 *  ham sonuç + tanısal snapshot sayısını döndür. `cache` çağıran tarafça
 *  yüklenip (loadOiSnapshotCache) tüm pariteler bittikten sonra geri
 *  yazılıyor (saveOiSnapshotCache) — bkz. computeAllSignals().
 *  Export edilmiş: tests/integration/oi-snapshot-trim.test.ts trim/yaş
 *  mantığını (OI_SNAP_MAX/OI_SNAP_MAX_AGE_MS) doğrudan bu fonksiyonu
 *  çağırarak doğruluyor — network/DB mock'una gerek kalmadan saf mantık testi. */
export function appendOiAndGetVelocity(
  pair: Pair,
  oiResult: { oi: number; oiCcy: number } | null,
  price: number,
  now: number,
  cache: Map<string, OiSnapshot[]>,
): { score: number; result: OiVelocityResult | null; snapshotCount: number } {
  if (!oiResult || price <= 0) {
    return { score: 0, result: null, snapshotCount: cache.get(pair)?.length ?? 0 };
  }
  const oiVal = oiResult.oiCcy > 0 ? oiResult.oiCcy : oiResult.oi;
  if (oiVal <= 0) {
    return { score: 0, result: null, snapshotCount: cache.get(pair)?.length ?? 0 };
  }
  const prev = cache.get(pair) ?? [];
  const trimmed = prev.filter((s) => now - s.timestamp < OI_SNAP_MAX_AGE_MS);
  const updated = [
    ...trimmed.slice(-(OI_SNAP_MAX - 1)),
    { timestamp: now, openInterest: oiVal, price },
  ];
  cache.set(pair, updated);
  const velocityResult = computeOiVelocityWindow(updated, pair, 5);
  return {
    score: oiVelocityScoreOrZero(velocityResult),
    result: velocityResult,
    snapshotCount: updated.length,
  };
}

/** Score a single pair using server-fetched candles.
 *  `oiCache`: computeAllSignals() tarafından cron başında Supabase'den
 *  yüklenen, tüm pariteler arasında paylaşılan kalıcı OI snapshot haritası. */
async function fetchAndScore(pair: Pair, oiCache: Map<string, OiSnapshot[]>): Promise<{
  candles1h: Candle[];
  candles4h: Candle[];
  candles1d: Candle[];
  score: number;
  verdict: "go" | "wait" | "no";
  direction: "LONG" | "SHORT" | "NEUTRAL";
  price: number;
  fg: number;
  fundingRate: number | null;
  oiVelocityScore: number;
  oiVelocityResult: OiVelocityResult | null;
  oiSnapshotCount: number;
  signalTs: number;
  sub: { trend: number; adx: number; rsi: number; vol: number; bb: number; vwap: number; funding: number; macro: number };
  baseScore: number;
  effectiveThreshold: number;
  regime: string;
  /** Phase 1 — Market Regime Detection (Signal Engine v2 bağlam katmanı).
   *  `regime`'in aksine baseScore gate'i yok, her zaman anlamlı. */
  adaptiveRegime: string;
  atrPercentile: number | null;
  sweepBonus: number;
  regimeBonus: number;
  overextFlags: number;
  srModifierRaw: number;
  srModifierApplied: number;
  blocks: string[];
  softBlocks: string[];
  pullbackActive: boolean;
  prevVerdict: "go" | "wait" | "no" | null;
} | null> {
  const instId = `${pair}-USDT-SWAP`;
  const now = Date.now();
  const [raw1h, raw4h, rawFundingRate, oiResult, fgResult, raw1d, raw15m] = await Promise.all([
    fetchOkxCandles(instId, "1H", 300),
    fetchOkxCandles(instId, "4H", 300),
    fetchOkxFundingRate(instId),
    fetchOkxOpenInterest(instId),
    fetchFearGreed(now),
    fetchOkxCandles(instId, "1D", 60),
    fetchOkxCandles(instId, "15m", 40), // CANDLE_MIN_15M (20) + pay
  ]);

  // Only use confirmed (closed) bars
  const candles1h = raw1h.filter((c) => c.confirm);
  const candles4h = raw4h.filter((c) => c.confirm);
  const candles1d = raw1d.filter((c) => c.confirm);
  const candles15m = raw15m.filter((c) => c.confirm);

  if (candles1h.length < CANDLE_MIN_1H || candles4h.length < CANDLE_MIN_4H) return null;

  const latest = candles1h[candles1h.length - 1];

  if (candles15m.length < CANDLE_MIN_15M) return null;

  const { score: oiVelocityScore, result: oiVelocityResult, snapshotCount: oiSnapshotCount } =
    appendOiAndGetVelocity(pair, oiResult, latest.close, now, oiCache);

  // F&G: source "fallback" → fetchFearGreed'in kendi TTL cache'i boşalmış + API down.
  // _lastFg varsa kullan; cold start'ta kabul edilebilir fallback (50).
  const fg: number = (() => {
    if (fgResult.source !== "fallback") {
      _lastFg = fgResult.value;
      return fgResult.value;
    }
    return _lastFg ?? fgResult.value;
  })();

  // Funding: null → fetch hatası → instId için son başarılı değeri kullan.
  const fundingRate: number | null = (() => {
    if (rawFundingRate !== null) {
      _lastFundingRate.set(instId, rawFundingRate);
      return rawFundingRate;
    }
    return _lastFundingRate.get(instId) ?? null;
  })();

  // Pre-compute indicator candles (reused for sweep detection + S/R)
  const c4hInd = candles4h.map(toIndicatorCandle);
  const c1hInd = candles1h.map(toIndicatorCandle);
  const sweepDetection = detectLiquiditySweep(c1hInd, c4hInd);
  const sweep15m = sweepDetection
    ? {
        type: (sweepDetection.direction === "LONG" ? "bullish_sweep" : "bearish_sweep") as
          | "bullish_sweep"
          | "bearish_sweep",
        strength: sweepDetection.wickRatio,
      }
    : { type: null as null, strength: 0 };

  const composed = composeScoreInput({
    pair,
    livePrice: latest.close,
    candles1h,
    candles4h,
    candles15m,
    candles1d,
    fg,
    fundingRate,
    oiVelocityScore,
    oiVelocityResult,
    now: latest.ts,
    srModifier: 0,
    sweep15m,
    ...FROZEN_STATE,
    timeQuality: computeTimeQuality(latest.ts),
  });

  if (!composed) return null;

  // Direction → S/R modifier (c4hInd/c1hInd pre-computed above)
  const { direction } = inferDirection({
    px15: composed.px15,
    px1h: composed.px,
    px4h: composed.px4h,
    ema21_15m: composed.ema21_15m,
    ema50_1h: composed.ema50_1h,
    ema200_1h: composed.ema200_1h,
    ema50_4h: composed.ema50_4h,
  } as DirectionInput);
  const srResult = detectSRLevels(c4hInd, c1hInd, composed.px, direction, composed.volRatio);
  const srModifier = srResult.modifier * SR_SCALE_FACTOR;
  // checkSrHardBlock (lib/score/blocks.ts) için ham detay — useScoreEngine.ts
  // (client) ile BİREBİR aynı desen, aynı srResult'tan, ek hesap yok.

  const mtfResult = computeMtfTrend(pair, candles1h, candles4h, candles1d);
  // Hysteresis: bir önceki bar'ın verdict'i. scorePrevBar() zaten burada gereken
  // TÜM veriye (candles1h/4h/1d, fg, fundingRate) sahip — computeServerSignal()'ın
  // AYRICA ikinci kez çağırmasına gerek yok, tek hesap burada yapılıp döndürülüyor
  // (verimlilik yan etkisi: composeScoreInput+computeScore'un ikinci kez
  // tekrarlanması önleniyor).
  const prevVerdict = scorePrevBar(candles1h, candles4h, candles1d, candles15m, pair, fg, fundingRate);
  const result = computeScore({
    ...composed,
    srModifier,
    srNearestResistance: srResult.levels.nearest_resistance,
    srNearestSupport: srResult.levels.nearest_support,
    srBreakoutOverride: srResult.meta.breakoutOverride,
    scorerWeights: null,
    mtfResult,
    prevVerdict,
  });

  return {
    candles1h,
    candles4h,
    candles1d,
    score: result.score,
    verdict: result.verdict,
    direction: result.direction,
    price: latest.close,
    fg,
    fundingRate,
    oiVelocityScore,
    oiVelocityResult,
    oiSnapshotCount,
    // Kapanmış 1H mumun kendi ts'i DEĞİL — cron'un bu pair için veri çekmeye
    // başladığı an (composeScoreInput'a ayrıca geçilen "now: latest.ts" ile
    // KARIŞTIRILMASIN, o satıra dokunulmadı — skorlama mantığı mum bazlı zaman
    // kullanmaya devam ediyor, sadece DB'ye yazılan tetiklenme zamanı düzeldi).
    signalTs: now,
    sub: result.sub,
    baseScore: result.baseScore,
    effectiveThreshold: result.effectiveThreshold,
    regime: result.regime,
    adaptiveRegime: result.adaptiveRegime,
    atrPercentile: result.atrPercentile,
    sweepBonus: result.sweepBonus,
    regimeBonus: result.regimeBonus,
    overextFlags: result.overextFlags,
    srModifierRaw: srResult.modifier,
    srModifierApplied: result.srModifier,
    blocks: result.blocks,
    softBlocks: result.softBlocks,
    pullbackActive: result.pullbackActive,
    prevVerdict,
  };
}

/** Score using the second-to-last bar (for deduplication comparison) */
function scorePrevBar(
  candles1h: Candle[],
  candles4h: Candle[],
  candles1d: Candle[],
  candles15m: Candle[],
  pair: Pair,
  fg: number,
  fundingRate: number | null,
): "go" | "wait" | "no" | null {
  const prev1h = candles1h.slice(0, -1);
  const prevLatest = prev1h[prev1h.length - 1];
  if (!prevLatest) return null;

  // 15m: re-align to previous bar's timestamp — candles1d ile AYNI desen (bkz. aşağıdaki prev1d)
  const prev15m = candles15m.filter((c) => c.ts <= prevLatest.ts);
  if (prev1h.length < CANDLE_MIN_1H || prev15m.length < CANDLE_MIN_15M) return null;

  // 4h: re-align to previous bar's timestamp
  const prev4h = candles4h.filter((c) => c.ts <= prevLatest.ts);
  if (prev4h.length < CANDLE_MIN_4H) return null;

  // 1d: re-align to previous bar's timestamp (daily bars mostly unchanged)
  const prev1d = candles1d.filter((c) => c.ts <= prevLatest.ts);

  try {
    const composed = composeScoreInput({
      pair,
      livePrice: prevLatest.close,
      candles1h: prev1h,
      candles4h: prev4h,
      candles15m: prev15m,
      candles1d: prev1d,
      fg,
      fundingRate,
      oiVelocityScore: null, // prev-bar OI velocity mevcut değil
      oiVelocityResult: null,
      now: prevLatest.ts,
      srModifier: 0, // dedup approximation: S/R not recomputed for prev bar
      sweep15m: { type: null as null, strength: 0 }, // dedup: sweep not recomputed for prev bar
      ...FROZEN_STATE,
      timeQuality: computeTimeQuality(prevLatest.ts),
    });
    if (!composed) return null;
    return computeScore({ ...composed, scorerWeights: null }).verdict;
  } catch {
    return null;
  }
}

/**
 * Compute server-side signal for a single pair.
 * Returns null if candle data is insufficient.
 */
export async function computeServerSignal(
  pair: Pair,
  oiCache: Map<string, OiSnapshot[]>,
): Promise<ServerSignalResult | null> {
  try {
    const current = await fetchAndScore(pair, oiCache);
    if (!current) return null;

    // prevVerdict artık fetchAndScore() içinde TEK SEFERDE hesaplanıyor (hem
    // hysteresis'e beslemek hem burada dedup için kullanmak üzere) — burada
    // AYRICA scorePrevBar() çağrılmıyor, composeScoreInput+computeScore'un
    // ikinci kez tekrarlanmasını önlüyor.
    const prevVerdict = current.prevVerdict;
    const isNewSignal = current.verdict === "go" && prevVerdict !== "go";

    return {
      pair,
      verdict: current.verdict,
      direction: current.direction,
      score: current.score,
      prevVerdict,
      isNewSignal,
      price: current.price,
      debugInputs: {
        fg: current.fg,
        fundingRate: current.fundingRate,
        oiVelocityScore: current.oiVelocityScore,
      },
      oiSnapshotCount: current.oiSnapshotCount,
      signalTs: current.signalTs,
      sub: current.sub,
      baseScore: current.baseScore,
      effectiveThreshold: current.effectiveThreshold,
      regime: current.regime,
      adaptiveRegime: current.adaptiveRegime,
      atrPercentile: current.atrPercentile,
      sweepBonus: current.sweepBonus,
      regimeBonus: current.regimeBonus,
      overextFlags: current.overextFlags,
      srModifierRaw: current.srModifierRaw,
      srModifierApplied: current.srModifierApplied,
      blocks: current.blocks,
      softBlocks: current.softBlocks,
      pullbackActive: current.pullbackActive,
    };
  } catch (err) {
    return {
      pair,
      verdict: "no" as const,
      direction: "NEUTRAL",
      score: 0,
      prevVerdict: null,
      isNewSignal: false,
      price: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Batch compute signals for all pairs in parallel.
 *
 * OI snapshot kalıcılığı burada yönetiliyor (Phase 1.0 — OI Runtime
 * Verification): cron başında oi_snapshot_cache'ten TEK istekle tüm
 * pariteler yüklenir, paylaşılan bir Map olarak her computeServerSignal
 * çağrısına geçilir (her çağrı sadece kendi pair'inin key'ine yazdığı için
 * Promise.all ile eşzamanlı kullanımda çakışma yok — JS tek thread'li,
 * pair'ler arası key çakışması olmadığı sürece güvenli), tüm hesaplamalar
 * bittikten sonra güncellenmiş hâli TEK istekle geri yazılır. Kaydetme
 * başarısız olsa bile (Supabase geçici kesinti vb.) sinyal/Telegram akışı
 * kesilmez — sadece bir sonraki cron cold-start gibi davranır.
 *
 * Bilinçli tasarım kararı — optimistic locking YOK: aynı cron path'inin
 * iki eşzamanlı çalışması (manuel + zamanlı tetikleme üst üste gelirse)
 * teorik olarak son-yazan-kazanır ile bir snapshot'ın kaybolmasına yol
 * açabilir. Kalıcı hasar değil — kendi kendini onarıyor (bir sonraki
 * cron'da normale döner). score_history.oi_snapshot_count zaten bunu
 * gözlemlenebilir kılıyor: sayı sürekli artması gerekirken düşüp
 * sıçrarsa, o zaman kilitleme eklenir — şimdiden eklemek düşük-riskli
 * bir altyapı düzeltmesinin kapsamını orantısız büyütür.
 */
export async function computeAllSignals(pairs: readonly Pair[]): Promise<ServerSignalResult[]> {
  const oiCache = await loadOiSnapshotCache(pairs);
  const results = await Promise.all(pairs.map((p) => computeServerSignal(p, oiCache)));
  await saveOiSnapshotCache(oiCache);
  return results.filter((r): r is ServerSignalResult => r !== null);
}

/** Fetch 24h ticker data for all SWAP pairs */
export async function fetch24hTickers(
  pairs: readonly Pair[],
): Promise<Map<Pair, { last: number; chg24hPct: number }>> {
  const map = new Map<Pair, { last: number; chg24hPct: number }>();
  try {
    const res = await fetch(`${OKX_BASE}/api/v5/market/tickers?instType=SWAP`, {
      cache: "no-store",
    });
    if (!res.ok) return map;
    const json = (await res.json()) as {
      code: string;
      data?: Array<{ instId: string; last: string; open24h: string }>;
    };
    if (json.code !== "0" || !Array.isArray(json.data)) return map;

    for (const ticker of json.data) {
      for (const pair of pairs) {
        if (ticker.instId === `${pair}-USDT-SWAP`) {
          const last = Number(ticker.last);
          const open24h = Number(ticker.open24h);
          map.set(pair, {
            last,
            chg24hPct: open24h > 0 ? ((last - open24h) / open24h) * 100 : 0,
          });
        }
      }
    }
  } catch {
    // return empty map
  }
  return map;
}
