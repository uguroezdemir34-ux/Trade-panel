/**
 * AI SCENARIO DB OPERATIONS — server-side only (cron).
 *
 * lib/db/goSignals.ts'teki AYNI desen (toRow converter, dbUpsert çağrısı).
 * Append-only log: id GÖNDERİLMİYOR — go_signals'ın aksine burada
 * deterministik bir doğal anahtar yok, her cron çağrısı yeni bir satır
 * olmalı. dbUpsert onConflict verilmeden çağrılırsa varsayılan conflict-key
 * `id` (PK) olur; payload'da id yoksa çakışma da olmaz, Postgres kendi
 * gen_random_uuid() default'unu kullanıp her zaman gerçek bir INSERT yapar.
 *
 * OUTCOME TAKİBİ (migration 025) — lib/db/goSignals.ts'teki
 * getSignalsPendingOutcome/writeSignalOutcome ile AYNI desen, TEK FARK:
 * go_signals.signal_ts BIGINT (epoch ms, migration 003) olduğu için orada
 * PostgREST gte/lte filtresine HAM SAYI veriliyor (`signal_ts=gte.171234...`).
 * ai_scenarios.created_at ise TIMESTAMPTZ (migration 024, DEFAULT NOW()) —
 * PostgREST'in TIMESTAMPTZ karşılaştırması ISO 8601 string bekliyor, ham
 * epoch-ms sayısı vermek "invalid input syntax for type timestamp" hatası
 * üretir. Bu yüzden epoch-ms sınırları burada new Date(ms).toISOString()
 * ile ISO string'e çevrilip encodeURIComponent() ile query'ye ekleniyor
 * (goSignals.ts'in outcome YAZARKEN zaten yaptığı dönüşümle aynı —
 * writeSignalOutcome() satır 216 — ama go_signals'ta SORGULAMA tarafı
 * BIGINT olduğu için bu dönüşüme hiç ihtiyaç duymuyordu; burada hem
 * yazma HEM okuma tarafında gerekiyor).
 */

import { dbSelect, dbUpdate, dbUpsert, isDbConfigured } from "./server";
import type { AIScoreResult } from "@/lib/analysis/score";
import type { SrLevels } from "@/lib/sr/detect";

interface InsertAiScenarioInput {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  score: AIScoreResult;
  srLevels: SrLevels;
  chartImageUrl: string | null;
}

function toRow(input: InsertAiScenarioInput) {
  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    current_price: input.currentPrice,
    score: input.score,
    sr_levels: input.srLevels,
    chart_image_url: input.chartImageUrl,
  };
}

export async function insertAiScenario(input: InsertAiScenarioInput): Promise<void> {
  await dbUpsert("ai_scenarios", toRow(input));
}

// ─── Outcome tracking (migration 025) ───

export type ScenarioOutcomeField = "4h" | "24h";

export interface PendingOutcomeScenario {
  id: string;
  symbol: string;
  /** ai_scenarios.current_price — senaryo üretildiği andaki fiyat (trigger). */
  triggerPrice: number;
  score: AIScoreResult;
  createdAtMs: number;
}

interface PendingScenarioRow {
  id: string;
  symbol: string;
  current_price: number;
  score: AIScoreResult;
  created_at: string;
}

/**
 * Henüz outcome'u yazılmamış AI Senaryo satırlarını döner.
 * lib/db/goSignals.ts → getSignalsPendingOutcome ile AYNI desen — TEK FARK
 * created_at'in TIMESTAMPTZ olması (bkz. dosya başı yorumu): epoch-ms
 * sınırları ISO string'e çevrilip gönderiliyor, go_signals'taki gibi ham
 * sayı DEĞİL.
 */
export async function getScenariosPendingOutcome(
  field: ScenarioOutcomeField,
  nowMs: number,
  minAgeMs: number,
  maxAgeMs: number,
): Promise<PendingOutcomeScenario[]> {
  if (!isDbConfigured()) return [];
  const capturedCol = field === "4h" ? "outcome_4h_captured_at" : "outcome_24h_captured_at";
  const minIso = new Date(nowMs - maxAgeMs).toISOString();
  const maxIso = new Date(nowMs - minAgeMs).toISOString();
  const rows = await dbSelect<PendingScenarioRow>(
    "ai_scenarios",
    `created_at=gte.${encodeURIComponent(minIso)}&created_at=lte.${encodeURIComponent(maxIso)}` +
      `&${capturedCol}=is.null&select=id,symbol,current_price,score,created_at&limit=200`,
  );
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    triggerPrice: r.current_price,
    score: r.score,
    createdAtMs: new Date(r.created_at).getTime(),
  }));
}

export interface ScenarioOutcomeWrite {
  /** Yön-bazlı DEĞİL, ham fiyat hareketi — go_signals'taki SignalOutcomeWrite.movePct ile aynı semantik. */
  movePct: number;
  price: number;
  wasCorrect: boolean;
  capturedAtMs: number;
}

interface AiScenarioOutcomeRow {
  outcome_4h_move_pct: number | null;
  outcome_4h_price: number | null;
  outcome_4h_was_correct: boolean | null;
  outcome_4h_captured_at: string | null;
  outcome_24h_move_pct: number | null;
  outcome_24h_price: number | null;
  outcome_24h_was_correct: boolean | null;
  outcome_24h_captured_at: string | null;
}

/** Tek bir senaryonun outcome'unu yazar (PATCH — diğer kolonlara dokunmaz). */
export async function writeScenarioOutcome(
  id: string,
  field: ScenarioOutcomeField,
  data: ScenarioOutcomeWrite,
): Promise<void> {
  if (!isDbConfigured()) return;
  const capturedAtIso = new Date(data.capturedAtMs).toISOString();
  const patch: Partial<AiScenarioOutcomeRow> =
    field === "4h"
      ? {
          outcome_4h_move_pct: data.movePct,
          outcome_4h_price: data.price,
          outcome_4h_was_correct: data.wasCorrect,
          outcome_4h_captured_at: capturedAtIso,
        }
      : {
          outcome_24h_move_pct: data.movePct,
          outcome_24h_price: data.price,
          outcome_24h_was_correct: data.wasCorrect,
          outcome_24h_captured_at: capturedAtIso,
        };
  await dbUpdate<AiScenarioOutcomeRow>("ai_scenarios", patch, `id=eq.${encodeURIComponent(id)}`);
}
