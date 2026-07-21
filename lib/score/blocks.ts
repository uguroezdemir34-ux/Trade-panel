/**
 * HARD + SOFT BLOCK KURALLARI — v55.51 panel ile birebir.
 * Kaynak: panel_v55_51.html satır 7678-7893.
 *
 * Bu modül "verdict" kararının veto/uyarı katmanını uygular:
 *   - Hard block → verdict 'no' (trade yok)
 *   - Soft block → verdict 'wait' (skor yeterli ama bekle)
 *
 * Her fonksiyon SAF: input → string|null. null = bu kural tetiklenmedi.
 * Block string'leri kullanıcıya gösterilir (Telegram + UI).
 *
 * KRİTİK: Eşikler değiştirilmemeli. Bunlar panelinin oturmuş kalibrasyonu:
 *   - RSI: 25/75 (regime_strong'da 20/80)
 *   - BB: %3 / %97 (volBreakout override ile iptal)
 *   - VWAP: 2σ
 *   - Volume: 0.7×
 *   - Funding: 0.06%
 *   - ATR percentile: 95
 *   - Lock ramp: 24 saat
 *
 * Panel #5d-iii orchestrator bu fonksiyonları sıralı çağırıp blocks[]
 * ve softBlocks[] arraylerini doldurur.
 */

import type { Direction } from "./direction";
import type { VwapInput, Regime } from "./scorers";

// ═══════════════════════════════════════════════════════════════════
// VOLUME BREAKOUT OVERRIDE (BB hard bloğu iptal helper'ı)
// ═══════════════════════════════════════════════════════════════════

export interface VolBreakoutInput {
  direction: Direction;
  volRatio: number | null;
  adx: number | null;
  baseScore: number;
  /** Son kapanmış 4H mum kapanış değişimi (%) */
  last4hMovePct: number | null;
  /** 4H trend yönü ile uyumlu mu (px4 vs ema50_4h) */
  trend4hUp: boolean;
  trend4hDown: boolean;
}

/**
 * Extreme hacimli kırılım (volRatio ≥ 3.0) BB band dışı hard'ı iptal eder.
 * Tüm 5 şart birden gerekli.
 * Panel referansı: satır 7735-7751.
 */
export function checkVolBreakoutOverride(
  input: VolBreakoutInput,
): { active: boolean; reason: string | null } {
  const { direction, volRatio, adx, baseScore, last4hMovePct, trend4hUp, trend4hDown } = input;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (!(isLong || isShort)) return { active: false, reason: null };
  if (volRatio === null || volRatio < 3.0) return { active: false, reason: null };
  if (adx === null || adx < 25) return { active: false, reason: null };
  if (baseScore < 75) return { active: false, reason: null };
  if (last4hMovePct === null) return { active: false, reason: null };

  if (isLong && last4hMovePct >= 2.0 && trend4hUp) {
    return {
      active: true,
      reason: `📊 Volume surge (${volRatio.toFixed(2)}x) + 4H +${last4hMovePct.toFixed(2)}% · BB hard block cancelled`,
    };
  }
  if (isShort && last4hMovePct <= -2.0 && trend4hDown) {
    return {
      active: true,
      reason: `📊 Volume surge (${volRatio.toFixed(2)}x) + 4H ${last4hMovePct.toFixed(2)}% · BB hard block cancelled`,
    };
  }
  return { active: false, reason: null };
}

// ═══════════════════════════════════════════════════════════════════
// HARD BLOCKS — verdict 'no'
// ═══════════════════════════════════════════════════════════════════

export interface OverextendedInput {
  direction: Direction;
  rsi: number | null;
  bbPct: number | null;
  vwap: VwapInput | null;
  px: number;
}

/**
 * KOMPOZIT AŞIRI UZANMIŞ — 2 veya daha fazla flag bir araya gelirse hard block.
 * Panel referansı: satır 7683-7702.
 *
 * LONG flagleri: RSI>70, BB>0.80, VWAP +distSigma>1.3
 * SHORT flagleri: RSI<30, BB<0.20, VWAP -distSigma>1.3
 */
export function checkOverextended(input: OverextendedInput): string | null {
  const { direction, rsi, bbPct, vwap, px } = input;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (!(isLong || isShort)) return null;

  const flags: string[] = [];

  if (isShort) {
    if (rsi !== null && rsi < 30) flags.push(`RSI ${rsi.toFixed(0)}`);
    if (bbPct !== null && bbPct < 0.2) flags.push(`BB ${(bbPct * 100).toFixed(0)}%`);
    if (vwap !== null && vwap.stddev > 0) {
      const distSigma = Math.abs(px - vwap.vwap) / vwap.stddev;
      if (px < vwap.vwap && distSigma > 1.3) {
        flags.push(`VWAP -${distSigma.toFixed(1)}σ`);
      }
    }
  } else {
    // LONG
    if (rsi !== null && rsi > 70) flags.push(`RSI ${rsi.toFixed(0)}`);
    if (bbPct !== null && bbPct > 0.8) flags.push(`BB ${(bbPct * 100).toFixed(0)}%`);
    if (vwap !== null && vwap.stddev > 0) {
      const distSigma = Math.abs(px - vwap.vwap) / vwap.stddev;
      if (px > vwap.vwap && distSigma > 1.3) {
        flags.push(`VWAP +${distSigma.toFixed(1)}σ`);
      }
    }
  }

  if (flags.length >= 2) {
    return `⚠️ Over-extended: ${flags.join(", ")} — wait for pullback`;
  }
  return null;
}

export function checkNeutralDirection(direction: Direction): string | null {
  return direction === "NEUTRAL" ? "Direction unclear" : null;
}

export function checkCounterTrend(counterTrend: boolean): string | null {
  return counterTrend ? "🚫 Counter-trend (against 4H main trend)" : null;
}

export function checkAdxWeakOrTired(adx: number | null): string | null {
  if (adx === null) return null;
  if (adx < 20) return `ADX weak (${adx.toFixed(0)})`;
  if (adx > 50) return `ADX tired (${adx.toFixed(0)})`;
  return null;
}

export interface RsiExtremeInput {
  rsi: number | null;
  direction: Direction;
  regime: Regime;
}

/**
 * RSI hard block (regime relax ile asimetrik gevşeme).
 * trending_strong + yön uyumlu → eşikler 75→80 / 25→20 gevşer.
 * Panel referansı: satır 7715-7724.
 */
export function checkRsiExtreme(input: RsiExtremeInput): string | null {
  const { rsi, direction, regime } = input;
  if (rsi === null) return null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  const regimeRelax = regime === "trending_strong" && (isLong || isShort);

  const upperHard = regimeRelax && isLong ? 80 : 75;
  const lowerHard = regimeRelax && isShort ? 20 : 25;

  if (rsi > upperHard) {
    return `RSI overbought (${rsi.toFixed(0)}${regimeRelax && isLong ? ", regime relaxed" : ""})`;
  }
  if (rsi < lowerHard) {
    return `RSI oversold (${rsi.toFixed(0)}${regimeRelax && isShort ? ", regime relaxed" : ""})`;
  }
  return null;
}

/**
 * BB hard block — volBreakoutOverride aktifse iptal.
 * Panel referansı: satır 7755-7758.
 */
export function checkBbOutOfBand(
  bbPct: number | null,
  volBreakoutActive: boolean,
): string[] {
  const out: string[] = [];
  if (volBreakoutActive) return out;
  if (bbPct === null) return out;
  if (bbPct > 0.97) out.push("BB above upper");
  if (bbPct < 0.03) out.push("BB below lower");
  return out;
}

export function checkVwapExtreme(
  vwap: VwapInput | null,
  px: number,
): string | null {
  if (vwap === null || vwap.stddev <= 0) return null;
  const distSigma = Math.abs(px - vwap.vwap) / vwap.stddev;
  if (distSigma > 2.0) {
    return `VWAP ${px > vwap.vwap ? "+" : "-"}${distSigma.toFixed(1)}σ (extreme distance)`;
  }
  return null;
}

/** detectSRLevels()'in (lib/sr/detect.ts) nearest_resistance/nearest_support
 *  alanlarıyla yapısal olarak uyumlu — o modülden type import EDİLMEDİ
 *  (lib/score ↔ lib/sr kasıtlı ayrık, bkz. ScoreInput.srModifier: sadece
 *  ölçeklenmiş sayı geçer, ham detay hiç orchestrator.ts'e girmezdi —
 *  bu blok için ilk kez ham detay (distance_pct + strength) gerekiyor). */
export interface SrProximity {
  distance_pct: number;
  strength: number;
}

export interface SrHardBlockInput {
  direction: Direction;
  rsi: number | null;
  nearestResistance: SrProximity | null;
  nearestSupport: SrProximity | null;
  /** detectSRLevels()'in kendi breakout override'ı (meta.breakoutOverride) —
   *  hacim teyitli bir kırılım o seviyeyi zaten geçtiyse, checkBbOutOfBand()'ın
   *  volBreakoutActive parametresiyle AYNI mantıkla bu hard block de iptal olur. */
  breakoutOverride: boolean;
}

/** checkRsiExtreme()'in TEMEL (rejim-gevşetilmemiş) eşikleri — blocks.ts'teki
 *  regimeRelax mantığı burada BİLEREK yok sayılıyor: bu blok tam olarak
 *  "güçlü trend rejiminde RSI eşiği gevşer + fiyat zaten dirence yapışmış"
 *  riskini yakalamak için var (chat'teki araştırmadan çıktı) — o gevşemeyi
 *  burada da uygularsak, yakalamak istediğimiz senaryonun ta kendisini
 *  kaçırırdık. Kullanıcı kararı: sabit 75/25, rejime bakılmaksızın. */
const SR_HARD_BLOCK_RSI_OVERBOUGHT = 75;
const SR_HARD_BLOCK_RSI_OVERSOLD = 25;

/**
 * S/R + RSI kombine hard block — YENİ (panel'de yoktu, bu chat'teki
 * araştırmadan çıktı): detectSRLevels()/calcPenalty() (lib/sr/detect.ts)
 * zaten dirence/desteğe yakınlığı hesaplayıp soft bir puan cezası
 * (srModifier) uyguluyordu, ama SR_SCALE_FACTOR=0.15 ile o ceza max
 * ~4.5/100 puana düşüyordu — pratikte kararı neredeyse hiç etkilemiyordu.
 *
 * İKİ koşul BİRLİKTE sağlanmalı (kullanıcı kararı — sadece biri yeterli
 * değil, mevcut puan sistemi o durumda olduğu gibi işlemeye devam eder):
 *   1. S/R yakınlığı — calcPenalty()'nin EN SIKI dilimiyle BİREBİR aynı
 *      eşik: mesafe ≤%0.5 VE strength≥3 (×1.5 çarpanı, "en güçlü seviye").
 *   2. RSI aşırı bölgede — SABİT 75/25 (yukarıdaki not, regime relax yok).
 *
 * İkisi birden sağlanırsa srModifier'a EK olarak (onu değiştirmeden)
 * doğrudan NO'ya düşürür.
 */
export function checkSrHardBlock(input: SrHardBlockInput): string | null {
  const { direction, rsi, nearestResistance, nearestSupport, breakoutOverride } = input;
  if (breakoutOverride) return null;
  if (rsi === null) return null;

  if (
    direction === "LONG" &&
    nearestResistance &&
    rsi > SR_HARD_BLOCK_RSI_OVERBOUGHT &&
    nearestResistance.distance_pct <= 0.5 &&
    nearestResistance.strength >= 3
  ) {
    return `🚫 S/R+RSI hard block: RSI aşırı alım (${rsi.toFixed(0)}) + güçlü direnç ${nearestResistance.distance_pct.toFixed(2)}% mesafede (strength ${nearestResistance.strength})`;
  }
  if (
    direction === "SHORT" &&
    nearestSupport &&
    rsi < SR_HARD_BLOCK_RSI_OVERSOLD &&
    nearestSupport.distance_pct <= 0.5 &&
    nearestSupport.strength >= 3
  ) {
    return `🚫 S/R+RSI hard block: RSI aşırı satım (${rsi.toFixed(0)}) + güçlü destek ${nearestSupport.distance_pct.toFixed(2)}% mesafede (strength ${nearestSupport.strength})`;
  }
  return null;
}

export function checkVolumeLow(volRatio: number | null): string | null {
  if (volRatio === null) return null;
  return volRatio < 0.7
    ? `Volume very low (${volRatio.toFixed(2)}x) - unconfirmed`
    : null;
}

export function checkFundingExtreme(fundingRate: number | null): string | null {
  if (fundingRate === null) return null;
  const fr = fundingRate * 100;
  return Math.abs(fr) > 0.10 ? `Funding extreme (${fr.toFixed(3)}%)` : null;
}

export interface TimeQualityInput {
  /** lib/market/timeQuality.ts → computeTimeQuality() çıktısı: { quality, reason } */
  quality: number;
  reason: string;
}

export function checkTimeQuality(input: TimeQualityInput): string | null {
  return input.quality === 0 ? input.reason : null;
}

export interface EventSkipInput {
  /** ST.eventSkipUntil — null/0 ise aktif değil */
  eventSkipUntil: number | null;
  now: number;
}

export function checkEventSkip(input: EventSkipInput): string | null {
  const { eventSkipUntil, now } = input;
  if (!eventSkipUntil || now >= eventSkipUntil) return null;
  const remainMin = Math.ceil((eventSkipUntil - now) / 60000);
  const remainTxt =
    remainMin >= 60
      ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk`
      : `${remainMin}dk`;
  return `📅 Event skip active (${remainTxt} remaining)`;
}

export interface BtcCooldownInput {
  pair: string;
  /** ST.btcCooldownUntil — alt'lar için */
  btcCooldownUntil: number | null;
  /** ST.btcCooldownReason — opsiyonel */
  btcCooldownReason: string;
  now: number;
}

/**
 * BTC korelasyon cooldown (alt'lar için).
 * Panel referansı: satır 7785-7789.
 */
export function checkBtcCooldown(input: BtcCooldownInput): string | null {
  const { pair, btcCooldownUntil, btcCooldownReason, now } = input;
  if (pair === "BTC") return null;
  if (!btcCooldownUntil || now >= btcCooldownUntil) return null;
  const remainMin = Math.ceil((btcCooldownUntil - now) / 60000);
  const reasonText = btcCooldownReason ? ` (${btcCooldownReason})` : "";
  return `🚨 BTC correlation ${remainMin}m cooldown${reasonText}`;
}

export interface BtcSelfCooldownInput {
  pair: string;
  btcSelfCooldownUntil: number | null;
  btcCooldownReason: string;
  now: number;
}

/**
 * BTC self-cooldown (sadece BTC pair'i için).
 * Panel referansı: satır 7797-7801.
 */
export function checkBtcSelfCooldown(
  input: BtcSelfCooldownInput,
): string | null {
  const { pair, btcSelfCooldownUntil, btcCooldownReason, now } = input;
  if (pair !== "BTC") return null;
  if (!btcSelfCooldownUntil || now >= btcSelfCooldownUntil) return null;
  const remainMin = Math.ceil((btcSelfCooldownUntil - now) / 60000);
  const reasonText = btcCooldownReason ? ` (${btcCooldownReason})` : "";
  return `🚨 BTC post-spike ${remainMin}m cooldown${reasonText}`;
}

// ═══════════════════════════════════════════════════════════════════
// SOFT BLOCKS — verdict 'wait'
// ═══════════════════════════════════════════════════════════════════

export interface DailyTrendInput {
  direction: Direction;
  px: number;
  ema50_1d: number | null;
}

/**
 * Daily EMA50 trend filter.
 * Panel referansı: satır 7810-7818.
 */
export function checkDailyTrendOpposite(input: DailyTrendInput): string | null {
  const { direction, px, ema50_1d } = input;
  if (ema50_1d === null) return null;
  if (direction === "LONG" && px < ema50_1d) {
    return `📅 Daily trend opposite: px ${px.toFixed(2)} < EMA50_1D ${ema50_1d.toFixed(2)}`;
  }
  if (direction === "SHORT" && px > ema50_1d) {
    return `📅 Daily trend opposite: px ${px.toFixed(2)} > EMA50_1D ${ema50_1d.toFixed(2)}`;
  }
  return null;
}

/**
 * Funding mid-tier kalabalık soft block (0.05%-0.10% aralığı, yön funding ile aynı).
 * Panel referansı: satır 7824-7834.
 */
export function checkFundingCrowded(
  fundingRate: number | null,
  direction: Direction,
): string | null {
  if (fundingRate === null) return null;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";
  if (!(isLong || isShort)) return null;

  const fr = fundingRate * 100;
  const absFr = Math.abs(fr);
  if (absFr < 0.05 || absFr > 0.10) return null;

  if (isLong && fr > 0) {
    return `💰 Funding +${fr.toFixed(3)}% — LONG crowded, avoid piling in`;
  }
  if (isShort && fr < 0) {
    return `💰 Funding ${fr.toFixed(3)}% — SHORT crowded, avoid piling in`;
  }
  return null;
}

export interface LockRampInput {
  /** ST.lockReleasedAt — null ise ramp aktif değil */
  lockReleasedAt: number | null;
  now: number;
}

/**
 * Lock release ramp — kilit kalktıktan sonra 24 saat ekstra disiplin.
 * Panel referansı: satır 7861-7866.
 *
 * Bonus: aktifse goThreshold +5 artar (orchestrator'da uygulanır).
 */
export function checkLockReleaseRamp(input: LockRampInput): {
  active: boolean;
  message: string | null;
} {
  const { lockReleasedAt, now } = input;
  if (!lockReleasedAt) return { active: false, message: null };
  const elapsed = now - lockReleasedAt;
  if (elapsed >= 24 * 60 * 60 * 1000) return { active: false, message: null };
  const hoursSince = (elapsed / 3600000).toFixed(1);
  return {
    active: true,
    message: `🔓 Lock released ${hoursSince}h ago — quality threshold elevated for first trade`,
  };
}

export interface CorrelationClusterInput {
  pair: string;
  direction: Direction;
  /** Açık pozisyonlar — { pair, direction } */
  openPositions: ReadonlyArray<{ pair: string; direction: Direction }>;
}

/**
 * BTC-ETH korelasyon clustered risk.
 * Aynı yönde 2 pozisyon = 1.85× tek pozisyon (korelasyon ~%85).
 * Ters yön → HEDGE, block yok.
 * Panel referansı: satır 7877-7893.
 */
export function checkCorrelationCluster(
  input: CorrelationClusterInput,
): string | null {
  const { pair, direction, openPositions } = input;
  if (direction !== "LONG" && direction !== "SHORT") return null;
  if (!openPositions || openPositions.length === 0) return null;

  let corrPair: string | null = null;
  if (pair === "BTC") corrPair = "ETH";
  else if (pair === "ETH") corrPair = "BTC";
  if (corrPair === null) return null;

  const otherOpen = openPositions.find(
    (p) => p.pair === corrPair && p.direction === direction,
  );
  if (otherOpen) {
    return `🔗 ${corrPair} ${direction} open — correlation ~85%, clustered risk`;
  }
  return null;
}

export interface AtrRegimeInput {
  /** ATR yüzdesi (0-100) */
  percentile: number | null;
}

/**
 * ATR percentile rejim modifier + extreme soft block.
 * Panel referansı: satır 7918-7935.
 *
 * @returns adj (eşik modifier), softBlock (extreme için), reason (her durumda)
 */
export function checkAtrRegime(input: AtrRegimeInput): {
  adj: number;
  softBlock: string | null;
  reason: string | null;
} {
  const { percentile } = input;
  if (percentile === null) return { adj: 0, softBlock: null, reason: null };

  const p = percentile;
  if (p < 20) {
    return {
      adj: -3,
      softBlock: null,
      reason: `🟢 ATR %${p} — compression (quiet) · threshold -3`,
    };
  }
  if (p > 95) {
    return {
      adj: 5,
      softBlock: `⚡ Volatility extreme (ATR %${p}) — wide wick risk high`,
      reason: `🔴 ATR %${p} — extreme expansion (chaos) · threshold +5`,
    };
  }
  if (p > 80) {
    return {
      adj: 5,
      softBlock: null,
      reason: `🟠 ATR %${p} — expansion (volatile) · threshold +5`,
    };
  }
  return {
    adj: 0,
    softBlock: null,
    reason: `⚪ ATR %${p} — normal regime`,
  };
}
