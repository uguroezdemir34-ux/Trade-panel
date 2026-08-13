/**
 * HUMAN TRADER CHECK — GO verdict'i Telegram'a/karar sayfasına yansımadan
 * önceki son, deterministik onay katmanı (kullanıcı kararı — 1. tur, çizim
 * YOK, sadece sayısal kontrol).
 *
 * lib/score/*'a HİÇ dokunmuyor — sadece ScoreResult'ın ÇIKTISINI (zaten
 * hesaplanmış verdict/direction) ve çağıranın (useScoreEngine.ts client,
 * signalEngine.ts server) ZATEN hesaplamış olduğu SrResult/volRatio'yu
 * girdi olarak alıyor. computeScore()/orchestrator.ts/blocks.ts/composeScoreInput.ts
 * bu dosyadan hiç import edilmiyor, hiç çağrılmıyor.
 *
 * Üç bağımsız kontrol, ÜÇÜ DE geçmeli (AND):
 *   1. S/R  — engelleyici seviye çok yakın VE güçlüyse (calcPenalty'nin
 *      kendi max-ceza eşiği: ≤%0.5 mesafe + ≥2 dokunuş), hacim-teyitli
 *      kırılım (breakoutOverride) yoksa reddet. lib/sr/detect.ts'in ZATEN
 *      hesapladığı SrResult'ı tekrar hesaplamadan kullanır.
 *   2. Hacim — volRatio < 0.5 (lib/indicators/volume-ratio.ts'in kendi doc
 *      yorumundaki "ölü piyasa" eşiği) → reddet. null (yetersiz veri) tek
 *      başına bloklamaz (bilinmiyor, olumsuz değil).
 *   3. R:R — lib/sizer/stop.ts + lib/sizer/take-profit.ts (ATR + swing
 *      hibrit stop, ADX-adaptif TP) ile aynı hesap, lib/sizer/position.ts'in
 *      rr1 formülüyle birebir. <1.0 veya veri yetersizse (ATR/ADX
 *      hesaplanamadı) reddet — CLAUDE.md §0.1 madde 3 gereği "emin değilse
 *      sessizce geçme", `dataInsufficient` alanı bunu görünür kılıyor.
 *
 * Trend çizgisi (diyagonal) bu turda YOK — mevcut altyapıda hiç yok, ayrı
 * bir tur (kullanıcı kararı).
 */

import type { Direction } from "@/lib/score/orchestrator";
import type { SrResult, SrLevelEntry } from "@/lib/sr/detect";
import { toIndicatorCandle, type Candle } from "@/lib/okx/candles";
import { atr } from "@/lib/indicators/atr";
import { adx } from "@/lib/indicators/adx";
import { findSwingLevels } from "@/lib/sr/swing";
import { computeStructuralStop } from "@/lib/sizer/stop";
import { computeAdaptiveTPs } from "@/lib/sizer/take-profit";

// detect.ts'teki calcPenalty()'nin max-ceza tier'ıyla AYNI eşik — burada
// tekrar tanımlandı çünkü calcPenalty export edilmemiş bir modül-private
// fonksiyon, bu dosyanın bağımsız (lib/score/*'a dokunmayan) kalması için
// eşik değeri kopyalandı, import edilmedi.
const SR_BLOCK_DISTANCE_PCT = 0.5;
const SR_BLOCK_MIN_STRENGTH = 2;

// lib/indicators/volume-ratio.ts'in kendi doc yorumu: "< 0.5x ölü piyasa".
const VOLUME_DEAD_MARKET_THRESHOLD = 0.5;

const MIN_ACCEPTABLE_RR = 1.0;

// adx(period=14) → candles.length >= 2*14+1 = 29 gerektiriyor
// (lib/indicators/adx.ts) — useSignalFirehose.ts'teki aynı eşikle tutarlı.
const MIN_CANDLES_FOR_RR = 29;

export interface HumanTraderCheckInput {
  direction: Direction;
  /** Anlık fiyat (skor motorunun kullandığı aynı fiyat, input.px/composed.px). */
  currentPrice: number;
  /** Kapanmış 1H mumlar (OKX-şekilli, candleStore/signalEngine'in ZATEN
   *  elinde tuttuğu — bu dosya kendi içinde toIndicatorCandle() ile çevirir,
   *  çağırandan indikatör-şekilli mum İSTEMİYOR). */
  candles1h: readonly Candle[];
  /** Çağıranın skor için ZATEN hesapladığı detectSRLevels() sonucu —
   *  burada TEKRAR hesaplanmıyor (verimlilik + skorla aynı S/R verisi
   *  garantisi). */
  srResult: SrResult;
  /** Çağıranın composeScoreInput() çıktısından ZATEN sahip olduğu hacim
   *  oranı — burada tekrar hesaplanmıyor. */
  volRatio: number | null;
}

export interface HumanTraderCheckResult {
  approved: boolean;
  /** R:R hesaplanamadıysa true (ATR/ADX için yetersiz mum) — approved=false
   *  ile AYNI şey değil, "neden reddedildi" ayrımı için ayrı alan (CLAUDE.md
   *  §0.1 madde 3: sessiz varsayım yerine görünür "bilinmiyor"). */
  dataInsufficient: boolean;
  srCheck: {
    nearestResistance: SrLevelEntry | null;
    nearestSupport: SrLevelEntry | null;
    breakoutConfirmed: boolean;
    blocked: boolean;
  };
  volumeCheck: {
    volRatio: number | null;
    /** false = ölü piyasa (< eşik). volRatio null iken true (bilinmiyor,
     *  bloklamıyor demek — "confirmed" ismi biraz yanıltıcı olabilir ama
     *  "not-rejected" anlamında kullanılıyor). */
    confirmed: boolean;
  };
  rrCheck: {
    stopPrice: number | null;
    tp1Price: number | null;
    tp2Price: number | null;
    rr1: number | null;
    acceptable: boolean;
  };
  /** İnsan-okunur gerekçe satırları — narrateHumanTraderCheck()'in girdisi,
   *  debug/log için de kullanılabilir. */
  reasons: string[];
}

export function checkHumanTraderApproval(
  input: HumanTraderCheckInput,
): HumanTraderCheckResult {
  const { direction, currentPrice, candles1h, srResult, volRatio } = input;
  const reasons: string[] = [];

  if (direction === "NEUTRAL") {
    return {
      approved: false,
      dataInsufficient: false,
      srCheck: {
        nearestResistance: srResult.levels.nearest_resistance,
        nearestSupport: srResult.levels.nearest_support,
        breakoutConfirmed: srResult.meta.breakoutOverride,
        blocked: true,
      },
      volumeCheck: { volRatio, confirmed: false },
      rrCheck: { stopPrice: null, tp1Price: null, tp2Price: null, rr1: null, acceptable: false },
      reasons: ["NEUTRAL yönde onay yapılmaz"],
    };
  }

  // ── 1. S/R kontrolü ──
  const blockingLevel =
    direction === "LONG" ? srResult.levels.nearest_resistance : srResult.levels.nearest_support;
  const breakoutConfirmed = srResult.meta.breakoutOverride;
  const levelLabel = direction === "LONG" ? "direnç" : "destek";

  let srBlocked = false;
  if (
    !breakoutConfirmed &&
    blockingLevel &&
    blockingLevel.distance_pct <= SR_BLOCK_DISTANCE_PCT &&
    blockingLevel.strength >= SR_BLOCK_MIN_STRENGTH
  ) {
    srBlocked = true;
    reasons.push(
      `❌ S/R: ${levelLabel} %${blockingLevel.distance_pct.toFixed(2)} uzakta, güç ${blockingLevel.strength} — kırılım teyidi yok`,
    );
  } else if (breakoutConfirmed) {
    reasons.push("✅ S/R: hacim-teyitli kırılım — seviye engeli iptal");
  } else if (blockingLevel) {
    reasons.push(`✅ S/R: ${levelLabel} %${blockingLevel.distance_pct.toFixed(2)} uzakta — engel değil`);
  } else {
    reasons.push("✅ S/R: yakında engelleyici seviye yok");
  }

  // ── 2. Hacim kontrolü ──
  const volumeDead = volRatio !== null && volRatio < VOLUME_DEAD_MARKET_THRESHOLD;
  if (volumeDead) {
    reasons.push(`❌ Hacim: ${(volRatio as number).toFixed(2)}x — ölü piyasa, teyit yok`);
  } else if (volRatio !== null) {
    reasons.push(`✅ Hacim: ${volRatio.toFixed(2)}x`);
  } else {
    reasons.push("⚠️ Hacim: bilinmiyor (yetersiz veri) — bloklamıyor");
  }

  // ── 3. R:R kontrolü — lib/sizer/stop.ts + take-profit.ts, position.ts'in
  // rr1 formülüyle birebir ((tp.tp1Mult * atr) / stop.stopDistance) ──
  const indCandles = candles1h.map(toIndicatorCandle);
  const atrVal = atr(indCandles, { period: 14 });

  let stopPrice: number | null = null;
  let tp1Price: number | null = null;
  let tp2Price: number | null = null;
  let rr1: number | null = null;
  let rrAcceptable = false;
  let dataInsufficient = true;

  if (atrVal && atrVal > 0 && candles1h.length >= MIN_CANDLES_FOR_RR) {
    const swing = findSwingLevels(indCandles);
    const stop = computeStructuralStop(direction, currentPrice, atrVal, swing.swingLow, swing.swingHigh);
    const adxResult = adx(indCandles, 14);
    const tp = computeAdaptiveTPs(direction, currentPrice, atrVal, adxResult?.adx ?? null);
    stopPrice = stop.stopPrice;
    tp1Price = tp.tp1Price;
    tp2Price = tp.tp2Price;

    if (stop.stopDistance > 0) {
      rr1 = (tp.tp1Mult * atrVal) / stop.stopDistance;
      dataInsufficient = false;
      rrAcceptable = rr1 >= MIN_ACCEPTABLE_RR;
      reasons.push(
        rrAcceptable
          ? `✅ R:R: ${rr1.toFixed(2)} — kabul edilebilir`
          : `❌ R:R: ${rr1.toFixed(2)} — risk ödülden büyük`,
      );
    }
  }
  if (dataInsufficient) {
    reasons.push("⚠️ R:R: yetersiz veri (ATR/ADX hesaplanamadı) — onay reddedildi");
  }

  const approved = !srBlocked && !volumeDead && rrAcceptable && !dataInsufficient;

  return {
    approved,
    dataInsufficient,
    srCheck: {
      nearestResistance: srResult.levels.nearest_resistance,
      nearestSupport: srResult.levels.nearest_support,
      breakoutConfirmed,
      blocked: srBlocked,
    },
    volumeCheck: { volRatio, confirmed: !volumeDead },
    rrCheck: { stopPrice, tp1Price, tp2Price, rr1, acceptable: rrAcceptable },
    reasons,
  };
}
