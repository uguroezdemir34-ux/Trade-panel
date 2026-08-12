-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — ai_scenarios outcome (4H/24H) kolonları
-- Migration 025
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- go_signals'taki migration 008'in AYNI deseni (isim, tolerans-pencere
-- mantığı, partial index) — 4H senaryo bağlamına uyarlanmış: movePct: ham
-- (yön-bağımsız) hareket, was_correct: skorun yönü (bull/bear/neutral,
-- >=60/<=40/arası) ile gerçek hareketin (±0.5% eşiği, ADVERSE_THRESHOLD_PCT
-- ile tutarlı) uyuşup uyuşmadığı.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE ai_scenarios
  ADD COLUMN IF NOT EXISTS outcome_4h_move_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS outcome_4h_price NUMERIC(24,8),
  ADD COLUMN IF NOT EXISTS outcome_4h_was_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS outcome_4h_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_24h_move_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS outcome_24h_price NUMERIC(24,8),
  ADD COLUMN IF NOT EXISTS outcome_24h_was_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS outcome_24h_captured_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ai_scenarios_pending_4h_idx
  ON ai_scenarios (created_at) WHERE outcome_4h_captured_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_scenarios_pending_24h_idx
  ON ai_scenarios (created_at) WHERE outcome_24h_captured_at IS NULL;

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- ALTER TABLE ai_scenarios
--   DROP COLUMN IF EXISTS outcome_4h_move_pct,
--   DROP COLUMN IF EXISTS outcome_4h_price,
--   DROP COLUMN IF EXISTS outcome_4h_was_correct,
--   DROP COLUMN IF EXISTS outcome_4h_captured_at,
--   DROP COLUMN IF EXISTS outcome_24h_move_pct,
--   DROP COLUMN IF EXISTS outcome_24h_price,
--   DROP COLUMN IF EXISTS outcome_24h_was_correct,
--   DROP COLUMN IF EXISTS outcome_24h_captured_at;
