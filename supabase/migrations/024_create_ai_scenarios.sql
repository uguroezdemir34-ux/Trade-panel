-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — AI Senaryo kayıtları
-- Migration 024 — ai_scenarios
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: /api/cron/ai-scenario (BTC/ETH/SOL, 4H, günde 3 kez) her
-- çalışmasında ürettiği skor+S/R+görsel çıktısını şu an sadece Telegram'a
-- gönderiyor, hiçbir yerde kalıcı olarak saklamıyor. Bu tablo o çıktıyı
-- kalıcılaştırıyor — platform içi "AI Senaryo" sekmesinin (ayrı görev)
-- veri kaynağı olacak. score/sr_levels JSONB olarak saklanıyor (lib/
-- analysis/score.ts'teki AIScoreResult ve lib/sr/detect.ts'teki SrLevels
-- şekilleriyle birebir, ayrı bir kolon şeması çıkarılmadı — ikisi de
-- zaten kendi dosyalarında tipli, burada tekrar normalize etmek gereksiz
-- bir senkron riski yaratırdı). chart_image_url NULL olabilir — görsel
-- üretimi/yüklemesi başarısız olsa bile skor+S/R satırı kaydedilebilsin
-- diye (bkz. lib/db/storage.ts → uploadPublicImage, best-effort).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE ai_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '4h',
  current_price NUMERIC NOT NULL,
  score JSONB NOT NULL,
  sr_levels JSONB NOT NULL,
  chart_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_scenarios_symbol_created
  ON ai_scenarios(symbol, created_at DESC);

-- 011/019'daki hatadan ders alındı (bkz. 012/020 düzeltmeleri) — bu kez
-- RLS baştan açık, hiç kapalı bırakılmadı:
ALTER TABLE ai_scenarios ENABLE ROW LEVEL SECURITY;
-- Bilerek anon/authenticated için hiçbir policy tanımlanmıyor (Postgres
-- varsayılanı: policy yoksa erişim yok) — service_role RLS'i her zaman
-- bypass eder, tek yazan taraf /api/cron/ai-scenario (server-side).

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- DROP TABLE IF EXISTS ai_scenarios;
