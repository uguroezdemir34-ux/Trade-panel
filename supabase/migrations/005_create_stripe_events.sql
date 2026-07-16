-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Stripe Webhook Idempotency
-- Migration 005 — stripe_events
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Stripe aynı event'i birden fazla kez teslim edebileceğini açıkça
-- belirtir (ağ hatası, retry, vb.). app/api/stripe/webhook/route.ts
-- işlemeden önce event.id'nin burada olup olmadığını kontrol eder,
-- başarılı işleme SONRASI bir satır ekler — böylece aynı event iki kez
-- işlenip Clerk publicMetadata.plan'a mükerrer/çelişkili yazma yapmaz.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     TEXT        PRIMARY KEY,   -- Stripe event.id, örn. "evt_1AbC..."
  event_type   TEXT        NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eski kayıtları temizlemek isterseniz (opsiyonel, tablo küçük kalır zaten):
-- DELETE FROM stripe_events WHERE processed_at < now() - interval '90 days';

-- No RLS — bu tabloya sadece server-side webhook handler (service_role)
-- erişiyor, hiçbir kullanıcıya özel veri yok, tarayıcıdan erişilmesine
-- gerek yok.
