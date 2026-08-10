-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Referral Ödül Sistemi altyapısı
-- Migration 021 — user_referrals
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: waitlist.referral_code/referred_by (migration 007) kapalı beta
-- kapısına özgü — email-keyed, auth-öncesi, tek ödülü "3 kişiye ulaşınca
-- sırayı atla". Referral'ı gerçek bir büyüme/ödül mekanizmasına
-- dönüştürmek için (davet eden 1 ay Pro kredisi kazanır, davet edilen
-- %20 indirim alır) waitlist'ten BAĞIMSIZ, Clerk userId'ye bağlı ayrı bir
-- tablo gerekiyor.
--
-- Beta kapısı hâlâ aktif (chat kararı) — /invite/[code] eski akışta
-- kalıyor (WaitlistScreen → waitlist.referred_by). Yani her kullanıcının
-- kendi user_referrals satırı, ilk authenticated isteğinde TEMBEL
-- (lazy) oluşturulacak (bkz. lib/db/userReferrals.ts) — waitlist
-- satırı varsa referral_code VE referred_by aynen kopyalanır (yeni kod
-- üretilmez, bugüne kadar paylaşılmış linkler kırılmaz).
--
-- credit_granted — davet EDİLEN kullanıcının kendi satırında: referral
-- ödülü (referrer'a 1 ay kredi) sadece İLK başarılı ödemede verilir, her
-- ay yenilendiğinde tekrar tetiklenmemesi için bu flag kontrol edilir.
-- paid_referral_count — davet EDEN kullanıcının kendi satırında: kaç
-- davet ettiği kişi GERÇEKTEN ödeme yaptı (erken erişim viralite kolu
-- için, 3'e ulaşınca — bkz. ayrı görev).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_referrals (
  user_id             TEXT        PRIMARY KEY,  -- Clerk userId
  referral_code       TEXT        NOT NULL UNIQUE,
  referred_by         TEXT,                     -- başka bir user_referrals.referral_code
  credit_granted      BOOLEAN     NOT NULL DEFAULT FALSE,
  paid_referral_count INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_referrals_referred_by_idx ON user_referrals (referred_by);

-- 011/019'daki hatadan ders alındı (bkz. 012/020 düzeltmeleri) — bu kez
-- RLS baştan açık, hiç kapalı bırakılmadı:
ALTER TABLE user_referrals ENABLE ROW LEVEL SECURITY;
-- Bilerek anon/authenticated için hiçbir policy tanımlanmıyor (Postgres
-- varsayılanı: policy yoksa erişim yok) — service_role RLS'i her zaman
-- bypass eder.

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- DROP TABLE IF EXISTS user_referrals;
