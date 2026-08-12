/**
 * AI SENARYO — yön-bağımsız ham S/R geometrisi.
 *
 * lib/sr/detect.ts'teki detectSRLevels() skor motorunun bir parçası (soft
 * penalty hesaplar) — burada modifier/meta değil, SADECE ham seviye listesi
 * kullanılıyor: 'NEUTRAL' yön + volRatio=null ile çağrılır, bu da modifier
 * hesabını devre dışı bırakır (detectSRLevels'in kendi mantığı: modifier
 * sadece direction LONG/SHORT olduğunda hesaplanır, NEUTRAL'da 0 kalır) —
 * yani bu modülün amacı için zaten anlamsız olan modifier/meta alanları,
 * hesaplanmadıkları için değil, bilinçli olarak kullanılmadıkları için
 * dönüş tipinden dışlanıyor (SrLevels).
 *
 * OKX candle fetch, lib/server/signalEngine.ts'teki fetchOkxCandles() ile
 * AYNI desen (public endpoint, doğrudan OKX'e, proxy yok, no-store) —
 * BİLEREK ayrı bir kopya: o fonksiyon export edilmemiş (modül-private) ve
 * bu görev sadece bu dosyayı yazmayı istiyor, mevcut/kanıtlanmış
 * signalEngine.ts'e dokunulmadı (fetchCandlesWithStatus'un lib/okx/candles.ts'teki
 * kendi dosya başı yorumundaki gerekçeyle aynı: mevcut koda dokunmama riski,
 * küçük bir kod tekrarına tercih edildi).
 */

import { detectSRLevels, type SrLevels } from "@/lib/sr/detect";
import { toIndicatorCandle, type Candle as OkxRawCandle } from "@/lib/okx/candles";
import type { Candle } from "@/types/candle";
import type { Pair } from "@/lib/constants/pairs";

const OKX_BASE = "https://www.okx.com";

function instIdFor(pair: Pair): string {
  return `${pair}-USDT-SWAP`;
}

/** Fetch OKX public candles — no auth required. lib/server/signalEngine.ts'teki
 *  fetchOkxCandles() ile aynı parse mantığı (bkz. dosya başı yorumu). */
async function fetchOkxCandles(instId: string, bar: string, limit: number): Promise<OkxRawCandle[]> {
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

/**
 * Bir parite için ham (yön-bağımsız) S/R seviyelerini döner.
 *
 * 4H + 1H mumlar OKX'ten çekilir (ikisi de detectSRLevels için gerekli —
 * 4H önceki gün/hafta H-L + 4H pivot, 1H ise 1H pivot + strength testi
 * kaynağı), kapanmamış (confirm=false) mumlar filtrelenir, {o,h,l,c,v,t}
 * formatına çevrilir (toIndicatorCandle — lib/okx/candles.ts'teki mevcut
 * fonksiyon, types/candle.ts'teki Candle şeklini üretir).
 *
 * currentPrice = en son KAPANMIŞ 1H mumun close'u (composeScoreInput'un
 * tam skor pipeline'ı bu modülde YOK, bu yüzden ayrı bir ticker fetch'i
 * yerine zaten elde olan candle verisinden türetildi).
 *
 * @returns Fetch başarısız/veri yetersizse (1H veya 4H mum dizisi boş) null
 *   — sessizce boş bir SrLevels dönmek "hiç S/R seviyesi yok" ile "veri
 *   çekilemedi" durumlarını ayırt edilemez kılardı.
 */
export async function fetchScenarioSRLevels(pair: Pair): Promise<SrLevels | null> {
  const instId = instIdFor(pair);

  const [raw1h, raw4h] = await Promise.all([
    fetchOkxCandles(instId, "1H", 300),
    fetchOkxCandles(instId, "4H", 300),
  ]);

  const candles1h = raw1h.filter((c) => c.confirm);
  const candles4h = raw4h.filter((c) => c.confirm);
  if (candles1h.length === 0 || candles4h.length === 0) return null;

  const k1h: Candle[] = candles1h.map(toIndicatorCandle);
  const k4h: Candle[] = candles4h.map(toIndicatorCandle);

  const currentPrice = k1h[k1h.length - 1].c;

  const result = detectSRLevels(k4h, k1h, currentPrice, "NEUTRAL", null);
  return result.levels;
}
