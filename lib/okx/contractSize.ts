/**
 * OKX CONTRACT SIZE — Kontrat adedi → gerçek coin miktarı çevrimi.
 *
 * KÖK SEBEP (fix edilen bug): `/api/v5/account/positions` endpoint'inin
 * `pos` alanı SWAP instrument'ları için KONTRAT ADEDİDİR, coin miktarı
 * DEĞİL. Önceden lib/okx/positions.ts bu değeri doğrudan `Position.size`
 * olarak coin miktarıymış gibi kullanıyordu — her instrument'ın ctVal'i
 * farklı olduğu için (örn. BTC-USDT-SWAP=0.01) bu, gösterilen size/PnL
 * delta'sını ctVal kadar (BTC için ~100x) yanlış ölçeklendiriyordu.
 *
 * `getRealSize(sz, instId)` = sz × ctVal[instId] — gerçek coin miktarı.
 *
 * ctVal haritası `/api/v5/public/instruments?instType=SWAP`'tan dinamik
 * çekilir (lib/okx/instruments.ts), TTL cache'lenir (lib/macro/cache.ts'in
 * genel amaçlı in-memory TTL cache'i — macro'ya özel değil, sadece o
 * modülde zaten var olan aynı deseni tekrar kullanıyoruz). ctVal saatler
 * mertebesinde sabit kaldığı için (kontrat spesifikasyonu, fiyat gibi
 * saniyede değişmez) TTL uzun (6 saat) tutuldu.
 *
 * NOT: lib/hooks/useLiqFeed.ts'teki `OKX_CONTRACT_SIZE` sabit haritası
 * BİLEREK dokunulmadı — o, likidasyon feed'inin notional gösterimi için
 * ayrı, önceden var olan bir hardcoded tablo (kozmetik gösterim, skor
 * motoruna girmiyor). Bu görev sadece pozisyon büyüklüğü/PnL kapsamında.
 */

import { fetchSwapInstruments } from "./instruments";
import { cacheGet, cacheSet } from "@/lib/macro/cache";

const CACHE_KEY = "okx_swap_ctval_map";
const CTVAL_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat — kontrat spesifikasyonu nadiren değişir

/** Aynı anda birden fazla çağrı varsa tek network isteğine düşür. */
let inFlight: Promise<Record<string, number>> | null = null;

/**
 * ctVal haritasını döndürür — cache'te taze veri varsa onu, yoksa
 * fetchSwapInstruments() ile taze çeker ve cache'ler. Ağ hatasında,
 * cache'te (süresi dolmuş da olsa) hiç veri yoksa boş obje döner —
 * bu durumda getRealSize() aşağıdaki güvenli fallback'e düşer.
 */
export async function ensureCtValMap(now: number = Date.now()): Promise<Record<string, number>> {
  const cached = cacheGet<Record<string, number>>(CACHE_KEY, now);
  if (cached) return cached;

  if (inFlight) return inFlight;

  inFlight = fetchSwapInstruments()
    .then((map) => {
      inFlight = null;
      if (map && Object.keys(map).length > 0) {
        cacheSet(CACHE_KEY, map, Date.now(), CTVAL_TTL_MS);
        return map;
      }
      // fetchSwapInstruments() null/boş döndü (network/parse hatası) —
      // Sentry veya benzeri bir hata izleme entegrasyonu projede YOK
      // (package.json'da doğrulandı), bu yüzden tek görünürlük kaynağı
      // console.warn. Boş harita CACHE'E YAZILMAZ (kasıtlı) — bir sonraki
      // fetchPositions() cycle'ında (10sn) tekrar denenir, kalıcı bir
      // "hiç veri yok" durumu sessizce sonsuza dek cache'lenmez.
      console.warn(
        "[contractSize] ctVal haritası çekilemedi (network/parse hatası) — " +
        "pozisyon size'ları bu cycle'da ölçeklendirilmeden (ham kontrat " +
        "adedi) dönebilir. Bir sonraki poll cycle'ında tekrar denenecek.",
      );
      return {};
    })
    .catch(() => {
      inFlight = null;
      console.warn(
        "[contractSize] ctVal haritası çekilirken beklenmeyen hata — " +
        "pozisyon size'ları bu cycle'da ölçeklendirilmeden dönebilir.",
      );
      return {};
    });

  return inFlight;
}

/**
 * Kontrat adedini (OKX `pos` alanı) gerçek coin miktarına çevirir.
 *
 * @param sz OKX `pos` alanından gelen mutlak kontrat adedi
 * @param instId "BTC-USDT-SWAP" gibi — Position.instId
 * @param ctValMap ensureCtValMap()'ten gelen harita. Verilmezse boş obje
 *   varsayılır (fallback: sz aynen döner — ctVal bilinmiyorsa "hiç
 *   ölçeklendirme yapma", sessizce yanlış bir katsayı UYDURMAKTAN iyi).
 *   Bu fallback yolu bir console.warn ÜRETİR (dönüş değerini etkilemez,
 *   sadece görünürlük için) — böylece 100x bug'ın sessizce geri gelmesi
 *   (ctVal fetch'i kalıcı başarısız olursa) fark edilmeden geçmez.
 */
export function getRealSize(
  sz: number,
  instId: string,
  ctValMap: Record<string, number> = {},
): number {
  const ctVal = ctValMap[instId];
  if (ctVal === undefined || !isFinite(ctVal) || ctVal <= 0) {
    console.warn(
      `[contractSize] ${instId} için ctVal bilinmiyor — size ölçeklendirilmeden (${sz}) döndü. ` +
      "ctVal haritası henüz yüklenmemiş veya bu instId instruments yanıtında yok olabilir.",
    );
    return sz;
  }
  return sz * ctVal;
}
