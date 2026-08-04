-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — oi_snapshot_cache: OI velocity için kalıcı snapshot deposu
-- Migration 013
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam (Phase 1.0 — OI Runtime Verification, chat'te tartışıldı):
-- lib/server/signalEngine.ts'teki _oiSnapshots, modül-seviyesinde bir
-- in-memory Map idi ("Vercel warm invocation'larda yaşıyor" yorumuyla).
-- Cron saatte bir çalışıyor (vercel.json: "0 * * * *") — bu, tipik bir
-- Vercel serverless fonksiyonunun warm kalma süresinden çok daha uzun,
-- yani neredeyse her cron çalışması cold start. computeOiVelocityWindow()
-- en az 2 snapshot istiyor (lib/market/oi-velocity.ts:213); cold start'ta
-- Map boş başladığı için her çalışmada sadece 1 snapshot birikiyor ve
-- velocity hep null → oiVelocityScoreOrZero() hep 0 dönüyor. Sonuç:
-- oiBonus (orchestrator.ts:489, ±10 puan, total'e giriyor) muhtemelen
-- SUNUCU/Telegram yolunda aylardır sessizce sıfır — istemci (browser)
-- tarafı bundan etkilenmiyor çünkü macroStore.ts kendi snapshot'larını
-- localStorage'a yazıyor (kalıcı, cihazda hayatta kalıyor).
--
-- Bu migration, sunucu tarafına da localStorage'ın kalıcılık işlevini
-- görecek bir tablo ekliyor — pair başına TEK satır, snapshot dizisi
-- JSONB olarak tutuluyor, her cron çalışmasında okunup güncellenip geri
-- yazılıyor. Skor formülüne (lib/score/) hiçbir dokunuş yok — bu saf
-- bir kalıcılık/altyapı değişikliği.
--
-- IF NOT EXISTS ile idempotent.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS oi_snapshot_cache (
  pair       TEXT PRIMARY KEY,
  snapshots  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ "timestamp": ms, "openInterest": n, "price": n }, ...]
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
