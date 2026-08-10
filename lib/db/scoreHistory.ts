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

import { dbSelect, dbUpsert, isDbConfigured } from "./server";
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
  /** Ham OI velocity skoru [-10, +10] — null = hesaplanamadı (yetersiz snapshot). */
  oiVelocityScore: number | undefined;
  /** total'e gerçekte eklenen değer (oiVelocityScore ?? 0). */
  oiBonus: number | undefined;
  /** Tanısal: hesaplama anında mevcut OI snapshot sayısı — migration 013/014,
   *  Phase 1.0 OI Runtime Verification. */
  oiSnapshotCount: number | undefined;
  /** Ham funding oranı (ör. 0.0001 = %0.01) — null = veri gelmedi.
   *  Migration 015, sub_funding'in basamaktan doğrusala geçişini
   *  doğrulamak için tanısal amaçlı. */
  fundingRateRaw: number | null | undefined;
  /** Phase 1 — Market Regime Detection (Signal Engine v2). `regime`
   *  field'ının aksine gate'siz, her zaman anlamlı — bkz. migration 016. */
  adaptiveRegime: string | undefined;
  atrPercentile: number | null | undefined;
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
  oi_velocity_score: number | null;
  oi_bonus: number | null;
  oi_snapshot_count: number | null;
  funding_rate_raw: number | null;
  adaptive_regime: string | null;
  atr_percentile: number | null;
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
    oi_velocity_score: input.oiVelocityScore ?? null,
    oi_bonus: input.oiBonus ?? null,
    oi_snapshot_count: input.oiSnapshotCount ?? null,
    funding_rate_raw: input.fundingRateRaw ?? null,
    adaptive_regime: input.adaptiveRegime ?? null,
    atr_percentile: input.atrPercentile ?? null,
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

export interface ScoreHistorySnapshot {
  pair: string;
  direction: string;
  verdict: string;
  score: number;
  baseScore: number;
  price: number;
  signalTs: number;
  regime: string | null;
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
  };
}

/** atMs etrafında ne kadar geniş bir pencereden satır çekilecek — cron
 *  saatte bir yazdığı için birkaç saatlik bir pencere yeterli marj bırakır. */
const NEAR_WINDOW_MS = 3 * 60 * 60 * 1000;
const NEAR_ROWS_LIMIT = 50;

/**
 * atMs'e (pozisyon açılış zamanı, position.cTime) en yakın score_history
 * satırını döner. PostgREST ABS()-tabanlı "en yakın" sıralamayı desteklemiyor
 * — bir zaman penceresi çekilip en yakın satır JS'te seçilir.
 *
 * Pencerede hiç satır yoksa (Supabase yapılandırılmamış VEYA gerçekten veri
 * yoksa — örn. pozisyon score_history'nin devreye girmesinden önce açıldıysa)
 * null döner. Fabricate ETMEZ — caller (app/api/ai/position-check/route.ts)
 * bunu "giriş anı verisi yok" olarak açıkça ele almalı, sahte bir snapshot
 * üretmemeli.
 */
export async function getScoreHistoryNear(
  pair: string,
  atMs: number,
): Promise<ScoreHistorySnapshot | null> {
  if (!isDbConfigured()) return null;

  const rows = await dbSelect<ScoreHistoryRow>(
    TABLE,
    `pair=eq.${encodeURIComponent(pair)}` +
      `&signal_ts=gte.${atMs - NEAR_WINDOW_MS}&signal_ts=lte.${atMs + NEAR_WINDOW_MS}` +
      `&order=signal_ts.desc&limit=${NEAR_ROWS_LIMIT}`,
  );
  if (rows.length === 0) return null;

  let nearest = rows[0];
  let bestDiff = Math.abs(nearest.signal_ts - atMs);
  for (const row of rows) {
    const diff = Math.abs(row.signal_ts - atMs);
    if (diff < bestDiff) {
      nearest = row;
      bestDiff = diff;
    }
  }

  return {
    pair: nearest.pair,
    direction: nearest.direction,
    verdict: nearest.verdict,
    score: nearest.score,
    baseScore: nearest.base_score,
    price: nearest.price,
    signalTs: nearest.signal_ts,
    regime: nearest.regime,
    blocks: nearest.blocks,
    softBlocks: nearest.soft_blocks,
    sub: {
      trend: nearest.sub_trend,
      adx: nearest.sub_adx,
      rsi: nearest.sub_rsi,
      vol: nearest.sub_volume,
      bb: nearest.sub_bb,
      vwap: nearest.sub_vwap,
      funding: nearest.sub_funding,
      macro: nearest.sub_macro,
    },
  };
}

/**
 * GÖLGE MOD — lib/score/fundingPercentile.ts (deneysel, henüz canlı skora
 * bağlı değil) için son N saatin ham funding oranlarını çeker.
 *
 * score_history saatlik cron tarafından HER pariteye HER saat yazılıyor
 * (GO/WAIT/NO fark etmeksizin) — go_signals'ın aksine sadece GO geçişlerinde
 * değil, bu yüzden 72 saatlik bir pencere için tercih edilen kaynak. Supabase
 * yapılandırılmamışsa veya hiç satır yoksa boş dizi döner (fabricate etmez —
 * getScoreHistoryNear() ile aynı disiplin, caller'ın kendi cold-start
 * mantığı zaten "yetersiz veri" durumunu ele alıyor).
 */
export async function getFundingHistory(
  pair: string,
  sinceMs: number,
): Promise<{ rate: number; timestamp: number }[]> {
  if (!isDbConfigured()) return [];

  const rows = await dbSelect<{ funding_rate_raw: number | null; signal_ts: number }>(
    TABLE,
    `pair=eq.${encodeURIComponent(pair)}` +
      `&signal_ts=gte.${sinceMs}` +
      `&funding_rate_raw=not.is.null` +
      `&select=funding_rate_raw,signal_ts` +
      `&order=signal_ts.desc`,
  );

  return rows.map((r) => ({ rate: r.funding_rate_raw as number, timestamp: r.signal_ts }));
}
