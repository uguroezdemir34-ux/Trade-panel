/**
 * GET /api/track-record — herkese açık, salt-okunur, kayıp-dahil filtresiz
 * sinyal performans verisi (ROADMAP.md ADIM 2, madde 1).
 *
 * go_signals tablosundan en az bir outcome'u (15dk veya 1sa) yazılmış
 * satırları döner — henüz sonucu belli olmayan taze sinyaller gösterilmez.
 * Query param YOK, filtreleme client-side'a bırakılıyor. Auth GEREKTİRMEZ
 * (bkz. middleware.ts isPublicRoute — bu route'un buraya eklenmesi gerekiyor,
 * aksi halde auth.protect()'e takılır).
 *
 * "İsabet" tanımı: is_adverse=false — lib/signals/outcomeTracking.ts'teki
 * mevcut %0.5 adverse-threshold ile birebir aynı, burada yeni bir kriter
 * icat edilmedi.
 *
 * avg_move_pct_15m/1h YÖN-DÜZELTMELİ ortalama: outcome_*_move_pct DB'de
 * ham (yön-düzeltmesiz) saklanıyor (bkz. app/api/cron/signal-check/route.ts:77
 * — `movePct`, `movePctDir` değil) — SHORT sinyalin lehte hareketi DB'de
 * NEGATİF, LONG'unki POZİTİF görünür. Ham değerleri direkt ortalamak
 * LONG+SHORT karışık bir sette zıt yönleri birbirine götürüp anlamsız bir
 * sayı üretirdi (herkese açık, "manipüle edilemez" diye tanıtılan bir API
 * için kabul edilemez bir risk — sayfa göstermese bile ham JSON'u çeken
 * biri yanıltıcı bir sonuca varabilirdi). Bu yüzden burada, zaten normalize
 * edilmiş `direction` alanı kullanılarak işaret çevriliyor (SHORT için
 * -move_pct) — win_rate'in is_adverse ile zaten sahip olduğu yön-farkındalığı
 * avg_move_pct'e de taşındı.
 */

import { NextResponse } from "next/server";
import { dbSelect, isDbConfigured } from "@/lib/db/server";

export const revalidate = 300;

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

interface PublicSignalRecord {
  id: string;
  pair: string;
  signal_ts: number;
  direction: "LONG" | "SHORT";
  outcome_15m_move_pct: number | null;
  outcome_15m_is_adverse: boolean | null;
  outcome_1h_move_pct: number | null;
  outcome_1h_is_adverse: boolean | null;
}

interface TrackRecordSummary {
  total_signals: number;
  win_rate_15m: number;
  win_rate_1h: number;
  avg_move_pct_15m: number;
  avg_move_pct_1h: number;
  period_start: number;
  period_end: number;
}

interface TrackRecordResponse {
  summary: TrackRecordSummary;
  signals: PublicSignalRecord[];
}

/** 15dk/1sa penceresi için bağımsız win_rate + avg_move_pct hesaplar — bir
 * pencerenin null'ları diğerinin payda/ortalamasını etkilemez. */
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

export async function GET(): Promise<NextResponse> {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Track record not configured" }, { status: 503 });
  }

  try {
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

    const response: TrackRecordResponse = { summary, signals };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/track-record]", err);
    return NextResponse.json({ error: "Failed to load track record" }, { status: 500 });
  }
}
