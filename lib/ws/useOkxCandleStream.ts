"use client";

/**
 * OKX CANDLE STREAM — Live candle WebSocket for the grafik page.
 *
 * Opens a dedicated OKX public WS connection and subscribes to the
 * candle<bar> channel for the active pair+timeframe. On each message:
 *   - confirm="0" → update last candle in-place (forming)
 *   - confirm="1" → mark as closed; next message opens a new candle
 *
 * RAF throttle: at most one store update per animation frame (~16ms).
 * This prevents excessive re-renders when OKX sends rapid candle ticks.
 *
 * On pair/TF change: old socket is torn down, new one opens automatically.
 * If WS fails, the existing REST poller (useCandlePoller) keeps data fresh.
 *
 * OKX candle channel naming (from OKX WS API docs):
 *   1d → "candle1D", 4h → "candle4H", 1h → "candle1H",
 *   15m → "candle15m", 5m → "candle5m"
 */

import { useEffect, useRef } from "react";
import type { Pair } from "@/lib/constants/pairs";
import type { Candle, Timeframe } from "@/lib/okx/candles";
import { useCandleStore } from "@/lib/store/candleStore";

// OKX public WS endpoints (same rotation as urls.ts tickers, but separate connection)
const OKX_WS_URLS = [
  "wss://ws.okx.com:8443/ws/v5/public",
  "wss://wsaws.okx.com:8443/ws/v5/public",
  "wss://wsap.okx.com:8443/ws/v5/public",
] as const;

function okxBar(tf: Timeframe): string {
  switch (tf) {
    case "1d": return "candle1D";
    case "4h": return "candle4H";
    case "1h": return "candle1H";
    case "15m": return "candle15m";
    case "5m": return "candle5m";
    case "1m": return "candle1m";
  }
}

/**
 * Parse a single OKX candle WS message.
 * Expected format:
 *   { arg: { channel: "candle1H", instId: "BTC-USDT-SWAP" },
 *     data: [["ts","o","h","l","c","vol","volCcy","volCcyQuote","confirm"]] }
 */
function parseCandleWsMsg(raw: unknown): Candle | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  if (!Array.isArray(msg.data) || msg.data.length === 0) return null;
  const row = msg.data[0];
  if (!Array.isArray(row) || row.length < 9) return null;
  const ts     = parseInt(String(row[0]), 10);
  const open   = parseFloat(String(row[1]));
  const high   = parseFloat(String(row[2]));
  const low    = parseFloat(String(row[3]));
  const close  = parseFloat(String(row[4]));
  const volume = parseFloat(String(row[5]));
  const confirm = String(row[8]) === "1";
  if (
    !isFinite(ts) || ts <= 0 ||
    !isFinite(open) || !isFinite(high) ||
    !isFinite(low) || !isFinite(close) ||
    open <= 0 || high <= 0 || low <= 0 || close <= 0
  ) return null;
  return { ts, open, high, low, close, volume: isFinite(volume) ? volume : 0, confirm };
}

export function useOkxCandleStream(pair: Pair, tf: Timeframe): void {
  const wsRef    = useRef<WebSocket | null>(null);
  const rafRef   = useRef<number>(0);
  const pendingRef = useRef<Candle | null>(null);
  const urlIdxRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let destroyed = false;
    const bar = okxBar(tf);
    const instId = `${pair}-USDT-SWAP`;
    const subscribeMsg = JSON.stringify({
      op: "subscribe",
      args: [{ channel: bar, instId }],
    });

    function openSocket(): void {
      if (destroyed) return;
      const url = OKX_WS_URLS[urlIdxRef.current % OKX_WS_URLS.length];
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        try { ws.send(subscribeMsg); } catch { /* ignore */ }
      };

      ws.onmessage = (ev) => {
        if (destroyed) return;
        let raw: unknown;
        try { raw = JSON.parse(ev.data as string); } catch { return; }
        const candle = parseCandleWsMsg(raw);
        if (!candle) return;

        // Buffer the latest update; flush on next animation frame
        pendingRef.current = candle;
        if (rafRef.current === 0) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            const c = pendingRef.current;
            pendingRef.current = null;
            if (c && !destroyed) {
              useCandleStore.getState().updateLastCandle(pair, tf, c);
            }
          });
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose; no action needed here
      };

      ws.onclose = () => {
        if (destroyed) return;
        // Rotate to next endpoint on failure
        urlIdxRef.current = (urlIdxRef.current + 1) % OKX_WS_URLS.length;
        // Reconnect after 3s
        setTimeout(openSocket, 3_000);
      };
    }

    openSocket();

    return () => {
      destroyed = true;
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      pendingRef.current = null;
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect loop
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [pair, tf]);
}
