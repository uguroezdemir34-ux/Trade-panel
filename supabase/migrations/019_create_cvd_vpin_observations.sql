-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — cvd_vpin_observations (shadow-observation, tarayıcı taraflı)
-- Migration 019
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: CVD/VPIN (lib/orderflow/cvd.ts, vpin.ts) sadece tarayıcıda canlı
-- (WebSocket trade tape + stateful ring buffer) — sunucu cron'u (stateless,
-- 10sn timeout) bu veriyi besleyemez, OI divergence'taki REST-snapshot
-- deseni burada uygulanamaz. go_signals'a ek kolon yerine AYRI tablo:
-- client ve server GO tetikleme zamanlarının (signalTs) ortak deterministik
-- bir anahtarı yok, go_signals satırına UPDATE ile eklemeye çalışmak veri
-- kaybına yol açabilirdi (race condition — plan aşamasında tartışıldı).
-- Analiz zamanında pair+direction+ts yakınlığıyla go_signals'a join
-- edilecek. lib/score/orchestrator.ts'e bu migration'la hiç dokunulmadı.
--
-- Kapsam kısıtı: sadece tarayıcısı açık kullanıcının GO sinyalleri
-- loglanır — sunucu cron'unun ürettiği sinyaller burada YOK.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cvd_vpin_observations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  pair TEXT NOT NULL,
  direction TEXT NOT NULL,  -- 'LONG' | 'SHORT'
  signal_ts BIGINT NOT NULL,  -- client tarafındaki wall-clock ms
  -- CVD metrikleri (USD notional, pencerenin cvdUsd alanı)
  cvd_w1m DOUBLE PRECISION,
  cvd_w5m DOUBLE PRECISION,
  cvd_w15m DOUBLE PRECISION,
  cvd_confluence INTEGER,  -- kaç pencere aynı yönde (0-3)
  -- VPIN — null = henüz ready değil (yetersiz bucket) VEYA vpinState yok
  vpin DOUBLE PRECISION,
  -- Flow Verdict özeti
  flow_alignment TEXT,  -- strong_align | weak_align | neutral | weak_oppose | strong_oppose
  flow_score_adjustment INTEGER,  -- -10..+10
  flow_vetoed BOOLEAN
);

CREATE INDEX IF NOT EXISTS cvd_vpin_observations_pair_ts_idx
  ON cvd_vpin_observations (pair, signal_ts DESC);

-- ─── DOWN (elle çalıştırılır, otomatik değil — repodaki diğer
-- migration'larla aynı desen) ───
-- DROP TABLE IF EXISTS cvd_vpin_observations;
