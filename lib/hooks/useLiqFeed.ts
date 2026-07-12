"use client";

/**
 * USE LIQ FEED — OKX + Binance + Bybit liquidation feed.
 *
 * Üç borsadan gerçek tasfiye event'lerini toplar, hepsini aynı
 * liqFeedStore'a iter. Yoğunluk karşılaştırması için size USD
 * notional'a normalize edilir:
 *   OKX  : sz (kontrat) × contractSize × fiyat = notionalUsd
 *   Binance: q (base asset) × fiyat = notionalUsd
 *   Bybit  : size (base asset) × fiyat = notionalUsd
 *
 * Her borsa bağımsız bir WS manager çalıştırır — birinin kesilmesi
 * diğerlerini etkilemez. 10s yeniden bağlanma, borsaya özgü ping.
 */

import { useEffect } from "react";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useLiqFeedStore, type LiqEvent, type LiqExchange } from "@/lib/store/liqFeedStore";

// ── OKX contract sizes: 1 contract → base asset ──────────────────────────────
const OKX_CONTRACT_SIZE: Partial<Record<Pair, number>> = {
  BTC: 0.001,
  ETH: 0.01,
  SOL: 0.1,
  BNB: 0.01,
  AVAX: 0.1,
  LINK: 0.1,
  SUI: 1,
  NEAR: 1,
};

// ── Symbol → Pair maps ───────────────────────────────────────────────────────
const BINANCE_PAIR: Record<string, Pair> = {
  BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL",
  BNBUSDT: "BNB", AVAXUSDT: "AVAX",
  LINKUSDT: "LINK",
  SUIUSDT: "SUI", NEARUSDT: "NEAR",
  XRPUSDT: "XRP",
};

const BYBIT_PAIR: Record<string, Pair> = {
  BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL",
  BNBUSDT: "BNB", AVAXUSDT: "AVAX",
  LINKUSDT: "LINK",
  SUIUSDT: "SUI", NEARUSDT: "NEAR",
  XRPUSDT: "XRP",
};

// Binance / Bybit "1000X" symbols: reported size is in 1000 units
const KILO_MULTIPLIER: Record<string, number> = {};

const RECONNECT_DELAY_MS = 10_000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1_000;

// ── Exchange config ──────────────────────────────────────────────────────────

interface ExchangeConfig {
  name: LiqExchange;
  urls: string[];
  subscribe: (ws: WebSocket) => void;
  parse: (raw: string) => LiqEvent[];
  pingMsg?: string;
  pingIntervalMs?: number;
}

// ── OKX parser ───────────────────────────────────────────────────────────────

type OkxDetail = { bkPx?: string; sz?: string; posSide?: string; ts?: string };
type OkxItem   = { instId?: string; details?: OkxDetail[] };
type OkxMsg    = { arg?: { channel?: string }; data?: OkxItem[] };

function parseOkx(raw: string): LiqEvent[] {
  if (raw === "pong") return [];
  let msg: OkxMsg;
  try { msg = JSON.parse(raw) as OkxMsg; } catch { return []; }
  if (msg?.arg?.channel !== "liquidation-orders") return [];
  if (!Array.isArray(msg.data)) return [];

  const now = Date.now();
  const out: LiqEvent[] = [];
  for (const item of msg.data) {
    const pairStr = (item.instId ?? "").split("-")[0];
    if (!(PAIRS as readonly string[]).includes(pairStr)) continue;
    const pair = pairStr as Pair;
    if (!Array.isArray(item.details)) continue;
    for (const d of item.details) {
      const price = parseFloat(d.bkPx ?? "");
      const szContracts = parseFloat(d.sz ?? "");
      if (!isFinite(price) || !isFinite(szContracts) || price <= 0 || szContracts <= 0) continue;
      const notionalUsd = price * szContracts * (OKX_CONTRACT_SIZE[pair] ?? 1);
      out.push({
        pair,
        price,
        notionalUsd,
        side: d.posSide === "short" ? "short" : "long",
        ts: parseInt(d.ts ?? "0", 10) || now,
        exchange: "okx",
      });
    }
  }
  return out;
}

const OKX_CONFIG: ExchangeConfig = {
  name: "okx",
  urls: [
    "wss://ws.okx.com:8443/ws/v5/public",
    "wss://wsaws.okx.com:8443/ws/v5/public",
    "wss://ws.okx.com/ws/v5/public",
  ],
  subscribe: (ws) => ws.send(JSON.stringify({
    op: "subscribe",
    args: [{ channel: "liquidation-orders", instType: "SWAP" }],
  })),
  parse: parseOkx,
  pingMsg: "ping",
  pingIntervalMs: 25_000,
};

// ── Binance parser ───────────────────────────────────────────────────────────

type BinanceMsg = {
  e?: string;
  o?: { s?: string; S?: string; q?: string; ap?: string; T?: number };
};

function parseBinance(raw: string): LiqEvent[] {
  let msg: BinanceMsg;
  try { msg = JSON.parse(raw) as BinanceMsg; } catch { return []; }
  if (msg?.e !== "forceOrder" || !msg.o) return [];
  const o = msg.o;
  const symbol = o.s ?? "";
  const pair = BINANCE_PAIR[symbol];
  if (!pair) return [];
  const price = parseFloat(o.ap ?? "");
  const base = parseFloat(o.q ?? "") * (KILO_MULTIPLIER[symbol] ?? 1);
  if (!isFinite(price) || !isFinite(base) || price <= 0 || base <= 0) return [];
  return [{
    pair,
    price,
    notionalUsd: price * base,
    // Binance: S="SELL" = long forced-sold = long was liquidated
    side: o.S === "SELL" ? "long" : "short",
    ts: o.T ?? Date.now(),
    exchange: "binance",
  }];
}

const BINANCE_CONFIG: ExchangeConfig = {
  name: "binance",
  urls: [
    "wss://fstream.binance.com/ws/!forceOrder@arr",
    "wss://fstream1.binance.com/ws/!forceOrder@arr",
  ],
  subscribe: () => { /* stream starts on connect, no subscribe msg needed */ },
  parse: parseBinance,
};

// ── Bybit parser ─────────────────────────────────────────────────────────────

type BybitMsg = {
  topic?: string;
  data?: { symbol?: string; side?: string; size?: string; price?: string; updatedTime?: number };
};

function parseBybit(raw: string): LiqEvent[] {
  let msg: BybitMsg;
  try { msg = JSON.parse(raw) as BybitMsg; } catch { return []; }
  if (!msg.topic?.startsWith("liquidation.") || !msg.data) return [];
  const d = msg.data;
  const symbol = d.symbol ?? "";
  const pair = BYBIT_PAIR[symbol];
  if (!pair) return [];
  const price = parseFloat(d.price ?? "");
  const base = parseFloat(d.size ?? "") * (KILO_MULTIPLIER[symbol] ?? 1);
  if (!isFinite(price) || !isFinite(base) || price <= 0 || base <= 0) return [];
  return [{
    pair,
    price,
    notionalUsd: price * base,
    // Bybit: side="Sell" = long forced-sold = long was liquidated
    side: d.side === "Sell" ? "long" : "short",
    ts: d.updatedTime ?? Date.now(),
    exchange: "bybit",
  }];
}

const BYBIT_SYMBOLS = [
  "BTCUSDT","ETHUSDT","XRPUSDT","SOLUSDT","BNBUSDT",
  "ADAUSDT","AVAXUSDT","DOTUSDT","LINKUSDT","POLUSDT",
  "DOGEUSDT","1000SHIBUSDT","SUIUSDT","NEARUSDT","TRXUSDT",
  "APTUSDT","TAOUSDT","PENDLEUSDT","OPUSDT","WIFUSDT",
];

const BYBIT_CONFIG: ExchangeConfig = {
  name: "bybit",
  urls: [
    "wss://stream.bybit.com/v5/public/linear",
    "wss://stream.bytick.com/v5/public/linear",
  ],
  subscribe: (ws) => ws.send(JSON.stringify({
    op: "subscribe",
    args: BYBIT_SYMBOLS.map((s) => `liquidation.${s}`),
  })),
  parse: parseBybit,
  pingMsg: '{"op":"ping"}',
  pingIntervalMs: 20_000,
};

// ── WS manager factory ───────────────────────────────────────────────────────

function createWsManager(
  config: ExchangeConfig,
  push: (e: LiqEvent) => void,
  setConn: (exchange: LiqExchange, status: import("@/lib/store/liqFeedStore").LiqConnStatus) => void,
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let urlIdx = 0;

  function connect(): void {
    if (destroyed) return;
    setConn(config.name, "connecting");
    const url = config.urls[urlIdx % config.urls.length];
    urlIdx++;
    try { ws = new WebSocket(url); } catch { setConn(config.name, "disconnected"); scheduleReconnect(); return; }

    ws.onopen = () => {
      setConn(config.name, "connected");
      try { config.subscribe(ws!); } catch { /* ignore */ }
      if (config.pingMsg && config.pingIntervalMs) {
        pingTimer = setInterval(() => {
          try { ws?.send(config.pingMsg!); } catch { /* ignore */ }
        }, config.pingIntervalMs);
      }
    };

    ws.onmessage = (ev) => {
      const events = config.parse(ev.data as string);
      for (const e of events) push(e);
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      ws = null;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (!destroyed) {
        setConn(config.name, "disconnected");
        scheduleReconnect();
      }
    };
  }

  function scheduleReconnect(): void {
    if (destroyed) return;
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    if (ws) {
      ws.onclose = null;
      try { ws.close(); } catch { /* ignore */ }
      ws = null;
    }
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLiqFeed(): void {
  const push = useLiqFeedStore((s) => s.push);
  const prune = useLiqFeedStore((s) => s.prune);
  const setConn = useLiqFeedStore((s) => s.setConn);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cleanupOkx     = createWsManager(OKX_CONFIG,     push, setConn);
    const cleanupBinance = createWsManager(BINANCE_CONFIG,  push, setConn);
    const cleanupBybit   = createWsManager(BYBIT_CONFIG,    push, setConn);

    const pruneTimer = setInterval(() => prune(Date.now()), PRUNE_INTERVAL_MS);

    return () => {
      cleanupOkx();
      cleanupBinance();
      cleanupBybit();
      clearInterval(pruneTimer);
    };
  // Zustand actions are stable refs — no dep change expected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
