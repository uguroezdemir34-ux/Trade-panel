/**
 * BYBIT V5 ADAPTER — ExchangeAdapter implementasyonu.
 *
 * Tüm Bybit V5 istekleri /api/bybit proxy üzerinden gider.
 * API secret asla browser'a çıkmaz.
 *
 * Önemli notlar:
 *   - Hedge mode (PositionIdx=1/2) zorunlu
 *   - SL: position-level set-tpsl endpoint'i
 *   - TP: trigger order, reduceOnly=true
 *   - isPaper=true: Gerçek API çağrısı yapılmaz, fake success döner
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
import { pairToSymbol } from "./bybit/symbol-format";
import { useCredentialStore } from "@/lib/store/credentialStore";

// ─── Sabitler ────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;
const ORDER_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

// ─── Proxy helper ─────────────────────────────────────────────

interface BybitProxyResult {
  ok: boolean;
  data?: unknown;
  retCode?: number;
  retMsg?: string;
}

interface ProxyCallOpts {
  path: string;
  method: "GET" | "POST";
  params?: Record<string, string | number | boolean>;
  clientCreds: { key: string; secret: string } | null;
  timeoutMs: number;
  fetchFn: typeof fetch;
}

async function proxyCall(opts: ProxyCallOpts): Promise<BybitProxyResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchFn("/api/bybit", {
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
    return (await res.json()) as BybitProxyResult;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Retry ───────────────────────────────────────────────────

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
      if (err.name === "AbortError") throw e;
      lastErr = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

// ─── Options ─────────────────────────────────────────────────

export interface BybitAdapterOptions {
  isPaper: boolean;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

// ─── positionIdx helpers ──────────────────────────────────────

/** Hedge mode: LONG → 1, SHORT → 2 */
function directionToPositionIdx(direction: "LONG" | "SHORT"): 1 | 2 {
  return direction === "LONG" ? 1 : 2;
}

/** posSide string → positionIdx: "long" → 1, "short" → 2, undefined → 0 (one-way) */
function posSideToPositionIdx(posSide: "long" | "short" | undefined): 0 | 1 | 2 {
  if (posSide === "long") return 1;
  if (posSide === "short") return 2;
  return 0;
}

// ─── Adapter ─────────────────────────────────────────────────

export class BybitAdapter implements ExchangeAdapter {
  private readonly isPaper: boolean;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: BybitAdapterOptions) {
    this.isPaper = opts.isPaper;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  private getClientCreds(): { key: string; secret: string } | null {
    const { bybitFutures } = useCredentialStore.getState();
    return bybitFutures ?? null;
  }

  private async call(
    path: string,
    method: "GET" | "POST",
    params?: Record<string, string | number | boolean>,
  ): Promise<BybitProxyResult> {
    return proxyCall({
      path,
      method,
      params,
      clientCreds: this.getClientCreds(),
      timeoutMs: this.timeoutMs,
      fetchFn: this.fetchFn,
    });
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
    const side = input.direction === "LONG" ? "Buy" : "Sell";
    const positionIdx = directionToPositionIdx(input.direction);

    // ─── Market entry order ───
    let orderId = "";
    try {
      const result = await withRetry(() =>
        this.call("/v5/order/create", "POST", {
          category: "linear",
          symbol,
          side,
          orderType: "Market",
          qty: String(input.qty),
          positionIdx,
          timeInForce: "GTC",
        }),
      );

      if (!result.ok) {
        return {
          ok: false,
          errorKind: `BYBIT_${result.retCode ?? "ERR"}`,
          errorMessage: result.retMsg ?? "Bybit order failed",
        };
      }

      const data = result.data as Record<string, unknown> | undefined;
      orderId = String((data as Record<string, unknown> | undefined)?.orderId ?? "");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        return {
          ok: false,
          errorKind: "TIMEOUT_UNKNOWN",
          errorMessage: `Order timeout after ${this.timeoutMs}ms — do NOT retry without checking Bybit order status.`,
        };
      }
      return {
        ok: false,
        errorKind: "NETWORK",
        errorMessage: err.message ?? "Network error",
      };
    }

    // ─── Position-level SL ───
    if (input.slPrice && input.slPrice > 0) {
      try {
        await withRetry(() =>
          this.call("/v5/position/set-tpsl", "POST", {
            category: "linear",
            symbol,
            positionIdx,
            stopLoss: String(input.slPrice),
            slTriggerBy: "LastPrice",
          }),
        );
      } catch {
        console.warn(`[BybitAdapter] SL set-tpsl failed for ${symbol}`);
      }
    }

    // ─── TP trigger orders ───
    const tpTargets: Array<{ price: number; qty: number }> = [];
    if (input.tp1Price && input.tp1Price > 0) {
      tpTargets.push({ price: input.tp1Price, qty: input.qty / 2 });
    }
    if (input.tp2Price && input.tp2Price > 0) {
      tpTargets.push({ price: input.tp2Price, qty: input.qty / 2 });
    }
    // Single TP → full qty
    if (tpTargets.length === 1) {
      tpTargets[0].qty = input.qty;
    }

    // LONG TP triggers when price rises to target (triggerDirection=1)
    // SHORT TP triggers when price falls to target (triggerDirection=2)
    const triggerDirection = input.direction === "LONG" ? 1 : 2;
    const tpSide = input.direction === "LONG" ? "Sell" : "Buy";

    for (const tp of tpTargets) {
      try {
        await withRetry(() =>
          this.call("/v5/order/create", "POST", {
            category: "linear",
            symbol,
            side: tpSide,
            orderType: "Market",
            qty: String(tp.qty),
            positionIdx,
            triggerPrice: String(tp.price),
            triggerDirection,
            triggerBy: "LastPrice",
            reduceOnly: true,
            timeInForce: "GTC",
          }),
        );
      } catch {
        console.warn(`[BybitAdapter] TP trigger order failed for ${symbol}`);
      }
    }

    return { ok: true, data: { orderId, instId: symbol } };
  }

  async closePosition(
    input: ClosePositionInput,
  ): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    // instId for Bybit is already "BTCUSDT"
    const symbol = input.instId;
    const positionIdx = posSideToPositionIdx(input.posSide);
    // Closing a LONG requires a Sell order; closing a SHORT requires a Buy order
    const side = input.posSide === "short" ? "Buy" : "Sell";

    try {
      const r = await withRetry(() =>
        this.call("/v5/order/create", "POST", {
          category: "linear",
          symbol,
          side,
          orderType: "Market",
          qty: "0",
          positionIdx,
          reduceOnly: true,
          timeInForce: "GTC",
        }),
      );
      if (!r.ok) {
        return {
          ok: false,
          errorKind: `BYBIT_${r.retCode ?? "ERR"}`,
          errorMessage: r.retMsg ?? "Close failed",
        };
      }
      return { ok: true };
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") {
        return {
          ok: false,
          errorKind: "TIMEOUT_UNKNOWN",
          errorMessage: `closePosition timeout after ${this.timeoutMs}ms`,
        };
      }
      return {
        ok: false,
        errorKind: "NETWORK",
        errorMessage: err.message ?? "Network error",
      };
    }
  }

  async cancelAlgoOrders(instId: string): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    try {
      const r = await this.call("/v5/order/cancel-all", "POST", {
        category: "linear",
        symbol: instId,
      });
      if (!r.ok) {
        return {
          ok: false,
          errorKind: `BYBIT_${r.retCode ?? "ERR"}`,
          errorMessage: r.retMsg ?? "Cancel failed",
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

  async partialClosePosition(
    input: PartialCloseInput,
  ): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    const symbol = input.instId;
    const positionIdx = directionToPositionIdx(input.direction);
    const side = input.direction === "LONG" ? "Sell" : "Buy";

    try {
      const r = await withRetry(() =>
        this.call("/v5/order/create", "POST", {
          category: "linear",
          symbol,
          side,
          orderType: "Market",
          qty: String(input.qty),
          positionIdx,
          reduceOnly: true,
          timeInForce: "GTC",
        }),
      );
      if (!r.ok) {
        return {
          ok: false,
          errorKind: `BYBIT_${r.retCode ?? "ERR"}`,
          errorMessage: r.retMsg ?? "Partial close failed",
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

  async updateSlTp(input: UpdateSlTpInput): Promise<AdapterResult<void>> {
    if (this.isPaper) return { ok: true };

    const cancelResult = await this.cancelAlgoOrders(input.instId);
    if (!cancelResult.ok) return cancelResult;

    const positionIdx = directionToPositionIdx(input.direction);
    const tpSide = input.direction === "LONG" ? "Sell" : "Buy";
    const triggerDirection = input.direction === "LONG" ? 1 : 2;

    // Re-set position-level SL
    if (input.slPrice && input.slPrice > 0) {
      try {
        await withRetry(() =>
          this.call("/v5/position/set-tpsl", "POST", {
            category: "linear",
            symbol: input.instId,
            positionIdx,
            stopLoss: String(input.slPrice),
            slTriggerBy: "LastPrice",
          }),
        );
      } catch {
        console.warn(`[BybitAdapter] SL update failed for ${input.instId}`);
      }
    }

    // Re-place TP trigger orders
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
          this.call("/v5/order/create", "POST", {
            category: "linear",
            symbol: input.instId,
            side: tpSide,
            orderType: "Market",
            qty: String(tp.qty),
            positionIdx,
            triggerPrice: String(tp.price),
            triggerDirection,
            triggerBy: "LastPrice",
            reduceOnly: true,
            timeInForce: "GTC",
          }),
        );
      } catch {
        console.warn(`[BybitAdapter] TP update failed for ${input.instId}`);
      }
    }

    return { ok: true };
  }
}

// ─── Singleton factory ────────────────────────────────────────

let _instance: BybitAdapter | null = null;
let _instanceIsPaper: boolean | null = null;

export function getBybitAdapter(isPaper: boolean): BybitAdapter {
  if (_instance === null || _instanceIsPaper !== isPaper) {
    _instance = new BybitAdapter({ isPaper });
    _instanceIsPaper = isPaper;
  }
  return _instance;
}
