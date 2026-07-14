import type { ScoreResult } from "@/lib/score/orchestrator";
import type { Pair } from "@/lib/constants/pairs";

/**
 * MARKET PULSE INDEX — QUANTIX'in kendi 24 coin evreninin net yön eğilimi.
 *
 * F&G Index'in (dış kaynak, alternative.me) yerini almaz — ona ek, iç
 * kaynaklı bir gösterge: "skor motorumuz şu an net olarak boğa mı ayı mı
 * eğilimde, ne kadar güvenle" sorusuna cevap verir.
 *
 * Formül: her geçerli pair için (LONG:+1 / SHORT:-1 / NEUTRAL:0) ×
 * dirConfidence toplanır, geçerli pair sayısı × maksimum confidence'a
 * normalize edilir → [-1,+1] → %0-%100 (50 = net nötr, coğunluk NEUTRAL
 * veya LONG/SHORT birbirini dengeliyorsa buraya yakın kalır).
 *
 * Saf türetme — results[pair]'den okur (zaten useScoreEngine tarafından
 * dolduruluyor), skor motoruna hiç dokunmaz, hiçbir şeye yazmaz.
 * Geçerli sonuç yoksa null — Hold/Exit Guide'daki "eşleşme yok → gösterme"
 * disipliniyle aynı, sahte bir yüzde göstermemek için.
 */

const MAX_DIR_CONFIDENCE = 3;

function directionSign(direction: ScoreResult["direction"]): number {
  if (direction === "LONG") return 1;
  if (direction === "SHORT") return -1;
  return 0;
}

export function computeMarketPulseIndex(
  results: Partial<Record<Pair, ScoreResult | null | undefined>>,
): number | null {
  const valid = Object.values(results).filter((r): r is ScoreResult => r != null);
  if (valid.length === 0) return null;

  const sum = valid.reduce(
    (acc, r) => acc + directionSign(r.direction) * r.dirConfidence,
    0,
  );
  const normalized = sum / (valid.length * MAX_DIR_CONFIDENCE);
  const percent = 50 + normalized * 50;

  return Math.round(Math.max(0, Math.min(100, percent)));
}
