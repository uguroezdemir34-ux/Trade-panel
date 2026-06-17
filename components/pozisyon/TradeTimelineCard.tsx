"use client";

/**
 * TRADE TIMELINE CARD — Son N trade'in dikey timeline'i.
 *
 * Her trade için:
 *   - Tarih + saat
 *   - Pair + direction + status badge
 *   - P&L (kapanmışsa) + R multiple
 *   - Exit reason
 *   - Entry context (skor, sebep)
 */

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useTradesStore } from "@/lib/store/tradesStore";
import type { TradeSnapshot } from "@/lib/trades/types";
import { recentTrades } from "@/lib/trades/selectors";

interface Props {
  trades: TradeSnapshot[];
  limit?: number;
}

export function TradeTimelineCard({
  trades,
  limit = 10,
}: Props): React.ReactElement {
  const t = useT();
  const items = recentTrades(trades, limit);

  if (items.length === 0) {
    return (
      <div className="border-border bg-bg-card rounded-lg border p-4 text-center">
        <p className="text-text-t3 font-mono text-xs tracking-wider">
          {t("trades.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t1 mb-3 font-mono text-xs tracking-widest">
        {t("trades.timeline.title")}
      </h3>

      <ul className="space-y-2">
        {items.map((trade) => (
          <TimelineItem key={trade.id} trade={trade} t={t} />
        ))}
      </ul>
    </div>
  );
}

function TimelineItem({
  trade,
  t,
}: {
  trade: TradeSnapshot;
  t: (k: string, params?: Record<string, string | number>) => string;
}) {
  const updateTradeNotes = useTradesStore((s) => s.updateTradeNotes);
  const [showNote, setShowNote] = useState(false);
  const [editNote, setEditNote] = useState(trade.notes ?? "");

  const isClosed = trade.status === "closed";
  const isWin = isClosed && (trade.exit?.pnlUsd ?? 0) > 0;
  const isLoss = isClosed && (trade.exit?.pnlUsd ?? 0) < 0;

  const statusColor = isClosed
    ? isWin
      ? "border-l-signal-green"
      : isLoss
        ? "border-l-signal-red"
        : "border-l-text-t3"
    : trade.status === "open"
      ? "border-l-signal-amber"
      : "border-l-text-t4";

  const dateStr = formatDateTime(trade.openedAt);

  function handleNoteSave() {
    const trimmed = editNote.trim();
    if (trimmed !== (trade.notes ?? "")) {
      updateTradeNotes(trade.id, trimmed);
    }
  }

  return (
    <li
      className={`border-border bg-bg-page rounded border border-l-4 p-3 ${statusColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {/* Üst satır: tarih + pair + direction */}
          <div className="flex items-center gap-2">
            <span className="text-text-t3 font-mono text-2xs tracking-wider">
              {dateStr}
            </span>
            <span className="text-text-t1 font-mono text-xs font-bold">
              {trade.pair}
            </span>
            <span
              className={`font-mono text-2xs font-bold tracking-widest ${
                trade.direction === "LONG"
                  ? "text-signal-green"
                  : "text-signal-red"
              }`}
            >
              {trade.direction}
            </span>
            <StatusBadge status={trade.status} isPaper={trade.isPaper} t={t} />
            {trade.source === "bot" && (
              <span className="font-mono text-[8px] font-bold text-brand/70 border border-brand/30 rounded px-1 py-px tracking-widest">
                BOT
              </span>
            )}
          </div>

          {/* Entry context */}
          {trade.entryContext.score !== undefined && (
            <div className="text-text-t3 mt-1 font-mono text-2xs">
              {t("trades.timeline.score")}: {trade.entryContext.score}/100
              {trade.entryContext.reasonText && (
                <> · {trade.entryContext.reasonText}</>
              )}
            </div>
          )}

          {/* P&L (kapanmışsa) */}
          {isClosed && trade.exit && (
            <div className="mt-1 flex items-center gap-2 font-mono text-2xs">
              <span
                className={`tabular-nums ${
                  isWin
                    ? "text-signal-green"
                    : isLoss
                      ? "text-signal-red"
                      : "text-text-t2"
                }`}
              >
                {(trade.exit.pnlUsd >= 0 ? "+" : "") +
                  "$" +
                  trade.exit.pnlUsd.toFixed(2)}
              </span>
              {trade.exit.rMultiple !== undefined && (
                <span className="text-text-t3">
                  {(trade.exit.rMultiple >= 0 ? "+" : "") +
                    trade.exit.rMultiple.toFixed(2) +
                    "R"}
                </span>
              )}
              <span className="text-text-t4 uppercase">
                · {trade.exit.reason}
              </span>
            </div>
          )}

          {/* Note preview (collapsed) */}
          {!showNote && trade.notes && (
            <div className="mt-1.5 font-mono text-2xs text-text-t4 italic truncate max-w-xs">
              {trade.notes}
            </div>
          )}
        </div>

        {/* Note toggle button */}
        <button
          type="button"
          onClick={() => {
            setEditNote(trade.notes ?? "");
            setShowNote((v) => !v);
          }}
          className={`mt-0.5 font-mono text-xs transition-colors leading-none ${
            trade.notes ? "text-brand/60 hover:text-brand" : "text-text-t4/40 hover:text-text-t3"
          }`}
          title={trade.notes ? t("trades.noteView") : t("trades.noteAdd")}
        >
          ✎
        </button>
      </div>

      {/* Note editor (expanded) */}
      {showNote && (
        <div className="mt-2 border-t border-border/30 pt-2">
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            onBlur={handleNoteSave}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleNoteSave(); }}
            placeholder={t("trades.noteAddPlaceholder")}
            rows={2}
            className="w-full resize-none bg-transparent border border-border/40 rounded px-2 py-1 font-mono text-2xs text-text-t2 placeholder:text-text-t4 focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
      )}
    </li>
  );
}

function StatusBadge({
  status,
  isPaper,
  t,
}: {
  status: TradeSnapshot["status"];
  isPaper: boolean;
  t: (k: string, params?: Record<string, string | number>) => string;
}) {
  const colorClass =
    status === "open"
      ? "bg-soft-amber text-signal-amber"
      : status === "closed"
        ? "bg-bg-card text-text-t3 border border-border"
        : "bg-soft-blue text-signal-blue";

  return (
    <div className="flex items-center gap-1">
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-2xs font-bold tracking-widest uppercase ${colorClass}`}
      >
        {t(`trades.status.${status}`)}
      </span>
      {isPaper && (
        <span className="bg-soft-blue text-signal-blue rounded px-1 py-0.5 font-mono text-2xs tracking-widest uppercase">
          {t("trades.paper")}
        </span>
      )}
    </div>
  );
}

function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${mon} ${h}:${m}`;
}
