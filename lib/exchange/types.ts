import type { Pair } from "@/lib/constants/pairs";

// ═══════════════ INPUT TYPES ═══════════════

export interface OpenPositionInput {
  pair: Pair;
  direction: "LONG" | "SHORT";
  qty: number;
  leverage: number;
  marginMode: "cross" | "isolated";
  /** SL trigger fiyatı (algo order) */
  slPrice?: number;
  /** TP1 trigger fiyatı (algo order) */
  tp1Price?: number;
  /** TP2 trigger fiyatı — opsiyonel */
  tp2Price?: number;
  /**
   * Slippage guard tarafından belirlenen emir tipi.
   * Varsayılan: "market" (geriye dönük uyumlu).
   */
  ordType?: "market" | "limit" | "post_only";
  /**
   * Limit / Post-Only emirler için fiyat.
   * ordType="market" ise ignored.
   */
  limitPx?: number;
}

export interface ClosePositionInput {
  instId: string;
  mgnMode: "cross" | "isolated";
  posSide?: "long" | "short";
}

export interface PartialCloseInput {
  instId: string;
  mgnMode: "cross" | "isolated";
  /** Current position direction (determines which side to reduce) */
  direction: "LONG" | "SHORT";
  /** Qty to close in coin units */
  qty: number;
}

export interface UpdateSlTpInput {
  instId: string;
  direction: "LONG" | "SHORT";
  mgnMode: "cross" | "isolated";
  /** Full position size (for algo order sizing) */
  qty: number;
  slPrice?: number;
  tp1Price?: number;
  tp2Price?: number;
}

// ═══════════════ RESULT TYPES ═══════════════

export interface TradeData {
  orderId?: string;
  instId?: string;
  fillPx?: number;
  fillSz?: number;
}

export interface AdapterResult<T = unknown> {
  ok: boolean;
  data?: T;
  errorKind?: string;
  errorMessage?: string;
}

// ═══════════════ ADAPTER INTERFACE ═══════════════

/**
 * ExchangeAdapter — borsa işlemleri için DI arayüzü.
 * Gerçek impl: OkxAdapter. Test: MockAdapter.
 */
export interface ExchangeAdapter {
  /** Market order ile pozisyon aç (+ SL/TP algo emirleri) */
  openPosition(input: OpenPositionInput): Promise<AdapterResult<TradeData>>;
  /** Pozisyonu market order ile kapat */
  closePosition(input: ClosePositionInput): Promise<AdapterResult<void>>;
  /** Bekleyen algo emirlerini (SL/TP) iptal et */
  cancelAlgoOrders(instId: string): Promise<AdapterResult<void>>;
  /** Pozisyonun bir kısmını kapat (hedge modda ters taraf market order) */
  partialClosePosition(input: PartialCloseInput): Promise<AdapterResult<void>>;
  /** Mevcut algo emirlerini iptal edip yeni SL/TP koy */
  updateSlTp(input: UpdateSlTpInput): Promise<AdapterResult<void>>;
}
