"use client";

/**
 * USE LIQ FEED — OKX liquidation-orders WebSocket kanalı.
 *
 * Bağımsız, hafif WS bağlantısı — ana marketStream'e dokunmaz.
 * Gerçek tasfiye event'lerini liqFeedStore'a iter.
 *
 * OKX liquidation-orders kanalı:
 *   - Public (API key gerekmez)
 *   - instType: "SWAP" → tüm perp futureslar
 *   - Max 1 güncelleme/saniye/kontrat
 *
 * Fallback: bağlantı kesilirse 10s sonra yeniden dener.
 * Store zaten events tuttuğu için kısa kesintiler sorunu değil.
 */

import { useEffect, useRef } from "react";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useLiqFeedStore } from "@/lib/store/liqFeedStore";

const WS_URLS = [
  "wss://ws.okx.com:8443/ws/v5/public",
  "wss://wsaws.okx.com:8443/ws/v5/public",
  "wss://ws.okx.com/ws/v5/public",
];

const SUBSCRIBE_MSG = JSON.stringify({
  op: "subscribe",
  args: [{ channel: "liquidation-orders", instType: "SWAP" }],
});

const RECONNECT_DELAY_MS = 10_000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

type OkxLiqDetail = {
  bkPx?: string;
  sz?: string;
  posSide?: string;
  ts?: string;
};

type OkxLiqItem = {
  instId?: string;
  details?: OkxLiqDetail[];
};

type OkxLiqMsg = {
  arg?: { channel?: string };
  data?: OkxLiqItem[];
};

export function useLiqFeed(): void {
  const push = useLiqFeedStore((s) => s.push);
  const prune = useLiqFeedStore((s) => s.prune);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destroyedRef = useRef(false);
  const urlIdxRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    destroyedRef.current = false;

    function connect(): void {
      if (destroyedRef.current) return;
      const url = WS_URLS[urlIdxRef.current % WS_URLS.length];
      urlIdxRef.current++;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        try { ws.send(SUBSCRIBE_MSG); } catch { /* ignore */ }
      };

      ws.onmessage = (ev) => {
        if (ev.data === "pong") return;
        try {
          handleMessage(JSON.parse(ev.data as string) as OkxLiqMsg);
        } catch { /* ignore malformed */ }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        wsRef.current = null;
        if (!destroyedRef.current) scheduleReconnect();
      };
    }

    function handleMessage(msg: OkxLiqMsg): void {
      if (msg?.arg?.channel !== "liquidation-orders") return;
      if (!Array.isArray(msg.data)) return;

      const now = Date.now();
      for (const item of msg.data) {
        const instId = item.instId ?? "";
        const pairStr = instId.split("-")[0];
        if (!(PAIRS as readonly string[]).includes(pairStr)) continue;
        const pair = pairStr as Pair;

        if (!Array.isArray(item.details)) continue;
        for (const d of item.details) {
          const price = parseFloat(d.bkPx ?? "");
          const size = parseFloat(d.sz ?? "");
          if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) continue;
          const ts = parseInt(d.ts ?? "0", 10) || now;
          push({
            pair,
            price,
            size,
            side: d.posSide === "short" ? "short" : "long",
            ts,
          });
        }
      }
    }

    function scheduleReconnect(): void {
      if (destroyedRef.current) return;
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    }

    connect();

    pruneTimerRef.current = setInterval(
      () => prune(Date.now()),
      PRUNE_INTERVAL_MS,
    );

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pruneTimerRef.current) clearInterval(pruneTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [push, prune]);
}
