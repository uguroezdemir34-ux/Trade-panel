/**
 * GO SIGNAL DB OPERATIONS — server-side only (cron).
 *
 * Append-only log of GO verdict transitions. No user scope:
 * these are global market signals, not per-user trades.
 * Import only from Next.js route handlers (never from "use client").
 */

import { dbUpsert, isDbConfigured } from "./server";
import { SCORE_ENGINE_VERSION } from "@/lib/score/version";

const TABLE = "go_signals";

export interface GoSignalInput {
  pair: string;
  direction: string;
  score: number;
  effectiveThreshold: number | undefined;
  triggerPrice: number;
  signalTs: number;
  pullbackActive: boolean;
  regime: string | undefined;
  sweepBonus: number;
  regimeBonus: number;
  blocks: string[];
  softBlocks: string[];
  sub: {
    trend: number;
    adx: number;
    rsi: number;
    vol: number;
    bb: number;
    vwap: number;
    funding: number;
    macro: number;
  } | undefined;
}

interface GoSignalRow {
  id: string;
  pair: string;
  direction: string;
  score: number;
  effective_threshold: number | null;
  trigger_price: number;
  signal_ts: number;
  pullback_active: boolean;
  regime: string | null;
  sweep_bonus: number;
  regime_bonus: number;
  blocks: string[];
  soft_blocks: string[];
  engine_version: string;
  sub_trend: number;
  sub_adx: number;
  sub_rsi: number;
  sub_volume: number;
  sub_bb: number;
  sub_vwap: number;
  sub_funding: number;
  sub_macro: number;
}

function toRow(input: GoSignalInput): GoSignalRow {
  const { pair, direction, signalTs, sub } = input;
  return {
    id: `${pair}_${direction}_${signalTs}`,
    pair,
    direction,
    score: input.score,
    effective_threshold: input.effectiveThreshold ?? null,
    trigger_price: input.triggerPrice,
    signal_ts: signalTs,
    pullback_active: input.pullbackActive,
    regime: input.regime ?? null,
    sweep_bonus: input.sweepBonus,
    regime_bonus: input.regimeBonus,
    blocks: input.blocks,
    soft_blocks: input.softBlocks,
    engine_version: SCORE_ENGINE_VERSION,
    sub_trend:   sub?.trend   ?? 0,
    sub_adx:     sub?.adx     ?? 0,
    sub_rsi:     sub?.rsi     ?? 0,
    sub_volume:  sub?.vol     ?? 0,
    sub_bb:      sub?.bb      ?? 0,
    sub_vwap:    sub?.vwap    ?? 0,
    sub_funding: sub?.funding ?? 0,
    sub_macro:   sub?.macro   ?? 0,
  };
}

/**
 * Insert (upsert) a GO signal into the DB.
 * Idempotent: same pair+direction+signalTs is a no-op on retry.
 * If Supabase is not configured: logs a loud warning (visible in Vercel
 * function logs) and returns without throwing — cron continues.
 */
export async function insertGoSignal(input: GoSignalInput): Promise<void> {
  if (!isDbConfigured()) {
    console.warn(
      `[goSignals] SUPABASE not configured — GO signal NOT persisted` +
        ` (pair=${input.pair} direction=${input.direction} signalTs=${input.signalTs}).` +
        ` Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env to enable persistence.`,
    );
    return;
  }
  await dbUpsert(TABLE, toRow(input));
}
