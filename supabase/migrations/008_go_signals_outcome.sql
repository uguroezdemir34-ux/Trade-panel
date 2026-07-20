-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — go_signals: sunucu tarafı outcome (15dk/1sa) kolonları
-- Migration 008
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: outcome15m/outcome1h/isAdverse şimdiye kadar SADECE client-side
-- (goSignalLogStore.ts, localStorage, tarayıcı-bazlı, en fazla 200 kayıt,
-- "yalnızca browser açıksa doldurulur") — merkezi/sorgulanabilir bir veri
-- seti hiç olmadı. Bu migration, aynı kavramı go_signals tablosuna taşıyor
-- ki app/api/cron/signal-check/route.ts (saatte bir çalışan mevcut cron,
-- 2-cron Hobby plan limiti nedeniyle yeni bir cron eklenmedi — kullanıcı
-- onayıyla) her çalışmasında bekleyen sinyalleri doldurabilsin.
--
-- ÖNEMLİ — hassasiyet client-side'dan DÜŞÜK: client 30sn'de bir kontrol
-- edip 15-20dk/60-65dk'lık dar pencerede yakalıyordu. Bu sunucu tarafı
-- saatte bir çalıştığı için GENİŞ pencere kullanır (signal-check route'unda:
-- 15dk-75dk arası "15m", 60dk-120dk arası "1h") — kullanıcı onayıyla kabul
-- edilen bir hassasiyet kaybı (kaba örüntü analizi için yeterli, hassas
-- backtest için değil).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE go_signals
  ADD COLUMN IF NOT EXISTS outcome_15m_move_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS outcome_15m_price NUMERIC(24,8),
  ADD COLUMN IF NOT EXISTS outcome_15m_is_adverse BOOLEAN,
  ADD COLUMN IF NOT EXISTS outcome_15m_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_1h_move_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS outcome_1h_price NUMERIC(24,8),
  ADD COLUMN IF NOT EXISTS outcome_1h_is_adverse BOOLEAN,
  ADD COLUMN IF NOT EXISTS outcome_1h_captured_at TIMESTAMPTZ;

-- "Henüz outcome'u yazılmamış satırları bul" sorgusu her cron çalışmasında
-- atılıyor — partial index, tablo büyüdükçe bu sorguyu ucuz tutar.
CREATE INDEX IF NOT EXISTS go_signals_pending_15m_idx
  ON go_signals (signal_ts) WHERE outcome_15m_captured_at IS NULL;

CREATE INDEX IF NOT EXISTS go_signals_pending_1h_idx
  ON go_signals (signal_ts) WHERE outcome_1h_captured_at IS NULL;
