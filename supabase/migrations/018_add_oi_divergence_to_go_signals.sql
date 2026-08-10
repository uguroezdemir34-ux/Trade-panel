-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — go_signals: oi_divergence kolonu (shadow-observation)
-- Migration 018
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: lib/score/orchestrator.ts:500-502 zaten computeOiDivergence()'ı
-- çalıştırıp reasons.oiDivergence + triggeredShadowGates'e yazıyor, ama
-- sonuç total skora hiç eklenmiyor (gölge mod — orchestrator.ts:350-356
-- yorum satırı doğrular). Bu kolon o gölge sonucu go_signals'a persist
-- ederek gerçek/sorgulanabilir bir örneklem biriktirir — amaç ileride
-- outcome_15m/outcome_1h ile korelasyonu ÖLÇÜP skora eklenip
-- eklenmeyeceğine veriyle karar vermek. lib/score/orchestrator.ts'e bu
-- migration'la hiç dokunulmadı.
--
-- Değerler: 'bullish' (confirm), 'bearish' (diverge), 'none' (nötr —
-- zayıf magnitude dahil), NULL (hesaplanamadı — snapshot geçmişi <2 veya
-- OKX API hatası; bkz. lib/server/signalEngine.ts).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE go_signals
  ADD COLUMN IF NOT EXISTS oi_divergence TEXT;

-- ─── DOWN (elle çalıştırılır, otomatik değil — repodaki diğer
-- migration'larla aynı desen, hepsi Dashboard'dan elle uygulanıyor) ───
-- ALTER TABLE go_signals DROP COLUMN IF EXISTS oi_divergence;
