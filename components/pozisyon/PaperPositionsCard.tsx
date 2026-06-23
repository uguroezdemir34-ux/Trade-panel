"use client";

import { useMemo } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import type { TradeSnapshot } from "@/lib/trades/types";
import { formatTickPrice } from "@/lib/i18n/format";

function fmtHolding(openedAt: number): string {
  const ms = Date.now() - openedAt;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}s`;
  if (h > 0)   return `${h}s ${m}dk`;
  return `${m}dk`;
}

// ─── Live UPL hesabı (linear USDT-margined) ──────────────────────────────────

function calcLiveUpl(
  trade: TradeSnapshot,
  currentPx: number,
): { upl: number; roe: number } {
  const { entryPrice, qty, leverage, direction } = trade;
  if (!currentPx || currentPx <= 0 || !entryPrice || entryPrice <= 0 || !qty) {
    return { upl: 0, roe: 0 };
  }
  const diff = direction === "LONG"
    ? currentPx - entryPrice
    : entryPrice - currentPx;
  const upl = diff * qty;
  const margin = (entryPrice * qty) / leverage;
  const roe = margin > 0 ? (upl / margin) * 100 : 0;
  return { upl, roe };
}

// ─── Single row ───────────────────────────────────────────────────────────────

function PaperRow({ trade }: { trade: TradeSnapshot }): React.ReactElement {
  const currentPx = useMarketStore((s) => s.prices[trade.pair]?.last ?? 0);
  const { upl, roe } = calcLiveUpl(trade, currentPx);

  const isLong     = trade.direction === "LONG";
  const uplColor   = upl > 0 ? "text-green-400" : upl < 0 ? "text-red-400" : "text-text-t3";
  const dirColor   = isLong ? "text-green-400" : "text-red-400";
  const dirBg      = isLong
    ? "border-green-500/30 bg-green-500/8"
    : "border-red-500/30 bg-red-500/8";

  const slDist = currentPx > 0 && trade.stopPrice > 0
    ? Math.abs((currentPx - trade.stopPrice) / currentPx) * 100
    : null;
  const slNear = slDist !== null && slDist < 5;

  return (
    <div className="border border-border/50 rounded-lg bg-bg-card p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-text-t1">{trade.pair}</span>
          <span className={`rounded border px-1.5 py-0.5 font-mono text-2xs font-bold tracking-widest ${dirColor} ${dirBg}`}>
            {isLong ? "▲ LONG" : "▼ SHORT"}
          </span>
          <span className="font-mono text-2xs text-text-t4 border border-border/40 rounded px-1 py-0.5">
            {trade.leverage}x
          </span>
          {trade.entryContext?.score !== undefined && (
            <span className="font-mono text-2xs text-text-t4 bg-surface-s1 rounded px-1.5 py-0.5">
              {trade.entryContext.score}
            </span>
          )}
        </div>
        <span className="font-mono text-2xs text-text-t4">{fmtHolding(trade.openedAt)}</span>
      </div>

      {/* UPL + ROE */}
      <div className="flex items-baseline gap-3">
        <span translate="no" className={`font-mono text-lg font-bold tabular-nums ${uplColor}`}>
          {upl >= 0 ? "+" : ""}${upl.toFixed(2)}
        </span>
        <span translate="no" className={`font-mono text-sm tabular-nums ${uplColor}`}>
          {roe >= 0 ? "+" : ""}{roe.toFixed(2)}% ROE
        </span>
      </div>

      {/* Price stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider">Entry</div>
          <div translate="no" className="font-mono tabular-nums text-text-t2 mt-0.5">{formatTickPrice(trade.entryPrice)}</div>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider">Mark</div>
          <div translate="no" className="font-mono tabular-nums text-text-t1 mt-0.5">
            {formatTickPrice(currentPx)}
          </div>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider">Notional</div>
          <div translate="no" className="font-mono tabular-nums text-text-t2 mt-0.5">
            ${((currentPx || trade.entryPrice) * trade.qty).toFixed(0)}
          </div>
        </div>
      </div>

      {/* SL / TP row */}
      <div className="grid grid-cols-3 gap-2 text-xs border-t border-border/30 pt-2">
        <div>
          <div className={`font-mono text-2xs tracking-wider ${slNear ? "text-red-400" : "text-text-t4"}`}>
            SL{slNear ? " ⚠" : ""}
          </div>
          <div translate="no" className={`font-mono tabular-nums mt-0.5 ${slNear ? "text-red-400 font-semibold" : "text-text-t3"}`}>
            {formatTickPrice(trade.stopPrice)}
          </div>
          {slDist !== null && (
            <div className="font-mono text-2xs text-text-t4 tabular-nums">{slDist.toFixed(1)}% uzak</div>
          )}
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider">TP1</div>
          <div translate="no" className="font-mono tabular-nums text-green-400 mt-0.5">
            {trade.takeProfit1 ? formatTickPrice(trade.takeProfit1) : "—"}
          </div>
        </div>
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-wider">TP2</div>
          <div translate="no" className="font-mono tabular-nums text-green-400/70 mt-0.5">
            {trade.takeProfit2 ? formatTickPrice(trade.takeProfit2) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaperPositionsCard(): React.ReactElement | null {
  const trades = useTradesStore((s) => s.trades);

  const paperOpen = useMemo(
    () => trades.filter((t) => t.isPaper && t.status === "open"),
    [trades],
  );

  if (paperOpen.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold tracking-widest text-text-t3 uppercase">
          Paper Pozisyonlar
        </span>
        <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 font-mono text-2xs text-blue-400">
          {paperOpen.length} açık
        </span>
      </div>

      {/* Position cards */}
      {paperOpen.map((trade) => (
        <PaperRow key={trade.id} trade={trade} />
      ))}
    </div>
  );
}
