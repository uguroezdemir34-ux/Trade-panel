-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — score_history: OI telemetri kolonları
-- Migration 014
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: migration 013 (oi_snapshot_cache) sorunu düzeltiyor ama
-- düzeltmenin gerçekten işe yaradığını KANITLAMAK için ayrı bir gözlem
-- kanalı gerekiyor — sr_modifier_raw/applied'da (migration 010)
-- uygulanan "önce gözlemle, sonra karar ver" ilkesinin aynısı.
--
-- oi_snapshot_count ÖZELLİKLE tanısal: her cron çalışmasında o an kaç
-- snapshot mevcuttu diye kaydediyor. Kalıcı cache çalışıyorsa bu sayı
-- zamanla 2, 3, ... OI_SNAP_MAX'a (10) kadar artmalı. Sürekli 1'de
-- kalırsa (veya hiç yazılmıyorsa), cache'in hâlâ kalıcı olmadığının
-- kanıtıdır — SR_SCALE_FACTOR'de olduğu gibi "düzelttik sanıp
-- düzeltmemiş olma" riskine karşı.
--
-- Skor formülüne dokunuş yok — bu turda sadece zaten hesaplanan
-- oiVelocityScore/oiBonus değerleri + yeni tanısal sayaç ek olarak
-- loglanıyor.
--
-- IF NOT EXISTS ile idempotent — migration 009'un varlığını varsayar.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS oi_velocity_score NUMERIC,  -- ham OI velocity skoru [-10, +10], null = hesaplanamadı
  ADD COLUMN IF NOT EXISTS oi_bonus           NUMERIC,  -- total'e gerçekte eklenen değer (oiVelocityScore ?? 0)
  ADD COLUMN IF NOT EXISTS oi_snapshot_count  INTEGER;  -- tanısal: hesaplama anında mevcut snapshot sayısı
