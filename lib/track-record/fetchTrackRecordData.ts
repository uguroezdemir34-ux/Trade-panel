/**
 * TRACK RECORD DATA — go_signals'tan herkese açık, filtresiz sinyal
 * performans verisini üretir.
 *
 * app/api/track-record/route.ts (JSON API, dış tüketiciler için) VE
 * app/track-record/page.tsx (Server Component, artık DOĞRUDAN bunu
 * çağırıyor — HTTP self-fetch KALDIRILDI, build-time'daki ECONNREFUSED
 * riski ortadan kalktı: aynı process içinde tek bir DB sorgusu, ağ
 * round-trip'i yok) bu TEK fonksiyonu paylaşıyor. Mantık route.ts'ten
 * BİREBİR taşındı — davranış değişmedi.
 *
 * DB yapılandırılmamışsa veya sorgu başarısız olursa çağırana göre farklı
 * ele alınması gerektiği için (route.ts → 503/500 JSON, page.tsx → null
 * prop) burada try/catch YOK — hata/null durumu çağırana bırakılıyor.
 */

import { dbSelect, isDbConfigured } from "@/lib/db/server";
import type {
  PublicSignalRecord,
  TrackRecordSummary,
  TrackRecordResponse,
} from "./types";

interface GoSignalOutcomeRow {
  id: string;
  pair: string;
  direction: string;
  signal_ts: number;
  outcome_15m_move_pct: number | null;
  outcome_15m_is_adverse: boolean | null;
  outcome_1h_move_pct: number | null;
  outcome_1h_is_adverse: boolean | null;
}

/** 15dk/1sa penceresi için bağımsız win_rate + avg_move_pct hesaplar — bir
 *  pencerenin null'ları diğerinin payda/ortalamasını etkilemez. */
function computeWindowMetrics(
  signals: PublicSignalRecord[],
  movePctKey: "outcome_15m_move_pct" | "outcome_1h_move_pct",
  adverseKey: "outcome_15m_is_adverse" | "outcome_1h_is_adverse",
): { winRate: number; avgMovePct: number } {
  const resolved = signals.filter((s) => s[movePctKey] !== null);
  if (resolved.length === 0) {
    return { winRate: 0, avgMovePct: 0 };
  }
  const wins = resolved.filter((s) => s[adverseKey] === false).length;
  const sumMove = resolved.reduce((acc, s) => {
    const raw = s[movePctKey] as number;
    const signed = s.direction === "SHORT" ? -raw : raw;
    return acc + signed;
  }, 0);
  return {
    winRate: wins / resolved.length,
    avgMovePct: sumMove / resolved.length,
  };
}

/** DB yapılandırılmamışsa null döner. DB sorgusu başarısız olursa throw eder
 *  (çağıran kendi hata stratejisini uygular). */
export async function fetchTrackRecordData(): Promise<TrackRecordResponse | null> {
  if (!isDbConfigured()) return null;

  const rows = await dbSelect<GoSignalOutcomeRow>(
    "go_signals",
    "or=(outcome_15m_move_pct.not.is.null,outcome_1h_move_pct.not.is.null)" +
      "&order=signal_ts.desc" +
      "&select=id,pair,direction,signal_ts,outcome_15m_move_pct,outcome_15m_is_adverse,outcome_1h_move_pct,outcome_1h_is_adverse",
  );

  const signals: PublicSignalRecord[] = rows.map((r) => ({
    id: r.id,
    pair: r.pair,
    signal_ts: r.signal_ts,
    direction: r.direction === "SHORT" ? "SHORT" : "LONG",
    outcome_15m_move_pct: r.outcome_15m_move_pct,
    outcome_15m_is_adverse: r.outcome_15m_is_adverse,
    outcome_1h_move_pct: r.outcome_1h_move_pct,
    outcome_1h_is_adverse: r.outcome_1h_is_adverse,
  }));

  const m15 = computeWindowMetrics(signals, "outcome_15m_move_pct", "outcome_15m_is_adverse");
  const m1h = computeWindowMetrics(signals, "outcome_1h_move_pct", "outcome_1h_is_adverse");

  const signalTimestamps = signals.map((s) => s.signal_ts);
  const summary: TrackRecordSummary = {
    total_signals: signals.length,
    win_rate_15m: m15.winRate,
    win_rate_1h: m1h.winRate,
    avg_move_pct_15m: m15.avgMovePct,
    avg_move_pct_1h: m1h.avgMovePct,
    period_start: signalTimestamps.length > 0 ? Math.min(...signalTimestamps) : 0,
    period_end: signalTimestamps.length > 0 ? Math.max(...signalTimestamps) : 0,
  };

  return { summary, signals };
}
