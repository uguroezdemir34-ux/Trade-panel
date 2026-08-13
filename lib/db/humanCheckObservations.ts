/**
 * HUMAN CHECK OBSERVATION DB OPERATIONS — server-side only.
 *
 * lib/signal/humanTraderCheck.ts'in checkHumanTraderApproval() sonucunu
 * gölge-gözlem olarak kalıcılaştırır (bkz. supabase/migrations/026 dosya
 * başı yorumu — cvd_vpin_observations/goSignals.ts ile AYNI desen).
 * lib/signal/humanTraderCheck.ts'in kendisine bu dosyada HİÇ dokunulmadı,
 * sadece SONUCU okunuyor.
 *
 * insertGoSignal() (lib/db/goSignals.ts) ile AYNI hata deseni — bu
 * fonksiyon dbUpsert()'in fırlatabileceği hatayı KENDİSİ yutmaz, ÇAĞIRAN
 * taraf (lib/server/signalEngine.ts) best-effort try/catch ile sarmalar.
 * Import only from Next.js route handlers / server modülleri (never from
 * "use client").
 */

import { dbUpsert, isDbConfigured } from "./server";
import type { HumanTraderCheckResult } from "@/lib/signal/humanTraderCheck";

const TABLE = "human_check_observations";

export type HumanCheckObservationSource = "client" | "server";

export interface HumanCheckObservationInput {
  pair: string;
  direction: "LONG" | "SHORT";
  source: HumanCheckObservationSource;
  check: HumanTraderCheckResult;
}

interface HumanCheckObservationRow {
  pair: string;
  direction: string;
  source: string;
  approved: boolean;
  sr_rejected: boolean;
  volume_rejected: boolean;
  rr_rejected: boolean;
  rr_data_insufficient: boolean;
  trend_line_rejected: boolean;
  reasons: string[];
}

function toRow(input: HumanCheckObservationInput): HumanCheckObservationRow {
  const { check } = input;
  // trendLineOk ile AYNI hesap (checkHumanTraderApproval() içinde) — burada
  // export edilmemiş olduğu için tekrar türetiliyor, HumanTraderCheckResult
  // zaten bu iki alanı (trendLine + .confirmed) taşıyor, ek bir hesap yok.
  const trendLineRejected = check.trendLine === null || !check.trendLine.confirmed;
  return {
    pair: input.pair,
    direction: input.direction,
    source: input.source,
    approved: check.approved,
    sr_rejected: check.srCheck.blocked,
    volume_rejected: !check.volumeCheck.confirmed,
    rr_rejected: !check.rrCheck.acceptable,
    rr_data_insufficient: check.dataInsufficient,
    trend_line_rejected: trendLineRejected,
    reasons: check.reasons,
  };
}

/**
 * Insert (best-effort gözlem satırı). Supabase yapılandırılmamışsa sessizce
 * (console.warn ile) döner, throw ETMEZ. Yapılandırılmışsa ve dbUpsert
 * başarısız olursa BU FONKSİYON fırlatır — insertGoSignal() ile AYNI desen,
 * best-effort izolasyonu ÇAĞIRAN tarafın sorumluluğu.
 */
export async function insertHumanCheckObservation(input: HumanCheckObservationInput): Promise<void> {
  if (!isDbConfigured()) {
    console.warn(
      `[humanCheckObservations] SUPABASE not configured — gözlem satırı yazılmadı (pair=${input.pair}).`,
    );
    return;
  }
  await dbUpsert(TABLE, toRow(input));
}
