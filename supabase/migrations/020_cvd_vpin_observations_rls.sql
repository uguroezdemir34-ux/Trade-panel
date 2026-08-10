-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — cvd_vpin_observations RLS
-- Migration 020 — 019_create_cvd_vpin_observations.sql'in "No RLS"
-- durumunu savunma-derinliği için kapatıyor (012_notification_config_rls.sql
-- ile aynı desen — orada notification_config için tespit edilen aynı risk
-- burada da bulundu).
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- BUGÜNKÜ TRAFİĞİ DEĞİŞTİRMEZ — app/api/log-cvd-vpin/route.ts zaten
-- SUPABASE_SERVICE_ROLE_KEY ile yazıyor (bkz. lib/db/server.ts), ve
-- service_role Postgres/Supabase'de RLS'i HER ZAMAN bypass eder, politika
-- olsun olmasın.
--
-- AMAÇ — RLS açık ama anon/authenticated için HİÇBİR politika
-- tanımlanmadı (Postgres varsayılanı: politika yoksa erişim yok). Bu
-- olmadan, bu projenin anon key'i ile PostgREST'e (Next.js middleware/rate
-- limit/validasyonu tamamen atlayan ayrı bir kapı) doğrudan bağlanan biri
-- tabloyu SELECT edebilir VEYA çöp veri INSERT edip ileride bu tablo
-- üzerinde yapılacak analizleri (ör. shadow-observation korelasyon
-- ölçümü) kirletebilirdi.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE cvd_vpin_observations ENABLE ROW LEVEL SECURITY;

-- Bilerek anon/authenticated için hiçbir SELECT/INSERT/UPDATE/DELETE
-- politikası tanımlanmıyor — bu tablonun tek meşru yazarı service_role
-- (app/api/log-cvd-vpin/route.ts), tek meşru okuyucusu da service_role
-- (ileride analiz amaçlı sorgular).

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- ALTER TABLE cvd_vpin_observations DISABLE ROW LEVEL SECURITY;
