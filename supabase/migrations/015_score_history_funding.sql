-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — score_history: ham funding oranı telemetri kolonu
-- Migration 015
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: scoreFunding() (lib/score/scorers.ts) 05 Ağu 2026'da ödeyen
-- taraf için basamak fonksiyonundan (8/5/2) doğrusal interpolasyona
-- geçirildi (bkz. commit "Funding skorunu ödeyen taraf için doğrusal
-- geçişe çevir"). Bu kolon, geçişin gerçekten kademeli sub.funding
-- değerleri ürettiğini canlı veriyle doğrulamak için — funding_rate_raw
-- olmadan sub_funding'deki bir değişikliğin hangi ham orana karşılık
-- geldiği ayrıştırılamaz.
--
-- Skor formülüne dokunuş yok — sadece zaten hesaplanan ham fundingRate
-- ek olarak loglanıyor.
--
-- IF NOT EXISTS ile idempotent — migration 009'un varlığını varsayar.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS funding_rate_raw NUMERIC;  -- ham funding oranı (ör. 0.0001 = %0.01), null = veri gelmedi
