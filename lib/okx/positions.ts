/**
 * OKX POSITIONS — Açık pozisyon fetch + parse.
 *
 * `/api/v5/account/positions` (private endpoint, auth gerekli).
 * Response: { code, data: [{ instId, pos, posSide, avgPx, markPx, upl, lever, ... }] }
 *
 * TP/SL NOT: OKX positions endpoint TP/SL fiyatlarını döndürmez.
 * Bunlar /api/v5/trade/orders-algo-pending altında conditional/oco emirler
 * olarak tutulur. fetchPositions() her çağrıda bunları da çekip
 * instId bazında eşleştirir.
 *
 * Sadece BTC + ETH SWAP pozisyonları döner (v2 strategy).
 */

import { z } from "zod";
import type { Pair } from "@/lib/constants/pairs";
import { PAIRS } from "@/lib/constants/pairs";
import type { FetchFn } from "./candles";
import { ensureCtValMap, getRealSize } from "./contractSize";

/** Tek bir açık pozisyon (parse edilmiş hali) */
export interface Position {
  /** "BTC-USDT-SWAP" */
  instId: string;
  /** "BTC" | "ETH" */
  pair: Pair;
  /** "long" | "short" | "net" */
  posSide: "long" | "short" | "net";
  /** Yön (sayısal pos > 0 LONG, < 0 SHORT, net=0 NEUTRAL) */
  direction: "LONG" | "SHORT" | "NEUTRAL";
  /** Pozisyon boyutu (coin cinsi, mutlak değer) */
  size: number;
  /** Giriş ortalama fiyat */
  entryPx: number;
  /** Mark fiyatı (UPL hesabı için) */
  markPx: number;
  /** Unrealized P&L (USDT) */
  upl: number;
  /** ROE % (OKX'in dönüşü) */
  uplRatio: number;
  /** Kaldıraç */
  leverage: number;
  /** Margin mode */
  mgnMode: "cross" | "isolated";
  /** Notional (USDT) */
  notional: number;
  /** Liquidation fiyatı (varsa) */
  liqPx: number | null;
  /** Stop Loss trigger (algo order'dan merge edilebilir, başta yok) */
  slTriggerPx: number | null;
  /** Take Profit trigger */
  tpTriggerPx: number | null;
  /** Pozisyon açılış zamanı */
  cTime: number;
  /** Kaynak borsa — grafik etiketi ve UI ayırımı için */
  source: "okx" | "binance" | "bybit" | "gateio" | "kucoin" | "mexc" | "kraken";
}

const positionRowSchema = z.object({
  instId: z.string(),
  posSide: z.string(),
  pos: z.string(),
  avgPx: z.string(),
  markPx: z.string().optional(),
  upl: z.string().optional(),
  uplRatio: z.string().optional(),
  lever: z.string().optional(),
  mgnMode: z.string().optional(),
  notionalUsd: z.string().optional(),
  liqPx: z.string().optional(),
  slTriggerPx: z.string().optional(),
  tpTriggerPx: z.string().optional(),
  cTime: z.string().optional(),
});

const positionResponseSchema = z.object({
  code: z.string(),
  data: z.array(positionRowSchema).optional(),
  msg: z.string().optional(),
});

/** Helper — string → number, geçersiz değerde fallback */
function num(s: string | undefined, fallback = 0): number {
  if (!s) return fallback;
  const n = parseFloat(s);
  return isFinite(n) ? n : fallback;
}

/** posSide + pos signal'inden yön çıkar */
function deriveDirection(
  posSide: string,
  posValue: number,
): "LONG" | "SHORT" | "NEUTRAL" {
  if (posSide === "long") return "LONG";
  if (posSide === "short") return "SHORT";
  // net mode (one-way)
  if (posValue > 0) return "LONG";
  if (posValue < 0) return "SHORT";
  return "NEUTRAL";
}

/** instId → Pair (sadece desteklenenler) */
function extractPair(instId: string): Pair | null {
  const sym = instId.split("-")[0];
  if (PAIRS.includes(sym as Pair)) return sym as Pair;
  return null;
}

/** Tek pozisyon row'unu parse et */
function parsePositionRow(
  raw: z.infer<typeof positionRowSchema>,
  ctValMap: Record<string, number>,
): Position | null {
  const pair = extractPair(raw.instId);
  if (!pair) return null;

  const posValue = num(raw.pos);
  if (posValue === 0) return null; // Boş pozisyon (kapanmış)

  // OKX'in `pos` alanı SWAP için KONTRAT ADEDİ — gerçek coin miktarı
  // ctVal ile çarpılarak elde edilir (bkz. lib/okx/contractSize.ts).
  const size = getRealSize(Math.abs(posValue), raw.instId, ctValMap);
  const entryPx = num(raw.avgPx);
  if (entryPx <= 0) return null;

  const posSide = (raw.posSide as Position["posSide"]) ?? "net";
  const validPosSide: Position["posSide"] =
    posSide === "long" || posSide === "short" ? posSide : "net";

  const mgnMode = (raw.mgnMode as Position["mgnMode"]) ?? "cross";
  const validMgnMode: Position["mgnMode"] =
    mgnMode === "isolated" ? "isolated" : "cross";

  const markPx = num(raw.markPx, entryPx);
  const notional = num(raw.notionalUsd, size * markPx);

  return {
    instId: raw.instId,
    pair,
    posSide: validPosSide,
    direction: deriveDirection(validPosSide, posValue),
    size,
    entryPx,
    markPx,
    upl: num(raw.upl),
    uplRatio: num(raw.uplRatio),
    leverage: num(raw.lever, 1),
    mgnMode: validMgnMode,
    notional,
    liqPx: raw.liqPx && num(raw.liqPx) > 0 ? num(raw.liqPx) : null,
    slTriggerPx: raw.slTriggerPx && num(raw.slTriggerPx) > 0 ? num(raw.slTriggerPx) : null,
    tpTriggerPx: raw.tpTriggerPx && num(raw.tpTriggerPx) > 0 ? num(raw.tpTriggerPx) : null,
    cTime: num(raw.cTime, Date.now()),
    source: "okx",
  };
}

/**
 * Raw OKX response → Position[]
 * Boş pozisyonları, geçersiz veya desteklenmeyen pair'leri eler.
 *
 * @param ctValMap instId → ctVal haritası (bkz. lib/okx/contractSize.ts).
 *   Verilmezse boş obje varsayılır — getRealSize() bu durumda size'ı
 *   ölçeklendirmeden (eski, buggy davranışla aynı) döner; bu sadece
 *   ctValMap sağlanamayan çağrı yerleri (ör. testler) için güvenli bir
 *   varsayılan, gerçek üretim yolu (fetchPositions) her zaman doldurulmuş
 *   bir harita geçirir.
 */
export function parsePositionResponse(
  raw: unknown,
  ctValMap: Record<string, number> = {},
): Position[] | null {
  const r = positionResponseSchema.safeParse(raw);
  if (!r.success) return null;
  if (r.data.code !== "0") return null;
  if (!r.data.data) return [];

  const positions: Position[] = [];
  for (const row of r.data.data) {
    const p = parsePositionRow(row, ctValMap);
    if (p) positions.push(p);
  }
  return positions;
}

// ─── Algo Orders (TP/SL) ─────────────────────────────────────────────────────

/** instId → { tp, sl } haritası — algo-pending emirlerden */
type AlgoMap = Record<string, { tp: number | null; sl: number | null }>;

const algoRowSchema = z.object({
  instId: z.string(),
  tpTriggerPx: z.string().optional(),
  slTriggerPx: z.string().optional(),
});

const algoResponseSchema = z.object({
  code: z.string(),
  data: z.array(algoRowSchema).optional(),
});

/** string → pozitif sayı veya null */
function pxOrNull(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

/**
 * OKX conditional/oco algo emirlerini çek, instId başına { tp, sl } haritasına çevir.
 * Hata durumunda boş harita döner — pozisyon çağrısı bundan etkilenmez.
 */
async function fetchAlgoMap(
  clientCreds?: { key: string; secret: string; pass: string } | null,
): Promise<AlgoMap> {
  const map: AlgoMap = {};
  const ordTypes = ["conditional", "oco"] as const;

  async function fetchOneType(ordType: string): Promise<void> {
    // instType=SWAP zorunlu — OKX dokümantasyonu: ordType=conditional|oco için
    // instType veya instId gerekir, aksi halde boş array döner.
    const path = `/api/okx/api/v5/trade/orders-algo-pending?ordType=${ordType}&instType=SWAP`;
    try {
      let res: Response;
      if (clientCreds?.key) {
        res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDemo: false, clientCreds }),
        });
      } else {
        res = await fetch(path);
      }
      if (!res.ok) return;
      const raw = await res.json() as unknown;

      // Proxy wraps in { ok, data } — unwrap if needed
      let envelope: unknown = raw;
      if (raw && typeof raw === "object" && "ok" in raw) {
        const r = raw as { ok: boolean; data?: unknown };
        if (!r.ok) return;
        envelope = { code: "0", data: r.data };
      }

      const parsed = algoResponseSchema.safeParse(envelope);
      if (!parsed.success || parsed.data.code !== "0") return;

      for (const row of parsed.data.data ?? []) {
        const existing = map[row.instId] ?? { tp: null, sl: null };
        map[row.instId] = {
          tp: existing.tp ?? pxOrNull(row.tpTriggerPx),
          sl: existing.sl ?? pxOrNull(row.slTriggerPx),
        };
      }
    } catch {
      // Algo fetch failure is non-fatal — TP/SL will show "—"
    }
  }

  await Promise.all(ordTypes.map(fetchOneType));
  return map;
}

/**
 * Açık pozisyonları çek.
 *
 * @param clientCreds Browser-stored OKX credentials (Layer 2 fallback)
 * @param fetchFn HTTP fetch (default global)
 */
export async function fetchPositions(
  isDemo: boolean,
  clientCreds?: { key: string; secret: string; pass: string } | null,
  fetchFn?: FetchFn,
): Promise<Position[] | null> {
  const fn = fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  const url = "/api/okx/api/v5/account/positions";
  try {
    // Kontrat büyüklüğü haritası — pozisyon isteğiyle paralel (bağımsız,
    // ayrı bir public endpoint), 6 saatlik TTL cache sayesinde çoğu poll
    // cycle'ında zaten network'e hiç çıkmıyor (bkz. contractSize.ts).
    const ctValMapPromise = ensureCtValMap();

    let res: { ok: boolean; json: () => Promise<unknown> };
    if (clientCreds?.key) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo, clientCreds }),
      });
    } else {
      // fetchBalanceDetailed'daki (lib/okx/balance.ts) aynı X-OKX-Mode
      // deseni — bug taramasında bulundu: bu fonksiyon isDemo'yu hiç kabul
      // etmiyordu, POST dalı sabit `false` gönderiyordu, GET dalında hiç
      // header yoktu — demoMode açıkken bile pozisyonlar hep prod hesabından
      // çekiliyordu (bkz. lib/hooks/usePositionPoller.ts).
      res = await fn(url, { headers: { "X-OKX-Mode": isDemo ? "demo" : "prod" } });
    }
    if (!res.ok) return null;
    const raw = await res.json() as Record<string, unknown>;
    if (!raw || typeof raw !== "object") return null;

    const ctValMap = await ctValMapPromise;

    let positions: Position[] | null = null;
    // Proxy response: { ok: boolean, data: [...positions] }
    if (typeof raw.ok === "boolean") {
      if (!raw.ok) return null;
      positions = parsePositionResponse({ code: "0", data: raw.data }, ctValMap);
    } else if (typeof raw.code === "string") {
      // Direct OKX envelope passthrough
      positions = parsePositionResponse(raw, ctValMap);
    }

    if (!positions || positions.length === 0) return positions;

    // Algo emirlerden TP/SL eşleştir (hata olursa positions değişmez)
    const algoMap = await fetchAlgoMap(clientCreds).catch(() => ({} as AlgoMap));
    return positions.map((pos) => {
      const algo = algoMap[pos.instId];
      if (!algo) return pos;
      return {
        ...pos,
        tpTriggerPx: pos.tpTriggerPx ?? algo.tp,
        slTriggerPx: pos.slTriggerPx ?? algo.sl,
      };
    });
  } catch {
    return null;
  }
}
