-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — human_check_observations RLS
-- Migration 027 — 020_cvd_vpin_observations_rls.sql ile AYNI desen ve AYNI
-- gerekçe (bu tabloyu da hemen yaratıcısıyla AYNI migration turunda
-- kapatıyoruz — 012/020'de sonradan fark edilen "RLS unutuldu" riskini bu
-- tabloda baştan önlemek için).
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- BUGÜNKÜ TRAFİĞİ DEĞİŞTİRMEZ — hem app/api/log-human-check/route.ts
-- (client kaynağı) hem lib/server/signalEngine.ts (server kaynağı,
-- lib/db/humanCheckObservations.ts üzerinden) SUPABASE_SERVICE_ROLE_KEY ile
-- yazıyor (bkz. lib/db/server.ts), ve service_role Postgres/Supabase'de
-- RLS'i HER ZAMAN bypass eder, politika olsun olmasın.
--
-- AMAÇ — RLS açık ama anon/authenticated için HİÇBİR politika
-- tanımlanmadı (Postgres varsayılanı: politika yoksa erişim yok). Bu
-- olmadan, bu projenin anon key'i ile PostgREST'e doğrudan bağlanan biri
-- tabloyu SELECT edebilir VEYA çöp veri INSERT edip ileride bu tablo
-- üzerinde yapılacak "kaç GO denemesi, kaçı hangi kontrolden reddedildi"
-- analizini kirletebilirdi.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE human_check_observations ENABLE ROW LEVEL SECURITY;

-- Bilerek anon/authenticated için hiçbir SELECT/INSERT/UPDATE/DELETE
-- politikası tanımlanmıyor — bu tablonun tek meşru yazarları service_role
-- (app/api/log-human-check/route.ts, lib/server/signalEngine.ts), tek
-- meşru okuyucusu da service_role (ileride analiz amaçlı sorgular).

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- ALTER TABLE human_check_observations DISABLE ROW LEVEL SECURITY;
