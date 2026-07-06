/**
 * Live candle subscription manager for TV subscribeBars / unsubscribeBars.
 *
 * Pure JS (no React hooks) — mirrors useOkxCandleStream logic but:
 *   - keyed by TV subscriberUID instead of React state
 *   - only forwards confirm=1 (closed) candles to TV (no intra-bar flaş)
 *   - reconnects per-subscription on socket failure
 */

import type { SubscribeBarsCallback, Bar } from "./types";
import { toOkxWsChannel } from "./resolution";

const OKX_WS_URLS = [
  "wss://ws.okx.com:8443/ws/v5/public",
  "wss://wsaws.okx.com:8443/ws/v5/public",
  "wss://wsap.okx.com:8443/ws/v5/public",
] as const;

interface Subscription {
  ws: WebSocket | null;
  destroyed: boolean;
}

const subs = new Map<string, Subscription>();

function parseWsCandle(raw: unknown): { bar: Bar; confirm: boolean } | null {
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
  if (!isFinite(ts) || ts <= 0 || !isFinite(open) || open <= 0) return null;
  return {
    bar: {
      time: ts,
      open,
      high,
      low,
      close,
      volume: isFinite(volume) ? volume : 0,
    },
    confirm,
  };
}

export function subscribeToCandles(
  uid: string,
  pair: string,
  tvResolution: string,
  onBar: SubscribeBarsCallback,
): void {
  unsubscribeFromCandles(uid);

  const channel = toOkxWsChannel(tvResolution);
  if (!channel) return;

  const instId = `${pair}-USDT-SWAP`;
  const subscribeMsg = JSON.stringify({
    op: "subscribe",
    args: [{ channel, instId }],
  });

  const sub: Subscription = { ws: null, destroyed: false };
  subs.set(uid, sub);

  let urlIdx = 0;

  function openSocket(): void {
    if (sub.destroyed) return;
    const url = OKX_WS_URLS[urlIdx % OKX_WS_URLS.length];
    const ws = new WebSocket(url);
    sub.ws = ws;

    ws.onopen = () => {
      if (sub.destroyed) { ws.close(); return; }
      try { ws.send(subscribeMsg); } catch { /* ignore */ }
    };

    ws.onmessage = (ev) => {
      if (sub.destroyed) return;
      let raw: unknown;
      try { raw = JSON.parse(ev.data as string); } catch { return; }
      const parsed = parseWsCandle(raw);
      // Only forward confirmed (closed) candles — no intra-bar flicker
      if (!parsed?.confirm) return;
      onBar(parsed.bar);
    };

    ws.onerror = () => { /* always followed by onclose */ };

    ws.onclose = () => {
      if (sub.destroyed) return;
      urlIdx = (urlIdx + 1) % OKX_WS_URLS.length;
      setTimeout(openSocket, 3_000);
    };
  }

  openSocket();
}

export function unsubscribeFromCandles(uid: string): void {
  const sub = subs.get(uid);
  if (!sub) return;
  sub.destroyed = true;
  if (sub.ws) {
    sub.ws.onclose = null; // prevent reconnect loop
    try { sub.ws.close(); } catch { /* ignore */ }
    sub.ws = null;
  }
  subs.delete(uid);
}
