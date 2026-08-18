/**
 * SKOR HESAPLAYICILARI — v55.51 panel ile birebir.
 * Kaynak: panel_v55_51.html satır 7335-7592.
 *
 * 8 ana kategori (toplam 100 pts):
 *   A) Trend (25)    — MTF EMA alignment, dirConfidence'a bağlı
 *   B) ADX   (15)    — 1H ADX gücü
 *   C) RSI   (10)    — Momentum, direction-aware
 *   D) Volume (15)   — Hacim teyidi
 *   E) BB    (10)    — Bollinger pozisyonu
 *   F) VWAP  (10)    — Sigma uzaklık
 *   G) Funding (8)   — Contrarian sinyal
 *   H) Macro (7)     — F&G index
 *
 * + 2 bonus (additive, baseScore ≥ 75 gate'i):
 *   - Sweep bonus (0-3) — 15m sweep + yön + strength
 *   - Regime synergy bonus (0-3) — rejim tespiti + setup uyumu
 *
 * Her scorer saf fonksiyon. Reason string ayrı döner — UI/Telegram'da kullanılır.
 *
 * KRİTİK: Her eşik DEĞİŞTİRİLMEMELİ. Bunlar panelin uzun süre kalibrasyonu.
 *
 * TEK BİLİNÇLİ İSTİSNA — scoreFunding()'in healthy/elevated/crowded SINIR
 * NOKTALARI (kullanıcı kararı, backtest verisiyle doğrulandı): pair'in son
 * 14 günlük gerçek funding dağılımı yeterince zenginse (bkz. scoreFunding()'in
 * kendi yorumu) artık SABİT %0.02/%0.05/%0.10 DEĞİL, o dağılımın P10/P50/P90'ı.
 * 8/5/2 ÇIKTI DEĞERLERİ değişmedi — sadece hangi funding oranının hangi banda
 * girdiğini belirleyen sınırlar. Yetersiz geçmişte (cold-start) ÖNCEKİ sabit
 * sınırlara aynen düşer.
 */

import type { Direction } from "./direction";

export interface ScoreReason {
  score: number;
  reason: string;
}

// ───────── A) MTF TREND (25 pts) ─────────

export function scoreTrend(
  direction: Direction,
  dirConfidence: number,
  px4h: number,
  ema200_4h: number | null,
): { score: number; reason: string; counterTrend: boolean } {
  let score = 0;
  let reason = "—";
  let counterTrend = false;

  if (dirConfidence === 3) {
    score = 25;
    reason = direction === "LONG" ? "Full Bull (4H+1H+15M)" : "Full Bear (4H+1H+15M)";
  } else if (dirConfidence === 2) {
    score = 18;
    reason = direction === "LONG" ? "Bull (4H+1H)" : "Bear (4H+1H)";
  } else if (direction === "NEUTRAL") {
    score = 0;
    reason = "Mixed / Sideways";
  }

  // 4H EMA200 counter-trend tespiti
  if (ema200_4h !== null && (direction === "LONG" || direction === "SHORT")) {
    const above200 = px4h > ema200_4h;
    if (direction === "LONG" && !above200) {
      counterTrend = true;
      reason = `${reason} 🚫 4H EMA200 below (counter-trend)`;
    } else if (direction === "SHORT" && above200) {
      counterTrend = true;
      reason = `${reason} 🚫 4H EMA200 above (counter-trend)`;
    } else {
      reason = `${reason} ✓ 4H EMA200 aligned`;
    }
  }
  return { score, reason, counterTrend };
}

// ───────── B) ADX (15 pts) ─────────

export function scoreAdx(adx: number | null): ScoreReason {
  if (adx === null) return { score: 0, reason: "—" };
  if (adx >= 25 && adx <= 40)
    return { score: 15, reason: `Strong (${adx.toFixed(0)})` };
  if (adx >= 20 && adx < 25)
    return { score: 9, reason: `Developing (${adx.toFixed(0)})` };
  if (adx > 40 && adx <= 50)
    return { score: 0, reason: `⚠️ Tired (${adx.toFixed(0)}) - late` };
  if (adx < 20) return { score: 0, reason: `Weak (${adx.toFixed(0)}) - range` };
  return { score: 0, reason: `⚠️ Over-extended (${adx.toFixed(0)})` };
}

// ───────── C) RSI (10 pts, direction-aware) ─────────

export function scoreRsi(
  rsi: number | null,
  direction: Direction,
): ScoreReason {
  if (rsi === null) return { score: 0, reason: "—" };
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (isLong) {
    if (rsi >= 50 && rsi <= 60)
      return { score: 10, reason: `Healthy (${rsi.toFixed(0)})` };
    if (rsi > 60 && rsi <= 65)
      return { score: 7, reason: `Strong (${rsi.toFixed(0)})` };
    if (rsi >= 45 && rsi < 50)
      return { score: 6, reason: `Tired (${rsi.toFixed(0)})` };
    if (rsi > 65 && rsi <= 70)
      return { score: 3, reason: `Near extreme (${rsi.toFixed(0)})` };
    if (rsi > 70)
      return { score: 0, reason: `⚠️ Overbought (${rsi.toFixed(0)}) - late` };
    if (rsi < 45 && rsi >= 35)
      return { score: 4, reason: `Weak (${rsi.toFixed(0)})` };
    return { score: 0, reason: `Direction conflict (${rsi.toFixed(0)})` };
  }

  if (isShort) {
    if (rsi >= 40 && rsi <= 50)
      return { score: 10, reason: `Healthy (${rsi.toFixed(0)})` };
    if (rsi >= 35 && rsi < 40)
      return { score: 7, reason: `Strong (${rsi.toFixed(0)})` };
    if (rsi > 50 && rsi <= 55)
      return { score: 6, reason: `Tired (${rsi.toFixed(0)})` };
    if (rsi >= 30 && rsi < 35)
      return { score: 3, reason: `Near extreme (${rsi.toFixed(0)})` };
    if (rsi < 30)
      return { score: 0, reason: `⚠️ Oversold (${rsi.toFixed(0)}) - late` };
    if (rsi > 55 && rsi <= 65)
      return { score: 4, reason: `Weak (${rsi.toFixed(0)})` };
    return { score: 0, reason: `Direction conflict (${rsi.toFixed(0)})` };
  }

  return { score: 0, reason: `Direction unclear (${rsi.toFixed(0)})` };
}

// ───────── D) VOLUME (15 pts) ─────────

export function scoreVolume(volRatio: number | null): ScoreReason {
  if (volRatio === null) return { score: 0, reason: "—" };
  if (volRatio >= 1.5)
    return { score: 15, reason: `Strong (${volRatio.toFixed(2)}x)` };
  if (volRatio >= 1.0)
    return { score: 10, reason: `Healthy (${volRatio.toFixed(2)}x)` };
  if (volRatio >= 0.7)
    return { score: 3, reason: `Low (${volRatio.toFixed(2)}x)` };
  return { score: 0, reason: `⚠️ Very Low (${volRatio.toFixed(2)}x) - unconfirmed` };
}

// ───────── E) BB POSITION (10 pts, direction-aware) ─────────

export function scoreBb(
  bbPct: number | null,
  direction: Direction,
): ScoreReason {
  if (bbPct === null) return { score: 0, reason: "—" };
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (bbPct >= 0.35 && bbPct <= 0.65) return { score: 10, reason: "Mid Band" };
  if (isLong && bbPct >= 0.15 && bbPct < 0.35)
    return { score: 8, reason: "Lower-Mid (LONG good)" };
  if (isShort && bbPct > 0.65 && bbPct <= 0.85)
    return { score: 8, reason: "Upper-Mid (SHORT good)" };
  if (isLong && bbPct > 0.65 && bbPct <= 0.8)
    return { score: 4, reason: "Upper-Mid (LONG late)" };
  if (isShort && bbPct < 0.35 && bbPct >= 0.2)
    return { score: 4, reason: "Lower-Mid (SHORT late)" };
  if (isLong && bbPct > 0.8 && bbPct < 0.97)
    return { score: 0, reason: "⚠️ Near Upper Band (LONG late)" };
  if (isShort && bbPct < 0.2 && bbPct > 0.03)
    return { score: 0, reason: "⚠️ Near Lower Band (SHORT late)" };
  return { score: 0, reason: "Out of Band (risk)" };
}

// ───────── F) VWAP (10 pts) ─────────

export interface VwapInput {
  vwap: number;
  stddev: number;
}

export function scoreVwap(
  vwap: VwapInput | null,
  px: number,
  direction: Direction,
): ScoreReason {
  if (vwap === null) return { score: 0, reason: "—" };
  const above = px > vwap.vwap;
  const distSigma =
    vwap.stddev > 0 ? Math.abs(px - vwap.vwap) / vwap.stddev : 0;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (isLong && above) {
    if (distSigma <= 1.0) return { score: 10, reason: "VWAP above (healthy)" };
    if (distSigma <= 1.3)
      return { score: 5, reason: `VWAP +${distSigma.toFixed(1)}σ` };
    if (distSigma <= 2.0)
      return { score: 0, reason: `⚠️ Too far +${distSigma.toFixed(1)}σ` };
    return { score: 0, reason: `🚫 Very far +${distSigma.toFixed(1)}σ` };
  }
  if (isShort && !above) {
    if (distSigma <= 1.0) return { score: 10, reason: "VWAP below (healthy)" };
    if (distSigma <= 1.3)
      return { score: 5, reason: `VWAP -${distSigma.toFixed(1)}σ` };
    if (distSigma <= 2.0)
      return { score: 0, reason: `⚠️ Too far -${distSigma.toFixed(1)}σ` };
    return { score: 0, reason: `🚫 Very far -${distSigma.toFixed(1)}σ` };
  }
  if (direction === "NEUTRAL") {
    return { score: 0, reason: above ? "VWAP above" : "VWAP below" };
  }
  // Direction VWAP ile çelişiyor
  return { score: 0, reason: "Direction conflicts with VWAP" };
}

// ───────── G) FUNDING (8 pts, contrarian) ─────────

/**
 * Ödeyen taraf (crowd ile aynı yönde funding) için 8→5→2 arası DOĞRUSAL geçiş.
 * 05 Ağu 2026'da basamak fonksiyonundan (sert sıçrama %0.02 ve %0.05'te)
 * buna çevrildi — 3 sınır noktasındaki puan AYNI KALDI (8/5/2), sadece
 * aralar basamak yerine eğim oldu. %0.10 üstü zaten checkFundingExtreme
 * (blocks.ts) tarafından NO'ya düşürülüyor — o bandın puanı pratikte hiç
 * GO/WAIT üretmiyor, sabit 2 bırakıldı.
 * Healthy ve contrarian (büyüklükten bağımsız sabit 8) tarafına BİLEREK
 * dokunulmadı — ayrı bir hipotez/veri gerektirir.
 *
 * PERSENTİL GEÇİŞİ (kullanıcı kararı): sınır noktaları artık SABİT
 * %0.02/%0.05/%0.10 değil, çağıranın hesapladığı healthyBound/elevatedBound/
 * crowdedBound parametreleri — bkz. scoreFunding()'in kendi yorumu. Bu
 * fonksiyonun kendisi hâlâ SAF: hangi üç sayının kullanılacağına karar
 * vermiyor, sadece verilenler arasında AYNI 8→5→2 doğrusal geçişi uyguluyor.
 */
function payingSideFundingScore(
  absFr: number,
  healthyBound: number,
  elevatedBound: number,
  crowdedBound: number,
): number {
  if (absFr <= healthyBound) return 8;
  if (absFr <= elevatedBound) {
    return 8 + (5 - 8) * ((absFr - healthyBound) / (elevatedBound - healthyBound));
  }
  if (absFr <= crowdedBound) {
    return 5 + (2 - 5) * ((absFr - elevatedBound) / (crowdedBound - elevatedBound));
  }
  return 2;
}

// Fallback (cold-start VEYA yetersiz geçmiş) sınır noktaları — PERSENTİL
// GEÇİŞİ ÖNCESİ davranışla BİREBİR AYNI (%0.02/%0.05/%0.10). Bu üç sayı
// scoreFunding()'in "hiçbir zaman gerçek dağılımı bilmiyorsak ne yaparız"
// varsayılanı — CLAUDE.md §0.1 madde 3 gereği, mevcut davranışın SESSİZ bir
// tekrarı, yeni bir varsayım DEĞİL.
const FUNDING_FALLBACK_HEALTHY_PCT = 0.02;
const FUNDING_FALLBACK_ELEVATED_PCT = 0.05;
const FUNDING_FALLBACK_CROWDED_PCT = 0.10;

// scoreFunding()'in çağıranı (lib/server/signalEngine.ts) zaten 7 günlük
// KAPSAM (yaş) kontrolünü yapıp yetersizse null geçiyor — bu sabit, İKİNCİ
// bir bağımsız güvenlik ağı: null OLMASA BİLE çok az örnekle "persentil"
// hesaplamak istatistiksel olarak anlamsız/yanıltıcı olurdu (ör. 3 örnekle
// P10/P90 hesaplamak neredeyse rastgele iki uç değer seçmek demektir).
const MIN_FUNDING_HISTORY_SAMPLES = 24;

/** Doğrusal interpolasyonlu persentil (en-yakın-derece DEĞİL) — sort
 *  edilmemiş bir dizi kabul eder, kendi içinde (kopyalayarak) sıralar,
 *  girdi değişmez. p ∈ [0,100]. */
function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function scoreFunding(
  fundingRate: number | null,
  direction: Direction,
  /**
   * Pair'in kendi son 14 günlük (~336 saatlik) |funding oranı| (%) geçmişi
   * — HER ÖRNEK ZATEN Math.abs(rate*100) formatında, işaretsiz. Kaynak:
   * score_history.funding_rate_raw (lib/db/scoreHistory.ts'teki
   * getFundingHistory()), çağıran (lib/server/signalEngine.ts) tarafından
   * sağlanır.
   *
   * SELF-INCLUSION/LOOK-AHEAD YOK: bu dizi, bu döngünün KENDİ fundingRate
   * değerini asla içermemeli — çağıran, DB'ye bu döngünün satırı henüz
   * YAZILMADAN (batch insert döngü sonunda) sorguyu çalıştırdığı için bu
   * doğal olarak garanti, ek bir filtre gerekmiyor (bkz. signalEngine.ts'teki
   * çağrı noktası yorumu).
   *
   * null = cold-start (çağıran 7 günden az kapsam tespit etti) — bu durumda
   * FUNDING_FALLBACK_* sabitleri (persentil geçişinden ÖNCEKİ davranışla
   * birebir aynı) kullanılır. Sentetik/sıfır bir persentil ÜRETİLMEZ.
   *
   * Varsayılan null (opsiyonel parametre): tests/integration/score-scorers.test.ts'teki
   * mevcut 2-argümanlı çağrılar (fixed-threshold davranışını doğrulayan
   * testler) DEĞİŞTİRİLMEDEN geçmeye devam eder — o testler zaten
   * FUNDING_FALLBACK_* sabitlerinin AYNI değerlerini (%0.02/%0.05/%0.10)
   * doğruluyor, bu yüzden hiç bozulmuyorlar.
   */
  fundingHistory: readonly number[] | null = null,
): ScoreReason {
  if (fundingRate === null) return { score: 0, reason: "N/A" };
  const fr = fundingRate * 100; // percent
  const absFr = Math.abs(fr);
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  const [healthyBound, elevatedBound, crowdedBound] =
    fundingHistory && fundingHistory.length >= MIN_FUNDING_HISTORY_SAMPLES
      ? [percentile(fundingHistory, 10), percentile(fundingHistory, 50), percentile(fundingHistory, 90)]
      : [FUNDING_FALLBACK_HEALTHY_PCT, FUNDING_FALLBACK_ELEVATED_PCT, FUNDING_FALLBACK_CROWDED_PCT];

  // Healthy: OKX baseline faiz dahil küçük premium — yön bağımsız
  if (absFr <= healthyBound) {
    return { score: 8, reason: `${fr >= 0 ? "+" : ""}${fr.toFixed(3)}% (healthy)` };
  }
  // Contrarian: alan taraf, cezalandırılmaz
  if (isLong && fr < -healthyBound) {
    return { score: 8, reason: `${fr.toFixed(3)}% (LONG contrarian)` };
  }
  if (isShort && fr > healthyBound) {
    return { score: 8, reason: `+${fr.toFixed(3)}% (SHORT contrarian)` };
  }
  // Ödeyen taraf: doğrusal geçiş (yukarıdaki payingSideFundingScore), etiket
  // funding büyüklüğünün orijinal bant tanımını yansıtıyor (skor değil)
  if (isLong || isShort) {
    const score = payingSideFundingScore(absFr, healthyBound, elevatedBound, crowdedBound);
    const label = absFr <= elevatedBound ? "elevated" : "crowded";
    return { score, reason: `${fr >= 0 ? "+" : ""}${fr.toFixed(3)}% (${label})` };
  }
  // direction NEUTRAL — eski davranışla birebir aynı (elevated sabit 5)
  return { score: 5, reason: `${fr >= 0 ? "+" : ""}${fr.toFixed(3)}% (elevated)` };
}

// ───────── H) MACRO F&G (7 pts) ─────────

export function scoreMacro(
  fg: number,
  direction: Direction,
): ScoreReason {
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (fg >= 30 && fg <= 60) return { score: 7, reason: `F&G ${fg} (healthy)` };
  if (fg < 20)
    return {
      score: isLong ? 5 : 2,
      reason: `F&G ${fg} (extreme fear)`,
    };
  if (fg > 80)
    return {
      score: isShort ? 5 : 2,
      reason: `F&G ${fg} (extreme greed)`,
    };
  if (fg >= 20 && fg < 30) return { score: 4, reason: `F&G ${fg} (fear)` };
  if (fg > 60 && fg <= 80) return { score: 4, reason: `F&G ${fg} (greed)` };
  // Tam 20 değeri yukarıdaki dallara düşmez — panel davranışını koru, 0
  return { score: 0, reason: `F&G ${fg}` };
}

// ───────── BONUS 1: Sweep (0-3) ─────────

export interface SweepInput {
  /** 'bullish_sweep' | 'bearish_sweep' | null */
  type: "bullish_sweep" | "bearish_sweep" | null;
  /** Wick strength (0-1) */
  strength: number;
}

export function scoreSweepBonus(
  sweep15m: SweepInput,
  direction: Direction,
  baseScore: number,
): { bonus: number; reason: string | null; counted: boolean } {
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  const sweepDirOk =
    (sweep15m.type === "bullish_sweep" && isLong) ||
    (sweep15m.type === "bearish_sweep" && isShort);
  const sweepStrengthOk = sweep15m.strength >= 0.5;
  const sweepBaseOk = baseScore >= 75;
  const sweepConfirmed = sweep15m.type !== null;

  if (sweepDirOk && sweepStrengthOk && sweepBaseOk && sweepConfirmed) {
    const bonus = Math.round(3 * sweep15m.strength);
    const reason = isLong
      ? `Downward sweep (15m, str ${sweep15m.strength.toFixed(2)}, +${bonus} pts)`
      : `Upward sweep (15m, str ${sweep15m.strength.toFixed(2)}, +${bonus} pts)`;
    return { bonus, reason, counted: true };
  }
  if (sweepDirOk && (!sweepStrengthOk || !sweepBaseOk)) {
    const why = !sweepBaseOk
      ? `score ${baseScore}<75`
      : `weak wick str ${sweep15m.strength.toFixed(2)}<0.5`;
    const reason = isLong
      ? `Downward sweep 15m (${why}, bonus yok)`
      : `Upward sweep 15m (${why}, bonus yok)`;
    return { bonus: 0, reason, counted: false };
  }
  return { bonus: 0, reason: null, counted: false };
}

// ───────── BONUS 2: Regime Synergy (0-3) ─────────

export type Regime =
  | "trending_strong"
  | "trending_weak"
  | "ranging_meanrev"
  | "ranging"
  | "transitioning"
  | "mixed"
  | "unknown";

export interface RegimeInput {
  adx: number | null;
  dirConfidence: number;
  counterTrend: boolean;
  bbPct: number | null;
  baseScore: number;
  direction: Direction;
}

export function scoreRegimeBonus(input: RegimeInput): {
  regime: Regime;
  bonus: number;
  reason: string | null;
} {
  const { adx, dirConfidence, counterTrend, bbPct, baseScore, direction } = input;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (adx === null || !(isLong || isShort) || baseScore < 75) {
    return { regime: "unknown", bonus: 0, reason: null };
  }

  if (adx >= 30 && dirConfidence === 3 && !counterTrend) {
    // +3 → 0: KALDIRILDI — üçlü pekiştirme simülasyonu (Senaryo C, bkz.
    // adaptiveWeights.ts'teki REGIME_WEIGHTS.trending_strong yorumu — aynı
    // gerekçe, aynı simülasyon). regime alanı "trending_strong" olarak
    // kalıyor (bucket/log/analiz için hâlâ anlamlı), sadece bonus katkısı
    // sıfırlandı.
    return {
      regime: "trending_strong",
      bonus: 0,
      reason: `🔥 Trending strong (ADX ${adx.toFixed(0)}, 3TF aligned) · synergy bonus devre dışı (Senaryo C)`,
    };
  }
  if (adx >= 20 && adx < 30 && dirConfidence >= 2 && !counterTrend) {
    return {
      regime: "trending_weak",
      bonus: 1,
      reason: `📈 Trending weak (ADX ${adx.toFixed(0)}) · +1 synergy`,
    };
  }
  if (adx < 20 && bbPct !== null) {
    const bbExtremeLong = isLong && bbPct <= 0.25;
    const bbExtremeShort = isShort && bbPct >= 0.75;
    if (bbExtremeLong || bbExtremeShort) {
      return {
        regime: "ranging_meanrev",
        bonus: 2,
        reason: `↔️ Ranging + BB extreme (ADX ${adx.toFixed(0)}) · +2 mean reversion`,
      };
    }
    return {
      regime: "ranging",
      bonus: 0,
      reason: `↔️ Ranging (ADX ${adx.toFixed(0)}) · BB mid, no bonus`,
    };
  }
  if (adx >= 20 && adx < 25 && dirConfidence < 2) {
    return {
      regime: "transitioning",
      bonus: 0,
      reason: `🔄 Transitioning (ADX ${adx.toFixed(0)}) · direction unclear, no bonus`,
    };
  }
  return { regime: "mixed", bonus: 0, reason: "⚪ Mixed regime · no bonus" };
}
