/**
 * WS BACKOFF — Reconnect delay hesabı.
 * Kaynak: panel_v55_51.html satır 6215 (ws delay formülü).
 *
 * Strateji:
 *   - İlk FAST_RETRY_COUNT (4) deneme: 2s sabit (her URL'i hızlıca dene)
 *   - Sonrası: exponential backoff (3s, 4.5s, 6.75s, ...) max 30s
 *
 * Bu sayede ağ geçici düşse hızlıca toparlar, uzun süre düşmüşse
 * sunucuyu DOS etmez.
 */

import { WS_CONSTANTS } from "./types";

/**
 * Sıradaki reconnect'e kadar ms cinsinden bekleme süresi.
 *
 * @param retryCount Şu ana kadar yapılan toplam reconnect sayısı (1-based ilk = 1)
 * @returns ms delay (min 2000, max 30000)
 *
 * @example
 *   getReconnectDelay(1) === 2000
 *   getReconnectDelay(4) === 2000
 *   getReconnectDelay(5) === 3000        (3000 * 1.5^0)
 *   getReconnectDelay(6) === 4500        (3000 * 1.5^1)
 *   getReconnectDelay(7) === 6750        (3000 * 1.5^2)
 *   getReconnectDelay(20) === 30000      (max cap)
 */
export function getReconnectDelay(retryCount: number): number {
  if (retryCount <= 0) return WS_CONSTANTS.FAST_RETRY_DELAY_MS;
  if (retryCount <= WS_CONSTANTS.FAST_RETRY_COUNT) {
    return WS_CONSTANTS.FAST_RETRY_DELAY_MS;
  }
  const step = Math.min(
    retryCount - WS_CONSTANTS.FAST_RETRY_COUNT,
    WS_CONSTANTS.MAX_BACKOFF_STEPS,
  );
  const delay =
    WS_CONSTANTS.SLOW_RETRY_BASE_MS *
    Math.pow(WS_CONSTANTS.BACKOFF_FACTOR, step - 1);
  return Math.min(WS_CONSTANTS.MAX_RECONNECT_MS, Math.round(delay));
}

/** ±%20 (simetrik, "equal-ish" çarpımsal jitter). */
const JITTER_RATIO = 0.2;

/**
 * getReconnectDelay()'in DIŞINDA, ayrı bir katman — kasıtlı olarak
 * getReconnectDelay()'in kendisine dokunulmadı: bu fonksiyon deterministik
 * (tests/integration/notify-format-backoff.test.ts tam sayı eşitliğiyle
 * test ediyor, `toBe(2000)` gibi — jitter'ı doğrudan içine koysak o
 * testlerin hepsi kırılırdı). "Decorrelated jitter" (AWS'in önerdiği,
 * önceki gecikmeyi state olarak taşıyan varyant) burada BİLEREK
 * kullanılmadı — getReconnectDelay() saf/stateless bir fonksiyon,
 * önceki gecikmeyi hatırlamıyor; onu stateful hale getirmek çok daha
 * invaziv bir mimari değişiklik olurdu. Bunun yerine "full jitter" de
 * değil (0..delay arası tam rastgelelik min-2000ms garantisini bozardı,
 * neredeyse anında yeniden bağlanma denemesine yol açabilirdi — tam
 * önlemeye çalıştığımız "thundering herd"in bir başka türü). Basit,
 * simetrik ±%20 çarpımsal jitter en az invaziv seçenek: saf, state'siz,
 * mevcut min/max sabitlerini kabaca koruyor (örn. 30000 tavanı jitter
 * sonrası ~24000-36000 arasına yayılıyor — bu kasıtlı, tavan artık
 * getReconnectDelay()'in DEĞİL bu fonksiyonun garantisi).
 *
 * @param delayMs getReconnectDelay()'in (veya benzer bir sabit gecikmenin) çıktısı
 * @returns delayMs × [0.8, 1.2] arası, en yakın tam sayıya yuvarlanmış
 */
export function applyJitter(delayMs: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * JITTER_RATIO;
  return Math.round(delayMs * factor);
}
