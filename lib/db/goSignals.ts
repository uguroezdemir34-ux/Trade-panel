/**
 * GO SIGNAL DB OPERATIONS — server-side only (cron).
 *
 * Append-only log of GO verdict transitions. No user scope:
 * these are global market signals, not per-user trades.
 * Import only from Next.js route handlers (never from "use client").
 */

import { dbSelect, dbUpdate, dbUpsert, isDbConfigured } from "./server";
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
  // Opsiyonel — insertGoSignal (toRow) bunları hiç göndermez, PostgREST'in
  // merge-duplicates upsert'i payload'da olmayan kolonlara dokunmaz. Böylece
  // bir sinyal aynı id ile tekrar upsert edilirse (dedup retry), daha önce
  // signal-check'in yazdığı outcome verisi YANLIŞLIKLA null'a düşmez.
  outcome_15m_move_pct?: number | null;
  outcome_15m_price?: number | null;
  outcome_15m_is_adverse?: boolean | null;
  outcome_15m_captured_at?: string | null;
  outcome_1h_move_pct?: number | null;
  outcome_1h_price?: number | null;
  outcome_1h_is_adverse?: boolean | null;
  outcome_1h_captured_at?: string | null;
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

export interface GoSignalCandidateRow {
  direction: string;
  signalTs: number;
}

/**
 * Fetch recent GO signals for a pair since a given timestamp (both directions).
 * Used by the position-adoption flow (app/api/go-signals) to check whether a
 * newly-detected live position followed a recent panel signal — direction is
 * NOT filtered here so the caller can also detect a contradicting signal
 * (opposite direction), not just a matching one.
 *
 * If Supabase is not configured: returns an empty array (no throw) — the
 * caller treats "no candidates" the same as "not configured".
 */
export async function getRecentGoSignals(
  pair: string,
  sinceMs: number,
): Promise<GoSignalCandidateRow[]> {
  if (!isDbConfigured()) return [];
  const rows = await dbSelect<GoSignalRow>(
    TABLE,
    `pair=eq.${encodeURIComponent(pair)}&signal_ts=gte.${sinceMs}&order=signal_ts.desc&limit=10`,
  );
  return rows.map((r) => ({ direction: r.direction, signalTs: r.signal_ts }));
}

export type OutcomeField = "15m" | "1h";

export interface PendingOutcomeSignal {
  id: string;
  pair: string;
  direction: string;
  triggerPrice: number;
  signalTs: number;
}

/**
 * signal_ts'i [nowMs - maxAgeMs, nowMs - minAgeMs] aralığında olan VE ilgili
 * outcome_*_captured_at'ı henüz null olan sinyalleri döner — bkz.
 * migration 008 header'ı: sunucu saatte bir çalıştığı için client'taki dar
 * pencere (15-20dk) yerine geniş bir tolerans penceresi kullanılır
 * (app/api/cron/signal-check/route.ts'te 15-75dk / 60-120dk).
 *
 * limit=200: tek cron çalışmasında makul bir üst sınır, migration sonrası
 * ilk çalışmalarda birikmiş eski sinyaller varsa bile route'un
 * maxDuration=10s bütçesini aşırı zorlamaz.
 */
export async function getSignalsPendingOutcome(
  field: OutcomeField,
  nowMs: number,
  minAgeMs: number,
  maxAgeMs: number,
): Promise<PendingOutcomeSignal[]> {
  if (!isDbConfigured()) return [];
  const capturedCol = field === "15m" ? "outcome_15m_captured_at" : "outcome_1h_captured_at";
  const rows = await dbSelect<GoSignalRow>(
    TABLE,
    `signal_ts=gte.${nowMs - maxAgeMs}&signal_ts=lte.${nowMs - minAgeMs}` +
      `&${capturedCol}=is.null&select=id,pair,direction,trigger_price,signal_ts&limit=200`,
  );
  return rows.map((r) => ({
    id: r.id,
    pair: r.pair,
    direction: r.direction,
    triggerPrice: r.trigger_price,
    signalTs: r.signal_ts,
  }));
}

export interface SignalOutcomeWrite {
  /** Yön-bazlı DEĞİL, ham fiyat hareketi — client'taki GoSignalOutcome.movePct ile aynı semantik */
  movePct: number;
  price: number;
  isAdverse: boolean;
  capturedAtMs: number;
}

/** Tek bir sinyalin outcome'unu yazar (PATCH — diğer kolonlara dokunmaz). */
export async function writeSignalOutcome(
  id: string,
  field: OutcomeField,
  data: SignalOutcomeWrite,
): Promise<void> {
  if (!isDbConfigured()) return;
  const capturedAtIso = new Date(data.capturedAtMs).toISOString();
  const patch: Partial<GoSignalRow> =
    field === "15m"
      ? {
          outcome_15m_move_pct: data.movePct,
          outcome_15m_price: data.price,
          outcome_15m_is_adverse: data.isAdverse,
          outcome_15m_captured_at: capturedAtIso,
        }
      : {
          outcome_1h_move_pct: data.movePct,
          outcome_1h_price: data.price,
          outcome_1h_is_adverse: data.isAdverse,
          outcome_1h_captured_at: capturedAtIso,
        };
  await dbUpdate<GoSignalRow>(TABLE, patch, `id=eq.${encodeURIComponent(id)}`);
}
