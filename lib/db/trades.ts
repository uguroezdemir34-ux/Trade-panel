/**
 * TRADE DB OPERATIONS — server-side only.
 *
 * Maps TradeSnapshot ↔ DB row format.
 * Import only from Next.js route handlers (never from "use client").
 */

import { dbSelect, dbUpsert } from "./server";
import type { TradeSnapshot } from "@/lib/trades/types";

const TABLE = "trades";

// ── DB row shape (matches migration 001) ─────────────────────────

interface TradeRow {
  id: string;
  user_id: string;
  pair: string;
  direction: string;
  status: string;
  is_paper: boolean;
  opened_at: number;
  closed_at: number | null;
  pnl_usd: number | null;
  r_multiple: number | null;
  snapshot: TradeSnapshot;
}

// ── Mapping ──────────────────────────────────────────────────────

function toRow(userId: string, t: TradeSnapshot): TradeRow {
  return {
    id: t.id,
    user_id: userId,
    pair: t.pair,
    direction: t.direction,
    status: t.status,
    is_paper: t.isPaper,
    opened_at: t.openedAt,
    closed_at: t.exit?.closedAt ?? null,
    pnl_usd: t.exit?.pnlUsd ?? null,
    r_multiple: t.exit?.rMultiple ?? null,
    snapshot: t,
  };
}

function fromRow(row: TradeRow): TradeSnapshot {
  return row.snapshot;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Fetch all trades for a user from the DB.
 * Returns them as TradeSnapshot objects (from the `snapshot` JSON column).
 */
export async function getTradesForUser(userId: string): Promise<TradeSnapshot[]> {
  const rows = await dbSelect<TradeRow>(
    TABLE,
    `user_id=eq.${encodeURIComponent(userId)}&order=opened_at.desc&limit=2000`,
  );
  return rows.map(fromRow);
}

/**
 * Upsert a single trade for a user.
 * Safe to call multiple times — uses id as conflict key.
 */
export async function upsertTrade(userId: string, trade: TradeSnapshot): Promise<void> {
  await dbUpsert(TABLE, toRow(userId, trade));
}

/**
 * Upsert a batch of trades for a user.
 * Used for initial sync from localStorage.
 */
export async function upsertTrades(userId: string, trades: TradeSnapshot[]): Promise<void> {
  if (trades.length === 0) return;
  const rows = trades.map((t) => toRow(userId, t));
  // Supabase has a ~1MB POST limit — chunk if needed
  const CHUNK_SIZE = 200;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await dbUpsert(TABLE, rows.slice(i, i + CHUNK_SIZE));
  }
}
