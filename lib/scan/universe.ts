/**
 * SCAN UNIVERSE — OKX'teki TÜM USDT-margined SWAP enstrümanlarını tarar,
 * mevcut 9 skorlanan parite (lib/constants/pairs.ts → PAIRS) dışında
 * hacim + volatilite bazlı bir aday listesi üretir.
 *
 * Sadece doğrulama/araştırma amaçlı — lib/score/*'a hiç dokunmuyor,
 * Supabase'e hiçbir yazım yok, tamamen izole bir modül.
 *
 * ⚠️ VERIFY: OKX'in SWAP ticker'larındaki `volCcy24h` alanının base-coin
 * cinsinden olduğu VARSAYILIYOR — bu yüzden USD hacmi `volCcy24h * last`
 * ile hesaplanıyor. Bu doğrulanmadı. İlk gerçek /api/scan/universe
 * çıktısında BTC/ETH için dönen volumeUsd değerini bilinen 24s USD
 * hacimleriyle (ör. CoinMarketCap/OKX arayüzü) karşılaştırıp doğrula.
 *
 * NOT (çelişki, netleştirilmeli): lib/ws/messages.ts'teki mevcut bir yorum
 * ("USDT-margined SWAP için quote currency (USDT) 24h hacim = USD nominal")
 * volCcy24h'ın USDT-margined SWAP'ta ZATEN quote-currency/USD cinsinden
 * olduğunu, yani hiç fiyatla çarpılmaması gerektiğini iddia ediyor — bu
 * dosyadaki varsayımla DOĞRUDAN ÇELİŞİYOR. İlk doğrulama bu ikisinden
 * hangisinin doğru olduğunu netleştirecek.
 */

import { PAIRS } from "@/lib/constants/pairs";

const TICKERS_URL = "https://www.okx.com/api/v5/market/tickers?instType=SWAP";
const MIN_VOLUME_USD = 50_000_000;
const MAX_CANDIDATES = 25;
const FETCH_TIMEOUT_MS = 8_000;

const EXISTING_PAIRS: ReadonlySet<string> = new Set(PAIRS);

export interface ScanCandidate {
  instId: string;
  symbol: string;
  volumeUsd: number;
  lastPrice: number;
  changePct24h: number;
  /** OKX'in döndürdüğü ham volCcy24h (string→number çevrilmiş, çarpım
   *  uygulanmamış) — bu modülün varlık sebebi olan varsayım çelişkisini
   *  (dosya başı NOT) doğrulamak için, kalıcı olarak taşınıyor. */
  volCcy24hRaw: number;
}

function parseTickerRow(row: unknown): ScanCandidate | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  if (typeof r.instId !== "string" || !r.instId.endsWith("-USDT-SWAP")) return null;

  const symbol = r.instId.split("-")[0];
  // NOT: mevcut-parite hariç tutma/dahil etme kontrolü BİLEREK burada değil,
  // artık scanUniverse()'de (onlyExisting opsiyonuna bağlı) — bu fonksiyon
  // sadece parse/format doğrulaması yapar, iş kuralı filtrelemez.

  const last = typeof r.last === "string" ? parseFloat(r.last) : NaN;
  if (!isFinite(last) || last <= 0) return null;

  const volCcy24h = typeof r.volCcy24h === "string" ? parseFloat(r.volCcy24h) : NaN;
  if (!isFinite(volCcy24h) || volCcy24h <= 0) return null;

  // ⚠️ VERIFY — bkz. dosya başı notu
  const volumeUsd = volCcy24h * last;

  const open24h = typeof r.open24h === "string" ? parseFloat(r.open24h) : NaN;
  const changePct24h =
    isFinite(open24h) && open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;

  return {
    instId: r.instId,
    symbol,
    volumeUsd,
    lastPrice: last,
    changePct24h,
    volCcy24hRaw: volCcy24h,
  };
}

export interface ScanUniverseOptions {
  /**
   * GEÇİCİ DEBUG PARAMETRESİ (chat'te istendi — VPIN vol24h ölçek
   * doğrulaması için) — true ise filtre TERSİNE döner: SADECE mevcut 9
   * skorlanan parite (lib/constants/pairs.ts → PAIRS) döner, geri kalan
   * onlarca/yüzlerce enstrüman elenir. MIN_VOLUME_USD ve MAX_CANDIDATES
   * hiç uygulanmaz (9 satır zaten 25'in altında, kırpma anlamsız). Amaç:
   * telefonda tek ekranda okunabilir bir çıktı (9 satır), yüzlerce satırlık
   * ham OKX sayfasının aynısını tekrar üretmemek. Kalıcı bir özellik
   * DEĞİL — doğrulama bitince kaldırılabilir.
   */
  onlyExisting?: boolean;
}

/**
 * "Ağ öldü" / "yanıt bozuk" durumları ile "hepsi filtreden elendi" (meşru
 * boş sonuç) durumunu ayırt etmek için — ilki fırlatılır (caller/route
 * bunu görür), ikincisi normal bir boş dizi olarak döner.
 */
export async function scanUniverse(
  opts: ScanUniverseOptions = {},
): Promise<ScanCandidate[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  let raw: unknown;
  try {
    const res = await fetch(TICKERS_URL, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      throw new Error(`OKX tickers fetch başarısız: HTTP ${res.status}`);
    }
    raw = await res.json();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("OKX tickers fetch başarısız")) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`OKX tickers fetch/parse hatası: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("OKX tickers yanıtı JSON objesi değil");
  }
  const data = (raw as Record<string, unknown>).data;
  if (!Array.isArray(data)) {
    throw new Error("OKX tickers yanıtında 'data' dizisi yok");
  }

  const candidates: ScanCandidate[] = [];
  for (const row of data) {
    const candidate = parseTickerRow(row);
    if (!candidate) continue;
    const isExisting = EXISTING_PAIRS.has(candidate.symbol);
    if (opts.onlyExisting ? !isExisting : isExisting) continue;
    if (opts.onlyExisting || candidate.volumeUsd >= MIN_VOLUME_USD) {
      candidates.push(candidate);
    }
  }

  candidates.sort((a, b) => Math.abs(b.changePct24h) - Math.abs(a.changePct24h));
  return opts.onlyExisting ? candidates : candidates.slice(0, MAX_CANDIDATES);
}
