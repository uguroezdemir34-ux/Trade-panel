/**
 * VPIN — Volume-Synchronized Probability of Informed Trading
 *
 * Easley, López de Prado, O'Hara (2012):
 * "Flow Toxicity and Liquidity in a High-Frequency World"
 *
 * Buildix Capital, Hyblock'ın sattığı sinyal — biz dünyada ilk retail
 * otomasyon panelinde ücretsiz sunuyoruz.
 *
 * ═══════════ ALGORİTMA ═══════════
 *
 * 1. Volume Bucket: Sabit hacim taşıyan kovalar.
 *    Bucket size V (örn: günlük hacmin 1/50'si)
 *    Trade'ler bucket'a doldurulur, V dolunca bucket "kapanır"
 *
 * 2. Bucket Imbalance:
 *    imbalance = |buy_vol - sell_vol| / total_vol
 *    Sonuç: 0 (dengeli) → 1 (tamamen tek taraflı)
 *
 * 3. VPIN: Son N bucket'ın imbalance ortalaması (sliding window)
 *
 * 4. Yorumlama:
 *    < 0.30 : normal
 *    < 0.45 : artıyor
 *    < 0.55 : warning
 *    < 0.70 : toxic — bilgilenmiş aktivite
 *    ≥ 0.70 : extreme — büyük hareket loading
 *
 * ═══════════ NEDEN ÖNEMLİ ═══════════
 *
 * Klasik zaman-tabanlı CVD volatil dakikalarda yanıltıcı — fiyat
 * hareket ettikten SONRA dolu olur. VPIN ise hacim-tabanlı, fiyat
 * hareket ETMEDEN ÖNCE bilgilenmiş trader aktivitesini yakalar.
 *
 * Bu, "Flash Crash 2010'u önceden tahmin etti" diye akademide ün
 * kazanmasının sebebi.
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Trade } from "./types";

/**
 * Bir volume bucket — V hacim dolduğunda kapanır.
 */
export interface VolumeBucket {
  /** Bucket başlangıç zamanı (ilk trade) */
  startedAt: number;
  /** Bucket kapanış zamanı (son trade, V dolunca) */
  closedAt: number | null;
  /** Buy tarafı hacim (notional USD) */
  buyVolumeUsd: number;
  /** Sell tarafı hacim (notional USD) */
  sellVolumeUsd: number;
  /** Total hacim USD */
  totalVolumeUsd: number;
  /** Bucket kapandı mı (target hacim'e ulaştı mı) */
  closed: boolean;
  /** Imbalance: |buy-sell|/total (0-1) */
  imbalance: number;
}

/**
 * Toxicity level — VPIN değerinin yorumu.
 */
export type ToxicityLevel =
  | "normal" // < 0.30
  | "elevated" // 0.30 - 0.45
  | "warning" // 0.45 - 0.55
  | "toxic" // 0.55 - 0.70
  | "extreme"; // ≥ 0.70

/**
 * VPIN hesap sonucu.
 */
export interface VpinResult {
  pair: Pair;
  /** VPIN değeri (0-1) */
  vpin: number;
  /** Yorumlama */
  toxicity: ToxicityLevel;
  /** Hesapta kullanılan bucket sayısı (sliding window dolu mu?) */
  bucketCount: number;
  /** Maksimum sliding window (target) */
  maxBuckets: number;
  /** Yeterli veri var mı? */
  ready: boolean;
  /**
   * Bucket boyutu vol24h'tan netleşti mi (bkz. PairFeedState.vpinConfigured,
   * lib/orderflow/tradeFeed.ts). false ise "warming up" değil "vol24h
   * bekleniyor" — ikisi farklı durumlar, humanReason bunu ayırt eder.
   */
  configured: boolean;
  /** İnsan-okunaklı özet */
  humanReason: string;
}

/**
 * VPIN config parametreleri.
 */
export interface VpinConfig {
  /** Bucket hacim hedefi (USD notional) */
  bucketSizeUsd: number;
  /** Sliding window uzunluğu (bucket sayısı) */
  windowSize: number;
}

/**
 * Default VPIN config (BTC için) — vol24h yoksa devreye giren fallback.
 *
 * DÜZELTME (chat'te ölçüldü, /api/scan/universe?pairs=1): Önceki $50M
 * değeri "günlük ~$20-50B" varsayımına dayanıyordu — bu rakam borsalar-arası
 * TOPLAM hacimdi, tek borsanın (OKX, bu sistemin veri kaynağı) değil.
 * Gerçek ölçüm: OKX'te BTC-USDT-SWAP 24s hacmi ~$6.15B. DAILY_BUCKETS_TARGET
 * (lib/store/tradeFeedStore.ts, =500) ile tutarlı olması için:
 * $6.15B / 500 ≈ $12.3M → $12M'e yuvarlandı.
 *
 * Window 50 bucket, D=500 ile ≈2.4 saatlik flow (bkz. tradeFeedStore.ts'teki
 * DAILY_BUCKETS_TARGET yorumu — bu iki dosya artık tutarlı).
 */
export const DEFAULT_VPIN_CONFIG: VpinConfig = {
  bucketSizeUsd: 12_000_000, // $12M
  windowSize: 50,
};

/**
 * ETH için config.
 *
 * NOT: Bu değer önceden "BTC'nin 0.25'i" olarak türetilmiş görünüyordu —
 * o gerekçe artık geçersiz (BTC $50M'den $12M'e düzeltildi, bkz.
 * DEFAULT_VPIN_CONFIG). Ama ölçüm (chat'te, /api/scan/universe?pairs=1)
 * ETH'nin gerçek dinamik bucket'ının (vol24h/500) zaten ~$12.6M çıktığını
 * gösterdi — yani bu $12.5M rastlantısal olarak doğru kalibre, BTC'den
 * türetilerek değil. Değiştirilmedi.
 */
export const ETH_VPIN_CONFIG: VpinConfig = {
  bucketSizeUsd: 12_500_000, // $12.5M
  windowSize: 50,
};

const ALT_VPIN_CONFIGS: Partial<Record<Pair, VpinConfig>> = {};

export function getDefaultConfig(pair: Pair): VpinConfig {
  if (pair === "ETH") return ETH_VPIN_CONFIG;
  return ALT_VPIN_CONFIGS[pair] ?? DEFAULT_VPIN_CONFIG;
}

// ════════════════════ BUCKET STATE MACHINE ════════════════════

/**
 * Boş, henüz başlamamış bucket.
 */
function emptyBucket(): VolumeBucket {
  return {
    startedAt: 0,
    closedAt: null,
    buyVolumeUsd: 0,
    sellVolumeUsd: 0,
    totalVolumeUsd: 0,
    closed: false,
    imbalance: 0,
  };
}

/**
 * Bucket'ın imbalance'ini hesapla — saf yardımcı.
 */
function calculateImbalance(b: VolumeBucket): number {
  if (b.totalVolumeUsd === 0) return 0;
  return Math.abs(b.buyVolumeUsd - b.sellVolumeUsd) / b.totalVolumeUsd;
}

/**
 * Bucket'a bir trade ekle. Bucket dolarsa yeni bucket başlat.
 *
 * Returns:
 *   - currentBucket: Eklemeden sonra (henüz dolu değilse) veya yeni başlamış
 *   - closedBucket: Doldu ve kapandıysa kapanan bucket (null değilse)
 */
export function addTradeToBucket(
  bucket: VolumeBucket,
  trade: Trade,
  bucketSizeUsd: number,
): { currentBucket: VolumeBucket; closedBucket: VolumeBucket | null } {
  // Boş bucket için ilk trade
  const isFirstTrade = bucket.totalVolumeUsd === 0;
  const startedAt = isFirstTrade ? trade.timestamp : bucket.startedAt;

  const newBuy =
    bucket.buyVolumeUsd + (trade.side === "buy" ? trade.notionalUsd : 0);
  const newSell =
    bucket.sellVolumeUsd + (trade.side === "sell" ? trade.notionalUsd : 0);
  const newTotal = newBuy + newSell;

  // Bucket dolmuş mu?
  if (newTotal >= bucketSizeUsd) {
    // Kapat — bu trade bucket'ı tam doldurdu (taşan kısmı bu bucket'a sayıyoruz, fragmente etmiyoruz)
    const closed: VolumeBucket = {
      startedAt,
      closedAt: trade.timestamp,
      buyVolumeUsd: newBuy,
      sellVolumeUsd: newSell,
      totalVolumeUsd: newTotal,
      closed: true,
      imbalance: 0, // hesapla aşağıda
    };
    closed.imbalance = calculateImbalance(closed);

    // Yeni boş bucket başlat
    return {
      currentBucket: emptyBucket(),
      closedBucket: closed,
    };
  }

  // Henüz doldurulmadı — bucket güncelle
  return {
    currentBucket: {
      startedAt,
      closedAt: null,
      buyVolumeUsd: newBuy,
      sellVolumeUsd: newSell,
      totalVolumeUsd: newTotal,
      closed: false,
      imbalance: calculateImbalance({
        startedAt,
        closedAt: null,
        buyVolumeUsd: newBuy,
        sellVolumeUsd: newSell,
        totalVolumeUsd: newTotal,
        closed: false,
        imbalance: 0,
      }),
    },
    closedBucket: null,
  };
}

// ════════════════════ VPIN STATE ════════════════════

/**
 * VPIN engine'in tam state'i.
 */
export interface VpinState {
  pair: Pair;
  config: VpinConfig;
  /** Şu anda dolan bucket */
  currentBucket: VolumeBucket;
  /** Kapanmış son N bucket (sliding window) */
  closedBuckets: VolumeBucket[];
  /** Son hesaplanan VPIN değeri (cache) */
  lastVpin: number;
}

/**
 * Boş VPIN state oluştur.
 */
export function createVpinState(pair: Pair, config?: VpinConfig): VpinState {
  return {
    pair,
    config: config ?? getDefaultConfig(pair),
    currentBucket: emptyBucket(),
    closedBuckets: [],
    lastVpin: 0,
  };
}

/**
 * Trade batch'i state'e işle.
 * Dolan bucket'lar sliding window'a eklenir, eski'ler atılır.
 */
export function ingestTradesIntoVpin(
  state: VpinState,
  trades: readonly Trade[],
): VpinState {
  let currentBucket = state.currentBucket;
  let closedBuckets = [...state.closedBuckets];

  for (const trade of trades) {
    // Pair filter (savunma)
    if (trade.pair !== state.pair) continue;

    const result = addTradeToBucket(
      currentBucket,
      trade,
      state.config.bucketSizeUsd,
    );
    currentBucket = result.currentBucket;
    if (result.closedBucket) {
      closedBuckets.push(result.closedBucket);
      // Sliding window: en eski'leri at
      if (closedBuckets.length > state.config.windowSize) {
        closedBuckets = closedBuckets.slice(
          closedBuckets.length - state.config.windowSize,
        );
      }
    }
  }

  // VPIN hesapla
  const vpin =
    closedBuckets.length === 0
      ? 0
      : closedBuckets.reduce((sum, b) => sum + b.imbalance, 0) /
        closedBuckets.length;

  return {
    pair: state.pair,
    config: state.config,
    currentBucket,
    closedBuckets,
    lastVpin: vpin,
  };
}

// ════════════════════ INTERPRETATION ════════════════════

/**
 * VPIN değerini toxicity level'a çevir.
 */
export function classifyToxicity(vpin: number): ToxicityLevel {
  if (vpin < 0.30) return "normal";
  if (vpin < 0.45) return "elevated";
  if (vpin < 0.55) return "warning";
  if (vpin < 0.70) return "toxic";
  return "extreme";
}

/**
 * VPIN result hesapla — UI/integration için tam paket.
 *
 * @param configured Bucket boyutu vol24h'tan netleşti mi (bkz.
 *   PairFeedState.vpinConfigured). BİLEREK varsayılan değeri YOK — chat'te
 *   karar verildi: "configured=true" varsayılanı, bu değeri geçmeyi
 *   unutan bir çağıranın sessizce "netleşmiş" iddia etmesine yol açardı
 *   (bugünün ana dersiyle aynı sınıf hata). Her çağıran tsc tarafından
 *   bu kararı açıkça vermeye zorlanır.
 */
export function computeVpinResult(state: VpinState, configured: boolean): VpinResult {
  const minBucketsForReady = 10;
  const ready = state.closedBuckets.length >= minBucketsForReady;

  return {
    pair: state.pair,
    vpin: state.lastVpin,
    toxicity: classifyToxicity(state.lastVpin),
    bucketCount: state.closedBuckets.length,
    maxBuckets: state.config.windowSize,
    ready,
    configured,
    humanReason: humanReasonForVpin(state.lastVpin, ready, configured),
  };
}

function humanReasonForVpin(vpin: number, ready: boolean, configured: boolean): string {
  if (!configured) return "VPIN waiting for volume data";
  if (!ready) return "VPIN warming up (insufficient data)";
  const tox = classifyToxicity(vpin);
  switch (tox) {
    case "normal":
      return "Market normal — flow balanced";
    case "elevated":
      return "Flow asymmetric — caution";
    case "warning":
      return "Informed activity started";
    case "toxic":
      return "Smart money active — large move approaching";
    case "extreme":
      return "Maximum toxicity — violent move loading";
  }
}

// ════════════════════ SCORE INTEGRATION HELPER ════════════════════

/**
 * VPIN'in score multiplier'ı.
 *
 * Düşük toxicity (normal) → 1.0x (etki yok)
 * Yüksek toxicity (toxic/extreme) → 1.3x-1.5x güçlendirir EĞER signal direction
 * ile uyumluysa (CVD üzerinden), aksi halde 0.7x zayıflatır.
 *
 * Bu, "smart money aktif" durumunda doğru tarafta olunca güveni artırır.
 */
export function vpinScoreMultiplier(
  vpin: number,
  signalAlignedWithFlow: boolean,
): number {
  const tox = classifyToxicity(vpin);
  if (tox === "normal" || tox === "elevated") return 1.0;

  if (signalAlignedWithFlow) {
    // Smart money bizim yönümüzde → güveni güçlendir
    if (tox === "warning") return 1.15;
    if (tox === "toxic") return 1.3;
    return 1.5; // extreme
  } else {
    // Smart money ters yönde → güveni zayıflat
    if (tox === "warning") return 0.85;
    if (tox === "toxic") return 0.7;
    return 0.5; // extreme — neredeyse VETO
  }
}
