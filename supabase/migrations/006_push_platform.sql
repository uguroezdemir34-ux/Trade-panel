-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Push Subscription: WebPush / FCM Platform Ayrımı
-- Migration 006
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Mevcut push_subscriptions sadece Web Push (endpoint+p256dh+auth)
-- destekliyordu, endpoint PRIMARY KEY'di. FCM (Capacitor/Android native
-- push) aboneliklerinde "endpoint" kavramı yok — bunun yerine bir cihaz
-- "token"ı var. PK'yı senkron bir `id`'ye taşıyoruz, endpoint/p256dh/auth
-- nullable oluyor (FCM satırlarında boş), yeni `token`/`platform` kolonları
-- ekleniyor. Bir CHECK constraint her platformun kendi zorunlu alanlarını
-- doldurmasını garanti ediyor.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_pkey;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'webpush',
  ADD COLUMN IF NOT EXISTS token TEXT;

ALTER TABLE push_subscriptions ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN auth DROP NOT NULL;

ALTER TABLE push_subscriptions ADD PRIMARY KEY (id);

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_token_unique UNIQUE (token);

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_platform_check
    CHECK (platform IN ('webpush', 'fcm'));

-- webpush satırında endpoint+p256dh+auth dolu olmalı; fcm satırında token.
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_platform_fields_check CHECK (
    (platform = 'webpush' AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL)
    OR
    (platform = 'fcm' AND token IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS push_subscriptions_platform_idx
  ON push_subscriptions (platform);
