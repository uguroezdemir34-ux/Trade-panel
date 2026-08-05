-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — score_history: Market Regime Detection telemetri kolonları
-- Migration 016 — Signal Engine v2, Phase 1
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: lib/score/orchestrator.ts içinde her hesaplamada (baseScore
-- gate'i OLMADAN) zaten hesaplanan adaptiveRegime (detectRegimeForWeights)
-- ve atrPercentile değerleri, daha önce ScoreResult'a hiç dönmüyor ve
-- kullanılıp atılıyordu. `regime` kolonuyla (migration 009,
-- scoreRegimeBonus'un baseScore≥75 gate'li versiyonu, çoğu zaman
-- "unknown") KARIŞTIRILMASIN — adaptive_regime her zaman anlamlı bir
-- etiket taşır ve gerçekten adaptiveWeights'i yönlendiren değerdir.
--
-- atr_percentile ham veri [0-100] — compression/normal/expansion/
-- extreme_expansion kategorizasyonu burada yapılmıyor, okuma tarafında
-- lib/indicators/atr-percentile.ts'in kendi bantlarıyla türetilecek.
--
-- İndeks: adaptive_regime bazlı bucket analizi (ör. "trending_strong
-- rejimde kaç sinyal NO'ya düşüyor") için signal_ts DESC ile birlikte.
--
-- Skor formülüne dokunuş yok — sadece zaten hesaplanan iki değer ek
-- olarak loglanıyor.
--
-- IF NOT EXISTS ile idempotent — migration 009'un varlığını varsayar.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS adaptive_regime TEXT,      -- detectRegimeForWeights() çıktısı, gate'siz, her zaman anlamlı
  ADD COLUMN IF NOT EXISTS atr_percentile  NUMERIC;   -- ham ATR percentile [0-100], null = hesaplanamadı

CREATE INDEX IF NOT EXISTS score_history_adaptive_regime_idx
  ON score_history (adaptive_regime, signal_ts DESC);
