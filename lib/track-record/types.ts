/**
 * TRACK RECORD TYPES — /api/track-record yanıt şekli.
 *
 * Saf veri tipi modülü — fonksiyon yok (bkz. lib/pnl/types.ts aynı desen).
 * app/api/track-record/route.ts kendi eşdeğer interface'lerini bağımsız
 * tanımlar (bu dosya route.ts'i import ETMEZ, ona hiç dokunulmadı) — bu
 * dosya sadece tüketici taraf (sayfa + view component) için tekrar
 * yazılmasın diye tek bir yerde tutuluyor.
 */

export interface PublicSignalRecord {
  id: string;
  pair: string;
  signal_ts: number;
  direction: "LONG" | "SHORT";
  outcome_15m_move_pct: number | null;
  outcome_15m_is_adverse: boolean | null;
  outcome_1h_move_pct: number | null;
  outcome_1h_is_adverse: boolean | null;
}

export interface TrackRecordSummary {
  total_signals: number;
  win_rate_15m: number;
  win_rate_1h: number;
  avg_move_pct_15m: number;
  avg_move_pct_1h: number;
  period_start: number;
  period_end: number;
}

export interface TrackRecordResponse {
  summary: TrackRecordSummary;
  signals: PublicSignalRecord[];
}
