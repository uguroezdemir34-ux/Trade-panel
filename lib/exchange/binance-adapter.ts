/**
 * BINANCE FAPI ADAPTER — ExchangeAdapter implementasyonu.
 *
 * Tüm Binance FAPI istekleri /api/binance proxy üzerinden gider.
 * API secret asla browser'a çıkmaz.
 *
 * Önemli notlar:
 *   - Hedge mode zorunlu: Binance Futures → Settings → Position Mode → Hedge Mode
 *   - SL: STOP_MARKET, closePosition=true
 *   - TP: TAKE_PROFIT_MARKET, qty/2 her bir target için
 *   - Leverage + marginType her order öncesi set edilir (idempotent hatalar ignore)
 *
 * isPaper=true: Gerçek API çağrısı yapılmaz, fake success döner.
 *   (OKX demo mod karşılığı — Binance'in ayrı testnet key'i yok)
 */

import type {
  ExchangeAdapter,
  OpenPositionInput,
  ClosePositionInput,
  PartialCloseInput,
  UpdateSlTpInput,
  AdapterResult,
  TradeData,
} from "./types";
import { pairToSymbol } from "./binance/symbol-format";
import { useCredentialStore } from "@/lib/store/credentialStore";

// ─── Sabitler ────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;
const ORDER_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

// Binance error codes that mean "already set" — safe to ignore
const IGNORE_CODES = new Set([
  -4046, // No need to change margin type
  -4028, // Leverage not changed
]);

// ─── Client-side proxy helper ────────────────────────────────

interface ProxyCallOpts {
  path: string;
  method: "GET" | "POST" | "DELETE";
  params?: Record<string, string | number | boolean>;
  clientCreds: { key: string; secret: string } | null;
  timeoutMs: number;
  fetchFn: typeof fetch;
}

interface BinanceProxyResult {
  ok: boolean;
  data?: unknown;
  code?: number;
  msg?: string;
}

async function proxyCall(opts: ProxyCallOpts): Promise<BinanceProxyResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchFn("/api/binance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: opts.path,
        method: opts.method,
        params: opts.params ?? {},
        clientCreds: opts.clientCreds,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as BinanceProxyResult;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Retry ────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = ORDER_MAX_RETRIES,
  baseDelay = RETRY_BASE_DELAY_MS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const err = e as { name?: string };
      if (err.name === "AbortError") throw e; // timeout — no retry
      lastErr = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

// ─── Options ────────────────────────────────────────────────

export interface BinanceAdapterOptions {
  /** true → fake success, no real API calls (browser demo mode) */
  isPaper: boolean;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

// ─── Adapter ─────────────────────────────────────────────────

export class BinanceAdapter implements ExchangeAdapter {
  private readonly isPaper: boolean;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: BinanceAdapterOptions) {
    this.isPaper = opts.isPaper;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  private getClientCreds(): { key: string; secret: string } | null {
    const { bnbFutures } = useCredentialStore.getState();
    return bnbFutures ?? null;
  }

  private async call(
    path: string,
    method: "GET" | "POST" | "DELETE",
    params?: Record<string, string | number | boolean>,
  ): Promise<BinanceProxyResult> {
    return proxyCall({
      path,
      method,
      params,
      clientCreds: this.getClientCreds(),
      timeoutMs: this.timeoutMs,
      fetchFn: this.fetchFn,
    });
  }

  /** Leverage set — ignore "not changed" error */
  private async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      const r = await this.call("/fapi/v1/leverage", "POST", {
        symbol,
        leverage,
      });
      if (!r.ok && r.code && !IGNORE_CODES.has(r.code)) {
        console.warn(`[BinanceAdapter] setLeverage warn: ${r.msg}`);
      }
    } catch {
      console.warn(`[BinanceAdapter] setLeverage failed for ${symbol}`);
    }
  }

  /** Margin type set — ignore "no need to change" error */
  private async setMarginType(
    symbol: string,
    marginType: "CROSSED" | "ISOLATED",
  ): Promise<void> {
    try {
      const r = await this.call("/fapi/v1/marginType", "POST", {
        symbol,
        marginType,
      });
      if (!r.ok && r.code && !IGNORE_CODES.has(r.code)) {
        console.warn(`[BinanceAdapter] setMarginType warn: ${r.msg}`);
      }
    } catch {
      console.warn(`[BinanceAdapter] setMarginType failed for ${symbol}`);
    }
  }

  async openPosition(
    input: OpenPositionInput,
  ): Promise<AdapterResult<TradeData>> {
    if (this.isPaper) {
      return {
        ok: true,
        data: { orderId: `paper_${Date.now()}`, instId: pairToSymbol(input.pair) },
      };
    }

    const symbol = pairToSymbol(input.pair);
    const side = input.direction === "LONG" ? "BUY" : "SELL";
    const positionSide = input.direction === "LONG" ? "LONG" : "SHORT";
    const marginType = input.marginMode === "cross" ? "CROSSED" : "ISOLATED";

    // ─── Pre-order setup (best-effort) ───
    await this.setLeverage(symbol, input.leverage);
    await this.setMarginType(symbol, marginType);

    // ─── Market order ───
    let orderId = "";
    try {
      const result = await withRetry(() =>
        this.call("/fapi/v1/order", "POST", {
          symbol,
          side,
          positionSide,
          type: "MARKET",
          quantity: String(input.qty),
        }),
      );

      if (!result.ok) {
        return {
          ok: false,
          errorKind: `BNB_${result.code ?? "ERR"}`,
          errorMessage: result.msg ?? "Binance order failed",
        };
      }

      const data = result.data as Record<string, unknown>;
      orderId = String(data.orderId ?? "");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        return {
          ok: false,
          errorKind: "TIMEOUT_UNKNOWN",
          errorMessage: `Order timeout after ${this.timeoutMs}ms — do NOT retry without checking Binance order status.`,
        };
      }
      return {
        ok: false,
        errorKind: "NETWORK",
        errorMessage: err.message ?? "Network error",
      };
    }

    // ─── SL order (STOP_MARKET) ───
    if (input.slPrice && input.slPrice > 0) {
      try {
        const slSide = input.direction === "LONG" ? "SELL" : "BUY";
        await withRetry(() =>
          this.call("/fapi/v1/order", "POST", {
            symbol,
            side: slSide,
            positionSide,
            type: "STOP_MARKET",
            stopPrice: String(input.slPrice),
            closePosition: "true",
          }),
        );
      } catch {
        console.warn(`[BinanceAdapter] SL order failed for ${symbol}`);
      }
    }

    // ─── TP orders (TAKE_PROFIT_MARKET) ───
    const tpTargets: Array<{ price: number; qty: number }> = [];
    if (input.tp1Price && input.tp1Price > 0) {
      tpTargets.push({ price: input.tp1Price, qty: input.qty / 2 });
    }
    if (input.tp2Price && input.tp2Price > 0) {
      tpTargets.push({ price: input.tp2Price, qty: input.qty / 2 });
    }
    // If only one TP, use full qty
    if (tpTargets.length === 1 && input.tp1Price && input.tp1Price > 0 && !input.tp2Price) {
      tpTargets[0].qty = input.qty;
    }

    for (const tp of tpTargets) {
      try {
        const tpSide = input.direction === "LONG" ? "SELL" : "BUY";
        await withRetry(() =>
          this.call("/fapi/v1/order", "POST", {
            symbol,
            side: tpSide,
            positionSide,
            type: "TAKE_PROFIT_MARKET",
            stopPrice: String(tp.price),
            quantity: String(tp.qty),
          }),
        );
      } catch {
        console.warn(`[BinanceAdapter] TP order failed for ${symbol}`);
      }
    }

    return { ok: true, data: { orderId, instId: symbol } };
  }

  async closePosition(
    input: ClosePositionInput,
  ): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    // Extract symbol from instId (format: "BTCUSDT" or "BTCUSDT_LONG")
    const symbol = input.instId.split("_")[0];
    const side = input.posSide === "long" ? "SELL" : (input.posSide === "short" ? "BUY" : "SELL");
    const binancePosSide = input.posSide === "long" ? "LONG" : (input.posSide === "short" ? "SHORT" : "BOTH");

    try {
      const orderParams: Record<string, string | number | boolean> = {
        symbol,
        side,
        positionSide: binancePosSide,
        type: "MARKET",
      };
      // Binance docs: REDUCE_ONLY must NOT be used with positionSide in Hedge Mode
      if (binancePosSide === "BOTH") {
        orderParams.reduceOnly = "true";
      }
      const r = await withRetry(() =>
        this.call("/fapi/v1/order", "POST", orderParams),
      );
      if (!r.ok) {
        return {
          ok: false,
          errorKind: `BNB_${r.code ?? "ERR"}`,
          errorMessage: r.msg ?? "Close failed",
        };
      }
      return { ok: true };
    } catch (e) {
      const err = e as { message?: string };
      return {
        ok: false,
        errorKind: "NETWORK",
        errorMessage: err.message ?? "Network error",
      };
    }
  }

  async cancelAlgoOrders(instId: string): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    // instId format: "BTCUSDT" or "BTCUSDT_LONG"
    const symbol = instId.split("_")[0];

    try {
      const r = await this.call("/fapi/v1/allOpenOrders", "DELETE", { symbol });
      if (!r.ok && r.code && !IGNORE_CODES.has(r.code)) {
        return {
          ok: false,
          errorKind: `BNB_${r.code}`,
          errorMessage: r.msg ?? "Cancel failed",
        };
      }
      return { ok: true };
    } catch (e) {
      const err = e as { message?: string };
      return {
        ok: false,
        errorKind: "NETWORK",
        errorMessage: err.message ?? "Network error",
      };
    }
  }

  async partialClosePosition(input: PartialCloseInput): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };
    // Binance: place REDUCE_ONLY order in opposite direction
    // instId is already "BTCUSDT" format — no transformation needed
    const symbol = input.instId;
    const side = input.direction === "LONG" ? "SELL" : "BUY";
    try {
      const r = await this.call("/fapi/v1/order", "POST", {
        symbol,
        side,
        positionSide: input.direction,
        type: "MARKET",
        quantity: String(input.qty),
        reduceOnly: "true",
      });
      if (!r.ok && r.code && !IGNORE_CODES.has(r.code)) {
        return { ok: false, errorKind: `BNB_${r.code}`, errorMessage: r.msg ?? "Partial close failed" };
      }
      return { ok: true };
    } catch (e) {
      const err = e as { message?: string };
      return { ok: false, errorKind: "NETWORK", errorMessage: err.message ?? "Network error" };
    }
  }

  async updateSlTp(input: UpdateSlTpInput): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    const cancelResult = await this.cancelAlgoOrders(input.instId);
    if (!cancelResult.ok) return cancelResult;

    const symbol = input.instId.split("_")[0];
    const positionSide = input.direction === "LONG" ? "LONG" : "SHORT";
    const slSide = input.direction === "LONG" ? "SELL" : "BUY";
    const tpSide = input.direction === "LONG" ? "SELL" : "BUY";

    if (input.slPrice && input.slPrice > 0) {
      try {
        await withRetry(() =>
          this.call("/fapi/v1/order", "POST", {
            symbol,
            side: slSide,
            positionSide,
            type: "STOP_MARKET",
            stopPrice: String(input.slPrice),
            closePosition: "true",
          }),
        );
      } catch {
        console.warn(`[BinanceAdapter] SL update failed for ${symbol}`);
      }
    }

    const tpTargets: Array<{ price: number; qty: number }> = [];
    if (input.tp1Price && input.tp1Price > 0) {
      tpTargets.push({ price: input.tp1Price, qty: input.qty / 2 });
    }
    if (input.tp2Price && input.tp2Price > 0) {
      tpTargets.push({ price: input.tp2Price, qty: input.qty / 2 });
    }
    if (tpTargets.length === 1) {
      tpTargets[0].qty = input.qty;
    }

    for (const tp of tpTargets) {
      try {
        await withRetry(() =>
          this.call("/fapi/v1/order", "POST", {
            symbol,
            side: tpSide,
            positionSide,
            type: "TAKE_PROFIT_MARKET",
            stopPrice: String(tp.price),
            quantity: String(tp.qty),
          }),
        );
      } catch {
        console.warn(`[BinanceAdapter] TP update failed for ${symbol}`);
      }
    }

    return { ok: true };
  }
}

// ─── Singleton factory ────────────────────────────────────────

let _instance: BinanceAdapter | null = null;
let _instanceIsPaper: boolean | null = null;

export function getBinanceAdapter(isPaper: boolean): BinanceAdapter {
  if (_instance === null || _instanceIsPaper !== isPaper) {
    _instance = new BinanceAdapter({ isPaper });
    _instanceIsPaper = isPaper;
  }
  return _instance;
}
