-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Kapalı Beta Waitlist
-- Migration 007
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- id (bigint identity) kullanıcının sıra numarası olarak kullanılıyor —
-- app/api/waitlist/register/route.ts bunu doğrudan `position` olarak
-- döner. Clerk userId'ye BAĞLI DEĞİL (henüz hesap açmamış ziyaretçiler
-- için) — auth öncesi bir kapı, bkz. components/auth/WaitlistScreen.tsx.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS waitlist (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  referral_code TEXT        NOT NULL UNIQUE,
  referred_by   TEXT,
  status        TEXT        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'approved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_referral_code_idx ON waitlist (referral_code);
CREATE INDEX IF NOT EXISTS waitlist_referred_by_idx ON waitlist (referred_by);

-- No RLS — auth öncesi bir tablo, sahiplik (user_id) kavramı yok. Sadece
-- app/api/waitlist/register/route.ts (service_role) erişiyor, tarayıcıdan
-- doğrudan erişilmesine gerek yok (bkz. 005_create_stripe_events.sql'deki
-- aynı gerekçe).
