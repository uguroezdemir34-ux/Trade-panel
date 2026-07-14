/**
 * POSITION ADOPTION — canlı bir pozisyon açılışını (pair+direction+cTime)
 * go_signals kayıtlarıyla eşleştirip system_with/system_against kararı üretir.
 *
 * Saf fonksiyon — I/O yok. Fetch (app/api/go-signals) ve dedup/logEvent
 * çağrısı usePositionPoller.ts'te (FAZ C) yapılır, bu modülde değil.
 *
 * Eşleştirme kuralı (onaylanan plan):
 *   - Pencere içindeki (cTime'dan windowMin dk öncesine kadar) sinyallerden
 *     EN YAKIN ZAMANLI olanı baz alınır (ilk değil, en son).
 *   - Yön eşleşirse system_with, eşleşmezse system_against.
 *   - Pencerede hiç sinyal yoksa null döner (system_against DEĞİL — go_signals
 *     yalnızca GO geçişlerini kaydediyor, "wait/no" durumlarını hiç loglamıyor,
 *     bu yüzden sinyal yokluğunu "panel karşıydı" diye yorumlamak yanlış
 *     pozitif ceza riski yaratır).
 */

export type AdherenceDecisionType = "system_with" | "system_against";

export interface GoSignalCandidate {
  direction: "LONG" | "SHORT";
  signalTs: number;
}

export interface AdherenceDecision {
  type: AdherenceDecisionType | null;
  matchedSignalTs: number | null;
}

/**
 * @param tradeDirection Pozisyonun yönü
 * @param candidates O pair için adaylar (herhangi bir sırada olabilir, herhangi bir yönde)
 * @param cTime Pozisyon açılış zamanı (epoch ms)
 * @param windowMin Sinyal ile açılış arası izin verilen maksimum süre (dk)
 */
export function decideAdherence(
  tradeDirection: "LONG" | "SHORT",
  candidates: readonly GoSignalCandidate[],
  cTime: number,
  windowMin: number,
): AdherenceDecision {
  const windowStart = cTime - windowMin * 60_000;

  const eligible = candidates.filter(
    (c) => c.signalTs <= cTime && c.signalTs >= windowStart,
  );

  if (eligible.length === 0) {
    return { type: null, matchedSignalTs: null };
  }

  const latest = eligible.reduce((a, b) => (b.signalTs > a.signalTs ? b : a));

  return {
    type: latest.direction === tradeDirection ? "system_with" : "system_against",
    matchedSignalTs: latest.signalTs,
  };
}
