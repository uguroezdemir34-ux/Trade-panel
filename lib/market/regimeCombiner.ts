import { atrPercentile } from "@/lib/indicators/atr-percentile";
import { toIndicatorCandle, type Candle } from "@/lib/okx/candles";
import { checkAtrRegime } from "@/lib/score/blocks";
import type { AtrRegime } from "@/lib/indicators/atr-percentile";
import type { Direction } from "@/lib/score/direction";

/**
 * MARKET REGIME COMBINER — trend-gücü + volatilite eksenlerini bağımsız
 * olarak etiketler. Birleştirip TEK bir etikete indirgemez — ikisi ayrı
 * bilgi taşır (bkz. dosya sonundaki CombinedRegime).
 *
 * ⚠️ SENKRONİZASYON UYARISI — trend ekseni (classifyTrendRegime):
 * Eşikler lib/score/scorers.ts:333-384'teki scoreRegimeBonus() ile AYNI
 * sayısal değerlerle burada MANUEL olarak yeniden tanımlandı. OTOMATİK
 * SENKRON YOK. scorers.ts'teki eşikler değişirse bu dosya da elle
 * güncellenmeli. Bilinçli, kabul edilmiş bir kod-tekrarı riski —
 * scoreRegimeBonus()'un kendisi `baseScore < 75` iken hep "unknown"
 * döndürüyor (skor-bağımlı bir bonus mekanizması, genel amaçlı sürekli
 * bir rejim göstergesi değil), bu yüzden aynı mantık gate'siz olarak
 * burada yeniden ifade edildi. lib/score/scorers.ts'e HİÇ dokunulmadı,
 * sadece okunup birebir kopyalandı.
 *
 * Volatilite ekseni (classifyVolRegime) lib/score/blocks.ts'teki
 * checkAtrRegime()'i DOĞRUDAN ÇAĞIRIR (yeniden yazılmadı) — atrPercentile()
 * (lib/indicators, saf hesap, lib/score DEĞİL) sonucundaki percentile'ı
 * ona besler. Regime enum'u (compression/normal/expansion/
 * extreme_expansion) checkAtrRegime'in serbest-metin `reason` alanından
 * parse EDİLMEZ (kırılgan olurdu) — atrPercentile()'ın kendi `.regime`
 * alanından okunur; bu, checkAtrRegime'in kullandığı AYNI 20/80/95
 * bantlarını kullanıyor (blocks.ts:413-448 ile birebir aynı sınırlar),
 * hiçbir sapma riski yok. checkAtrRegime yine de çağrılır — adj/reason
 * (görüntü metni) skor motorunun kullandığı GERÇEK gate bilgisini taşısın
 * diye.
 */

// ───────── Trend ekseni ─────────

export type TrendRegimeLabel =
  | "trending_strong"
  | "trending_weak"
  | "ranging_meanrev"
  | "ranging"
  | "transitioning"
  | "mixed"
  | "unknown";

export interface TrendRegimeInput {
  adx: number | null;
  dirConfidence: number;
  counterTrend: boolean;
  bbPct: number | null;
  direction: Direction;
}

/**
 * scoreRegimeBonus() (lib/score/scorers.ts:333-384) ile AYNI eşikler,
 * `baseScore` gate'i OLMADAN — bkz. dosya başı uyarı. Bonus puanı
 * DÖNMEZ (bu, skora özel bir kavram) — sadece etiket.
 */
export function classifyTrendRegime(input: TrendRegimeInput): TrendRegimeLabel {
  const { adx, dirConfidence, counterTrend, bbPct, direction } = input;
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  if (adx === null || !(isLong || isShort)) return "unknown";

  if (adx >= 30 && dirConfidence === 3 && !counterTrend) return "trending_strong";
  if (adx >= 20 && adx < 30 && dirConfidence >= 2 && !counterTrend) return "trending_weak";
  if (adx < 20 && bbPct !== null) {
    const bbExtremeLong = isLong && bbPct <= 0.25;
    const bbExtremeShort = isShort && bbPct >= 0.75;
    if (bbExtremeLong || bbExtremeShort) return "ranging_meanrev";
    return "ranging";
  }
  if (adx >= 20 && adx < 25 && dirConfidence < 2) return "transitioning";
  return "mixed";
}

// ───────── Volatilite ekseni ─────────

export interface VolRegimeResult {
  label: AtrRegime;
  percentile: number;
  /** checkAtrRegime()'in canlı skor motorunda kullandığı GERÇEK adj değeri (görüntü amaçlı). */
  adj: number;
  reason: string | null;
}

/**
 * @param candles1h Tek pariteye ait ham 1h mum dizisi (candleStore'dan).
 */
export function classifyVolRegime(candles1h: readonly Candle[]): VolRegimeResult | null {
  const result = atrPercentile(candles1h.map(toIndicatorCandle));
  if (!result) return null;

  const atrReg = checkAtrRegime({ percentile: result.percentile });

  return {
    label: result.regime,
    percentile: result.percentile,
    adj: atrReg.adj,
    reason: atrReg.reason,
  };
}

// ───────── Birleştirme (indirgeme YOK) ─────────

export interface CombinedRegime {
  trend: TrendRegimeLabel;
  /** null = yetersiz mum verisi (atrPercentile en az 2×period bar istiyor). */
  vol: AtrRegime | null;
}

/**
 * İki ekseni YAN YANA taşır — TEK bir etikete indirgemez. Çakışma
 * durumunda (örn. trend güçlü + vol sıkışma) hangi eksenin öncelikli
 * olacağına dair mevcut kodda bir emsal YOK — bu bilinçli olarak
 * kararsız bırakıldı, UI ikisini de ayrı ayrı göstermeli.
 */
export function combineRegimes(
  trendInput: TrendRegimeInput,
  candles1h: readonly Candle[],
): CombinedRegime {
  const vol = classifyVolRegime(candles1h);
  return {
    trend: classifyTrendRegime(trendInput),
    vol: vol?.label ?? null,
  };
}
