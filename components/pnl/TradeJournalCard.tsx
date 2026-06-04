"use client";

import { useState, useEffect, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useTradeNotesStore } from "@/lib/store/tradeNotesStore";
import { useT } from "@/lib/i18n/context";
import type { TradeSnapshot } from "@/lib/trades/types";

const PRESET_TAGS = ["#plan", "#fomo", "#discipline", "#perfect", "#mistake", "#patience"];

const PAGE_SIZE = 10;

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pnlColor(v: number): string {
  return v >= 0 ? "text-signal-green" : "text-signal-red";
}

interface NoteEditorProps {
  tradeId: string;
}

function NoteEditor({ tradeId }: NoteEditorProps) {
  const t = useT();
  const note = useTradeNotesStore((s) => s.notes[tradeId]);
  const setNote = useTradeNotesStore((s) => s.setNote);
  const deleteNote = useTradeNotesStore((s) => s.deleteNote);

  const [text, setText] = useState(note?.text ?? "");
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutoSave(newText: string, newTags: string[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(() => {
      if (newText.trim()) {
        setNote(tradeId, newText.trim(), newTags);
      } else {
        deleteNote(tradeId);
      }
      setSaved(true);
    }, 800);
  }

  function handleTextChange(v: string) {
    setText(v);
    scheduleAutoSave(v, tags);
  }

  function toggleTag(tag: string) {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(next);
    scheduleAutoSave(text, next);
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={t("pnl.journal.notePlaceholder")}
        rows={3}
        className="w-full resize-none rounded border border-border bg-surface-s1 px-3 py-2 font-mono text-xs text-text-t1 placeholder:text-text-t4 focus:outline-none focus:ring-1 focus:ring-brand/40"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESET_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={[
              "rounded-full border px-2 py-0.5 font-mono text-2xs transition-colors",
              tags.includes(tag)
                ? "border-brand bg-brand/15 text-brand"
                : "border-border text-text-t4 hover:border-brand/40 hover:text-text-t3",
            ].join(" ")}
          >
            {tag}
          </button>
        ))}
        {saved && (
          <span className="ml-auto font-mono text-2xs text-signal-green">{t("pnl.journal.saved")}</span>
        )}
      </div>
    </div>
  );
}

interface TradeRowProps {
  trade: TradeSnapshot;
  expanded: boolean;
  onToggle: () => void;
}

function TradeRow({ trade, expanded, onToggle }: TradeRowProps) {
  const t = useT();
  const note = useTradeNotesStore((s) => s.notes[trade.id]);
  const pnl = trade.exit!.pnlUsd;
  const r = trade.exit!.rMultiple;
  const hasNote = !!note?.text;

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-s1 transition-colors"
      >
        {/* Date */}
        <span className="w-28 shrink-0 font-mono text-2xs text-text-t3">
          {fmt(trade.exit!.closedAt)}
        </span>

        {/* Pair + direction */}
        <span className="w-24 shrink-0 font-mono text-xs font-medium text-text-t1">
          {trade.pair}
        </span>
        <span
          className={[
            "w-10 shrink-0 rounded px-1 text-center font-mono text-2xs",
            trade.direction === "LONG"
              ? "bg-signal-green/10 text-signal-green"
              : "bg-signal-red/10 text-signal-red",
          ].join(" ")}
        >
          {trade.direction === "LONG" ? "▲" : "▼"}
        </span>

        {/* Score */}
        <span className="w-10 shrink-0 text-center font-mono text-2xs text-text-t3">
          {trade.entryContext.score}
        </span>

        {/* P&L */}
        <span className={`flex-1 text-right font-mono text-xs font-medium ${pnlColor(pnl)}`}>
          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}$
        </span>

        {/* R multiple */}
        {r !== undefined && (
          <span className={`w-12 text-right font-mono text-2xs ${pnlColor(r)}`}>
            {r >= 0 ? "+" : ""}{r.toFixed(2)}R
          </span>
        )}

        {/* Note indicator + chevron */}
        <span className="w-6 shrink-0 text-right">
          {hasNote ? (
            <span className="text-brand text-xs">✎</span>
          ) : (
            <span className="text-text-t4 text-xs">{expanded ? "▲" : "▼"}</span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-2 font-mono text-2xs text-text-t4 mb-2">
            <span>{t("pnl.journal.entryLabel")} {trade.entryPrice.toLocaleString()}</span>
            <span>·</span>
            <span>{t("pnl.journal.exitLabel")} {trade.exit!.exitPrice.toLocaleString()}</span>
            <span>·</span>
            <span>{t("pnl.journal.reasonLabel")} {trade.exit!.reason.toUpperCase()}</span>
            {trade.entryContext.reasonText && (
              <>
                <span>·</span>
                <span className="text-text-t3">{trade.entryContext.reasonText}</span>
              </>
            )}
          </div>
          <NoteEditor tradeId={trade.id} />
        </div>
      )}
    </div>
  );
}

export function TradeJournalCard(): React.ReactElement | null {
  const t = useT();
  const trades = useTradesStore((s) => s.trades);
  const rehydrate = useTradeNotesStore((s) => s.rehydrate);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "noted" | "unnoted">("all");

  const notes = useTradeNotesStore((s) => s.notes);

  useEffect(() => { rehydrate(); }, [rehydrate]);

  const closed = trades
    .filter((tr) => tr.status === "closed" && tr.exit != null)
    .sort((a, b) => b.exit!.closedAt - a.exit!.closedAt);

  const filtered = closed.filter((tr) => {
    if (filter === "noted") return !!notes[tr.id]?.text;
    if (filter === "unnoted") return !notes[tr.id]?.text;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (closed.length === 0) return null;

  const notedCount = closed.filter((tr) => !!notes[tr.id]?.text).length;

  const notedCountLabel = t("pnl.journal.notedCount")
    .replace("{noted}", String(notedCount))
    .replace("{total}", String(closed.length));

  return (
    <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-text-t1 text-sm font-medium">{t("pnl.journal.title")}</h3>
          <span className="font-mono text-2xs text-text-t4">
            {notedCountLabel}
          </span>
        </div>
        <div className="flex gap-1">
          {(["all", "noted", "unnoted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={[
                "rounded px-2 py-0.5 font-mono text-2xs transition-colors",
                filter === f
                  ? "bg-surface-s2 text-text-t1"
                  : "text-text-t4 hover:text-text-t2",
              ].join(" ")}
            >
              {f === "all" ? t("pnl.journal.filterAll") : f === "noted" ? t("pnl.journal.filterNoted") : t("pnl.journal.filterUnnoted")}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 border-b border-border/20 bg-surface-s1/30 px-3 py-1.5">
        <span className="w-28 shrink-0 font-mono text-2xs text-text-t4">{t("pnl.journal.colDate")}</span>
        <span className="w-24 shrink-0 font-mono text-2xs text-text-t4">{t("pnl.journal.colPair")}</span>
        <span className="w-10 shrink-0 font-mono text-2xs text-text-t4">{t("pnl.journal.colDirection")}</span>
        <span className="w-10 shrink-0 text-center font-mono text-2xs text-text-t4">{t("pnl.journal.colScore")}</span>
        <span className="flex-1 text-right font-mono text-2xs text-text-t4">P&L</span>
        <span className="w-12 text-right font-mono text-2xs text-text-t4">R</span>
        <span className="w-6" />
      </div>

      {/* Trade rows */}
      {paginated.length === 0 ? (
        <p className="px-4 py-6 text-center font-mono text-xs text-text-t4">
          {filter === "noted" ? t("pnl.journal.emptyNoted") : t("pnl.journal.empty")}
        </p>
      ) : (
        paginated.map((tr) => (
          <TradeRow
            key={tr.id}
            trade={tr}
            expanded={expandedId === tr.id}
            onToggle={() => setExpandedId(expandedId === tr.id ? null : tr.id)}
          />
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-border/30 px-4 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-mono text-2xs text-text-t4 hover:text-text-t2 disabled:opacity-30"
          >
            {t("pnl.journal.prev")}
          </button>
          <span className="font-mono text-2xs text-text-t4">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="font-mono text-2xs text-text-t4 hover:text-text-t2 disabled:opacity-30"
          >
            {t("pnl.journal.next")}
          </button>
        </div>
      )}
    </div>
  );
}
