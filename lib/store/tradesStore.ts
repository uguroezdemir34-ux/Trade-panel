/**
 * TRADES STORE — TradeSnapshot persistence + lifecycle.
 *
 * Mevcut DisciplineLog adapter (paket #10) çalışmaya devam eder. Bu store
 * paralel — gelecekte (paket #15+) DisciplineLog'tan beslenmek yerine
 * trade'ler buraya yazılacak.
 *
 * Persist key: ug52_trade_snapshots (array JSON)
 *
 * Maksimum kayıt: 500 (en eski kayıt droplanır — localStorage taşmasın)
 */

import { create } from "zustand";
import { z } from "zod";
import { loadFromStorage, saveToStorage } from "./persist";
import { PAIRS } from "@/lib/constants/pairs";
import type {
  TradeSnapshot,
  OpenTradeInput,
  CloseTradeInput,
  TradeStatus,
} from "@/lib/trades/types";
import type { ReconcileMatch } from "@/lib/reconcile/reconciler";
import {
  createPendingTrade,
  confirmOpen,
  closeTrade,
  detectTpSlHit,
  pruneOldClosedTrades,
  mergeIntoArchive,
  DEFAULT_PRUNE_AGE_MS,
  type PruneResult,
} from "@/lib/trades/state";
import {
  loadArchive,
  saveArchive,
  MAX_ARCHIVE_SIZE,
  ARCHIVE_STORAGE_KEY,
} from "@/lib/trades/pruner";

const MAX_TRADES = 500;
const STORAGE_KEY = "trade_snapshots";

// ═══════════════ ZOD SCHEMA (persist validation) ═══════════════

const exitInfoSchema = z.object({
  closedAt: z.number(),
  exitPrice: z.number(),
  reason: z.enum(["tp1", "tp2", "sl", "manual", "trail"]),
  pnlUsd: z.number(),
  pnlPct: z.number(),
  holdingSec: z.number(),
  rMultiple: z.number().optional(),
});

const entryContextSchema = z.object({
  score: z.number(),
  verdict: z.enum(["go", "wait", "no"]),
  confidence: z.number().optional(),
  counterTrend: z.boolean().optional(),
  reasonText: z.string().optional(),
  fgValue: z.number().optional(),
  btcDominance: z.number().optional(),
  fundingRate: z.number().optional(),
  drawdownTier: z.enum(["normal", "caution", "restricted", "locked"]).optional(),
});

const tradeSnapshotSchema = z.object({
  id: z.string(),
  orderId: z.string().optional(),
  pair: z.enum(PAIRS as unknown as [string, ...string[]]),
  direction: z.enum(["LONG", "SHORT"]),
  status: z.enum(["pending", "open", "closed"]),
  openedAt: z.number(),
  entryPrice: z.number(),
  qty: z.number(),
  leverage: z.number(),
  stopPrice: z.number(),
  takeProfit1: z.number().optional(),
  takeProfit2: z.number().optional(),
  riskAmountUsd: z.number(),
  isPaper: z.boolean(),
  entryContext: entryContextSchema,
  exit: exitInfoSchema.optional(),
});

const tradesArraySchema = z.array(tradeSnapshotSchema);

// ═══════════════ STORE ═══════════════

interface TradesStoreState {
  trades: TradeSnapshot[];
  /**
   * Arşiv — 48h+ geçmiş CLOSED trade'ler (sıkıştırılmış log).
   * Skor motoru bu diziyi kullanmaz — yalnızca analiz/export içindir.
   * localStorage'dan lazy yüklenir, max MAX_ARCHIVE_SIZE kaydı tutar.
   */
  archivedTrades: TradeSnapshot[];

  // Lifecycle actions
  openPending: (input: OpenTradeInput) => TradeSnapshot;
  confirmTradeOpen: (id: string, orderId?: string) => void;
  closeTradeById: (input: CloseTradeInput) => void;

  // TP/SL polling helper
  checkTpSl: (pair: string, high: number, low: number, now?: number) => void;

  /**
   * Memory Pruning — 48h+ eski CLOSED trade'leri live state'ten çıkarır,
   * arşive taşır. Skor motoru latency'sini <1ms'de tutar.
   *
   * @param now  Epoch ms (test inject — varsayılan Date.now())
   * @param maxAgeMs  Prune yaşı eşiği (varsayılan 48h)
   */
  pruneOldClosed: (now?: number, maxAgeMs?: number) => PruneResult;

  /** Arşiv dizisini döndür (okuma) */
  getArchivedTrades: () => TradeSnapshot[];

  // Queries
  getById: (id: string) => TradeSnapshot | undefined;
  getOpen: () => TradeSnapshot[];

  // Persistence
  rehydrate: () => void;

  /**
   * Merge trades fetched from the server DB into local state.
   * DB data wins on conflict (same id). Skips trades already in localStorage.
   * Called by AppShell after auth is loaded.
   */
  mergeFromDb: (dbTrades: TradeSnapshot[]) => void;

  /**
   * Apply reconciliation patches from OKX order history.
   * For open trades matched to a closing order: marks them closed with OKX data.
   * For closed trades with P&L delta > $0.01: updates pnlUsd.
   */
  patchFromReconcile: (patches: ReconcileMatch[]) => void;

  /**
   * Dual-layer SL/TP sync — Layer 2 (app side).
   * Called after adapter.updateSlTp() succeeds so the emergency stop guard
   * uses the current SL instead of the stale one from openPending().
   *
   * slPrice=null    → keep existing stopPrice (stopPrice is required on TradeSnapshot)
   * tp1Price=null   → clear takeProfit1
   * tp1Price=undef  → don't touch takeProfit1 (same semantics as tp2Price)
   * tp2Price=undef  → don't touch takeProfit2
   * tp2Price=null   → clear takeProfit2
   */
  updateTradeSlTp: (
    id: string,
    slPrice: number | null,
    tp1Price?: number | null,
    tp2Price?: number | null,
  ) => void;

  // Test/debug
  _reset: () => void;
}

export const useTradesStore = create<TradesStoreState>((set, get) => ({
  trades: [],
  archivedTrades: [],

  openPending: (input) => {
    const snap = createPendingTrade(input);
    const next = [...get().trades, snap];
    const trimmed = trimToMax(next);
    saveToStorage(STORAGE_KEY, trimmed);
    set({ trades: trimmed });
    return snap;
  },

  confirmTradeOpen: (id, orderId) => {
    const current = get().trades;
    const next = current.map((t) =>
      t.id === id && t.status === "pending"
        ? confirmOpen(t, orderId)
        : t,
    );
    saveToStorage(STORAGE_KEY, next);
    set({ trades: next });
  },

  closeTradeById: (input) => {
    const current = get().trades;
    const next = current.map((t) => {
      if (t.id !== input.id) return t;
      if (t.status === "closed") return t; // idempotent
      return closeTrade(t, input);
    });
    saveToStorage(STORAGE_KEY, next);
    set({ trades: next });
    // Fire-and-forget DB sync — non-blocking, silent on failure
    const closed = next.find((t) => t.id === input.id);
    if (closed?.status === "closed") {
      void import("@/lib/db/tradeSync").then(({ syncTradeToServer }) =>
        syncTradeToServer(closed),
      );
    }
  },

  checkTpSl: (pair, high, low, now) => {
    const current = get().trades;
    let changed = false;
    const next = current.map((t) => {
      if (t.pair !== pair) return t;
      if (t.status !== "open") return t;
      const hit = detectTpSlHit(t, high, low);
      if (!hit) return t;
      changed = true;
      return closeTrade(t, {
        id: t.id,
        exitPrice: hit.price,
        reason: hit.reason,
        now,
      });
    });
    if (changed) {
      saveToStorage(STORAGE_KEY, next);
      set({ trades: next });
    }
  },

  pruneOldClosed: (now = Date.now(), maxAgeMs = DEFAULT_PRUNE_AGE_MS) => {
    const current = get().trades;
    const result = pruneOldClosedTrades(current, now, maxAgeMs);

    if (result.prunedCount > 0) {
      // Mevcut arşivi yükle (lazy — store'daki archivedTrades veya localStorage)
      const storeArchive = get().archivedTrades;
      const diskArchive = storeArchive.length > 0 ? storeArchive : loadArchive();
      const updatedArchive = mergeIntoArchive(diskArchive, result.pruned, MAX_ARCHIVE_SIZE);

      saveToStorage(STORAGE_KEY, result.live);
      saveArchive(updatedArchive, MAX_ARCHIVE_SIZE);

      set({ trades: result.live, archivedTrades: updatedArchive });
    }

    return result;
  },

  getArchivedTrades: () => {
    const storeArchive = get().archivedTrades;
    if (storeArchive.length > 0) return storeArchive;
    // Lazy load from localStorage
    const disk = loadArchive();
    if (disk.length > 0) {
      set({ archivedTrades: disk });
    }
    return disk;
  },

  getById: (id) => get().trades.find((t) => t.id === id),

  getOpen: () => get().trades.filter((t) => t.status === "open"),

  rehydrate: () => {
    const loaded = loadFromStorage<TradeSnapshot[]>(
      STORAGE_KEY,
      [],
      tradesArraySchema,
    );
    set({ trades: loaded });
  },

  mergeFromDb: (dbTrades) => {
    if (dbTrades.length === 0) return;
    const current = get().trades;
    const archive = get().archivedTrades;

    // Build lookup by id for O(1) access
    const localById = new Map(current.map((t) => [t.id, t]));
    const archiveById = new Map(archive.map((t) => [t.id, t]));

    let changed = false;
    const incoming: TradeSnapshot[] = [];

    for (const dbTrade of dbTrades) {
      const localVersion = localById.get(dbTrade.id) ?? archiveById.get(dbTrade.id);
      // DB wins: if not present locally, or DB has a closed version and local has open
      if (!localVersion || (dbTrade.status === "closed" && localVersion.status !== "closed")) {
        incoming.push(dbTrade);
        changed = true;
      }
    }

    if (!changed) return;

    // Separate incoming into live (open/pending or recent closed) and archive candidates
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const incomingLive = incoming.filter(
      (t) => t.status !== "closed" || (t.exit?.closedAt ?? 0) > cutoff,
    );
    const incomingArchive = incoming.filter(
      (t) => t.status === "closed" && (t.exit?.closedAt ?? 0) <= cutoff,
    );

    // Merge live trades (DB incoming + current, deduped by id, DB wins)
    const mergedLive = [
      ...current.filter((t) => !incoming.some((d) => d.id === t.id)),
      ...incomingLive,
    ].sort((a, b) => a.openedAt - b.openedAt);

    // Merge archive (same dedup logic)
    const mergedArchive = [
      ...archive.filter((t) => !incoming.some((d) => d.id === t.id)),
      ...incomingArchive,
    ].sort((a, b) => (a.exit?.closedAt ?? 0) - (b.exit?.closedAt ?? 0));

    const trimmedLive = trimToMax(mergedLive);
    saveToStorage(STORAGE_KEY, trimmedLive);
    saveArchive(mergedArchive, MAX_ARCHIVE_SIZE);
    set({ trades: trimmedLive, archivedTrades: mergedArchive });
  },

  patchFromReconcile: (patches) => {
    if (patches.length === 0) return;
    const current = get().trades;
    let changed = false;

    const next = current.map((t) => {
      const patch = patches.find((p) => p.tradeId === t.id && p.needsUpdate);
      if (!patch) return t;

      changed = true;
      const isOpen = t.status === "open" || t.status === "pending";

      if (isOpen) {
        const closedAt = patch.okxFilledAtMs || Date.now();
        const holdingSec = Math.round((closedAt - t.openedAt) / 1000);
        const pnlPct =
          t.entryPrice > 0
            ? ((patch.okxExitPrice - t.entryPrice) / t.entryPrice) *
              (t.direction === "LONG" ? 1 : -1) *
              100
            : 0;
        const rMultiple =
          t.riskAmountUsd > 0
            ? patch.okxPnlUsd / t.riskAmountUsd
            : undefined;
        return {
          ...t,
          orderId: t.orderId ?? patch.okxOrderId,
          status: "closed" as const,
          exit: {
            closedAt,
            exitPrice: patch.okxExitPrice,
            reason: "manual" as const,
            pnlUsd: patch.okxPnlUsd,
            pnlPct,
            holdingSec,
            rMultiple,
          },
        };
      }

      // Closed trade — only update pnlUsd
      if (!t.exit) return t;
      return {
        ...t,
        exit: { ...t.exit, pnlUsd: patch.okxPnlUsd },
      };
    });

    if (changed) {
      saveToStorage(STORAGE_KEY, next);
      set({ trades: next });
    }
  },

  updateTradeSlTp: (id, slPrice, tp1Price, tp2Price) => {
    const current = get().trades;
    let changed = false;
    const next = current.map((t) => {
      if (t.id !== id || t.status === "closed") return t;
      changed = true;
      return {
        ...t,
        ...(slPrice != null ? { stopPrice: slPrice } : {}),
        ...(tp1Price !== undefined
          ? { takeProfit1: tp1Price != null ? tp1Price : undefined }
          : {}),
        ...(tp2Price !== undefined
          ? { takeProfit2: tp2Price != null ? tp2Price : undefined }
          : {}),
      };
    });
    if (!changed) return;
    saveToStorage(STORAGE_KEY, next);
    set({ trades: next });
  },

  _reset: () => {
    saveToStorage(STORAGE_KEY, []);
    saveToStorage(ARCHIVE_STORAGE_KEY, []);
    set({ trades: [], archivedTrades: [] });
  },
}));

// ═══════════════ HELPERS ═══════════════

/**
 * Max kayıt sayısını geçmesin — en eski kapanmış trade'leri at.
 * (Açık trade'leri ASLA atma)
 */
function trimToMax(trades: TradeSnapshot[]): TradeSnapshot[] {
  if (trades.length <= MAX_TRADES) return trades;

  // Önce kapanmış olanları sırala (en eski sona)
  const closed = trades.filter((t) => t.status === "closed");
  const active = trades.filter((t) => t.status !== "closed");

  // Kapanmışlar arasından en eskilerden başla, sil
  const sortedClosed = [...closed].sort(
    (a, b) => (a.exit?.closedAt ?? 0) - (b.exit?.closedAt ?? 0),
  );

  const allowedClosed = MAX_TRADES - active.length;
  const keepClosed = allowedClosed > 0
    ? sortedClosed.slice(-allowedClosed)
    : [];

  return [...active, ...keepClosed].sort((a, b) => a.openedAt - b.openedAt);
}

// ═══════════════ SELECTORS (re-export from lib/trades) ═══════════════

export const selectAllTrades = (s: TradesStoreState): TradeSnapshot[] =>
  s.trades;
export const selectOpenTrades = (s: TradesStoreState): TradeSnapshot[] =>
  s.trades.filter((t) => t.status === "open");
export const selectClosedTrades = (s: TradesStoreState): TradeSnapshot[] =>
  s.trades.filter((t) => t.status === "closed");
export const selectStatus = (status: TradeStatus) =>
  (s: TradesStoreState): TradeSnapshot[] =>
    s.trades.filter((t) => t.status === status);
export const selectArchivedTrades = (s: TradesStoreState): TradeSnapshot[] =>
  s.archivedTrades;
