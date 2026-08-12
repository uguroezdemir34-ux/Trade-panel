/**
 * AI SCENARIO DB OPERATIONS — server-side only (cron).
 *
 * lib/db/goSignals.ts'teki AYNI desen (toRow converter, dbUpsert çağrısı).
 * Append-only log: id GÖNDERİLMİYOR — go_signals'ın aksine burada
 * deterministik bir doğal anahtar yok, her cron çağrısı yeni bir satır
 * olmalı. dbUpsert onConflict verilmeden çağrılırsa varsayılan conflict-key
 * `id` (PK) olur; payload'da id yoksa çakışma da olmaz, Postgres kendi
 * gen_random_uuid() default'unu kullanıp her zaman gerçek bir INSERT yapar.
 */

import { dbUpsert } from "./server";
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
