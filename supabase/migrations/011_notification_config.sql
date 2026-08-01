-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Bildirim Kanalı Config (DB-taraflı, şifreli)
-- Migration 011 — notification_config
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Tek satırlık singleton tablo (id sabit 1, CHECK ile zorlanıyor) —
-- Telegram bot token + VIP/public chat ID'lerini AES-256-GCM şifreli
-- saklar (bkz. lib/crypto/serverSecrets.ts). Amaç: bu değerlerin Vercel
-- Environment Variables'a elle girilmesindeki hata riskini (kullanıcı
-- token'ı doğru girdiğini düşünse de env listesinde hiç görünmeyebiliyor)
-- ortadan kaldırmak — admin artık /ayarlar üzerinden, uygulamanın içinden
-- girip kaydedebiliyor. Şifreleme anahtarı hâlâ Vercel'de duran
-- STATE_ENCRYPTION_KEY'den türetiliyor — o değişkene bir daha dokunmaya
-- gerek yok, sadece bot token/chat ID rotasyonu artık DB üzerinden.
--
-- Değerler HİÇBİR ZAMAN düz metin dönmez (bkz. app/api/admin/
-- notification-config/route.ts) — GET sadece "yapılandırıldı mı"
-- boolean'ı döner, mevcut OKX/Telegram Layer 2 kartlarıyla aynı
-- write-only pratik.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_config (
  id                           SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  telegram_bot_token_enc       TEXT,
  telegram_vip_chat_id_enc     TEXT,
  telegram_public_chat_id_enc  TEXT,
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS (bu migration'da) — sadece server-side (service_role) erişiyor:
-- cron route'ları (resolveTelegramConfig/resolvePublicChatId) ve
-- admin-only /api/admin/notification-config, ikisi de
-- isAdminUserId()/middleware guard'ları arkasında. Tarayıcıdan doğrudan
-- erişilmesine gerek yok (bkz. 005_create_stripe_events.sql'deki aynı
-- gerekçe).
--
-- GÜNCELLEME (bkz. 012_notification_config_rls.sql): "gerek yok" bugün
-- hâlâ doğru ama savunma-derinliği için yine de RLS açıldı — bu tablo
-- için anon key hiç kullanılmasa bile, ileride yanlışlıkla kullanılırsa
-- DB seviyesinde kapalı kalsın diye. 011'i uygulayanlar 012'yi de
-- çalıştırmalı.
