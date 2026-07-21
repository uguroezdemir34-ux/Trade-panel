/**
 * SCORE HISTORY DB OPERATIONS — server-side only (cron).
 *
 * Append-only-ish snapshot log: her cron çalışmasında (saatte bir), aktif
 * her pair için o anki computeScore() sonucunun ham hali yazılır — GO/WAIT/NO
 * fark etmeksizin. go_signals'tan farkı bu: go_signals sadece GO geçişlerini
 * (isNewSignal filtresinden geçenler) tutuyor, score_history her bar için bir
 * satır. Amaç: ileride "trending_strong rejimde composite overextended'e
 * takılıp NO'ya düşen kaç sinyal var" gibi soruları, o veri hiç yazılmadığı
 * için cevapsız kalmasın diye.
 *
 * Import only from Next.js route handlers (never from "use client").
 */

import { dbUpsert, isDbConfigured } from "./server";
import { SCORE_ENGINE_VERSION } from "@/lib/score/version";

const TABLE = "score_history";

export interface ScoreHistoryInput {
  pair: string;
  direction: string;
  verdict: string;
  score: number;
  baseScore: number;
  effectiveThreshold: number | undefined;
  price: number;
  signalTs: number;
  regime: string | undefined;
  sweepBonus: number;
  regimeBonus: number;
  overextFlags: number;
  /** detectSRLevels()'in ham (ölçeklenmemiş) cezası — lib/sr/detect.ts, max -30 */
  srModifierRaw: number | undefined;
  /** Skora gerçekte eklenen değer — srModifierRaw × SR_SCALE_FACTOR */
  srModifierApplied: number | undefined;
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

interface ScoreHistoryRow {
  id: string;
  pair: string;
  direction: string;
  verdict: string;
  score: number;
  base_score: number;
  effective_threshold: number | null;
  regime: string | null;
  sweep_bonus: number;
  regime_bonus: number;
  overext_flags: number;
  sr_modifier_raw: number | null;
  sr_modifier_applied: number | null;
  blocks: string[];
  soft_blocks: string[];
  price: number;
  signal_ts: number;
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

function toRow(input: ScoreHistoryInput): ScoreHistoryRow {
  const { pair, signalTs, sub } = input;
  return {
    id: `${pair}_${signalTs}`,
    pair,
    direction: input.direction,
    verdict: input.verdict,
    score: input.score,
    base_score: input.baseScore,
    effective_threshold: input.effectiveThreshold ?? null,
    regime: input.regime ?? null,
    sweep_bonus: input.sweepBonus,
    regime_bonus: input.regimeBonus,
    overext_flags: input.overextFlags,
    sr_modifier_raw: input.srModifierRaw ?? null,
    sr_modifier_applied: input.srModifierApplied ?? null,
    blocks: input.blocks,
    soft_blocks: input.softBlocks,
    price: input.price,
    signal_ts: signalTs,
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
 * Insert (upsert) a batch of score snapshots — ONE Supabase call for all
 * pairs (go_signals'taki per-signal loop farklı: orada tipik olarak 0-2
 * yeni GO sinyali oluyor, burada her cron çalışmasında ~9 satır aynı anda
 * yazılıyor — cron'un 10sn bütçesini (Hobby plan) gereksiz yere zorlamamak
 * için tek istekte batch upsert kullanılıyor, dbUpsert zaten T[] destekliyor).
 * Idempotent: aynı pair+signalTs ile tekrar çağrılırsa (cron retry) no-op.
 *
 * If Supabase is not configured: logs a warning and returns without
 * throwing — cron continues (go_signals ile aynı desen).
 */
export async function insertScoreHistoryBatch(inputs: ScoreHistoryInput[]): Promise<void> {
  if (inputs.length === 0) return;
  if (!isDbConfigured()) {
    console.warn(
      `[scoreHistory] SUPABASE not configured — ${inputs.length} snapshot(s) NOT persisted.` +
        ` Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env to enable persistence.`,
    );
    return;
  }
  await dbUpsert(TABLE, inputs.map(toRow));
}
