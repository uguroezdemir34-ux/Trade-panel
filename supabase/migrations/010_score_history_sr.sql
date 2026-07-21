-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — score_history: S/R (support/resistance) ceza kolonları
-- Migration 010
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: "neden hep dirençlere giriyor" sorusu araştırılırken (chat'te
-- tartışıldı) ortaya çıktı — lib/sr/detect.ts → detectSRLevels() gerçek
-- bir pivot/PDH-PDL/round-number S/R sistemi çalıştırıyor ve asimetrik
-- bir ceza hesaplıyor (max -30 ham puan), yani skor motoru S/R'ye KÖR
-- DEĞİL. Ama bu ceza signalEngine.ts'te uygulanmadan önce
-- lib/score/version.ts → SR_SCALE_FACTOR (0.15) ile çarpılıyor — yani
-- gerçekte skora eklenen etki max ~4.5/100 puan. Sistem direnci görüyor
-- ama cezası neredeyse etkisiz kalacak kadar küçültülmüş — bu muhtemel
-- kök neden.
--
-- Bu migration, o iki değeri (ham ve uygulanan) score_history'ye
-- ekliyor ki ileride "kaç GO sinyali aslında dirence çok yakınken
-- geçti, ceza ne kadar küçüktü" sorusu veriyle cevaplanabilsin.
-- SR_SCALE_FACTOR'ün kendisi bu turda DEĞİŞMEDİ — bu sadece gözlem,
-- karar değil (kullanıcı onayı: "bu tur sadece gözlem, karar değil").
--
-- IF NOT EXISTS ile idempotent — migration 009 daha önce çalışmış olsun
-- ya da olmasın, bu script hatasız tamamlanır (009'un varlığına bağımlı
-- değil, sadece score_history tablosunun var olduğunu varsayar).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS sr_modifier_raw     NUMERIC,  -- detectSRLevels() ham ceza (max -30, ölçeklenmemiş)
  ADD COLUMN IF NOT EXISTS sr_modifier_applied NUMERIC;  -- sr_modifier_raw × SR_SCALE_FACTOR — skora gerçekte eklenen değer
