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
-- snapshot mevcuttu diye kaydediyor. Kalıcı cache çalışıyorsa bu sayı hiçbir
-- zaman 1'de kalmamalı (1 = her çalışma sıfırdan başlıyor demek, eski bug).
--
-- DÜZELTME (05 Ağu 2026, gerçek veriyle ölçüldü): İlk yorumdaki "sayı
-- zamanla 10'a kadar artmalı" beklentisi YANLIŞTI — OI_SNAP_MAX_AGE_MS
-- (yaş penceresi) ile saatlik cron kadansının etkileşimi, OI_SNAP_MAX
-- (adet sınırı, 10) hiç devreye girmeden snapshot sayısını düşük bir
-- platoda tutuyor (pencere/kadans oranına göre ~2-3). Bu bir hata değil,
-- iki sabitin matematiksel etkileşimi — ayrıntı için
-- lib/server/signalEngine.ts'teki OI_SNAP_MAX_AGE_MS yorumuna bakın.
-- Asıl kanıt "sürekli 1" DEĞİL "sürekli ≥2" olması.
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
