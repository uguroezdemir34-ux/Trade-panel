-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Row Level Security (RLS)
-- Migration 004 — trades / push_subscriptions / go_signals
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- ÖNEMLİ — bu migration BUGÜNKÜ trafiği DEĞİŞTİRMEZ: tüm Next.js API
-- route'ları Supabase'e `SUPABASE_SERVICE_ROLE_KEY` ile bağlanıyor
-- (bkz. lib/db/server.ts), ve service_role Postgres/Supabase'de RLS'i
-- HER ZAMAN bypass eder — politika yazsak da yazmasak da. Bu migration'ın
-- amacı, ileride (yanlışlıkla ya da bilerek) tarayıcıdan doğrudan
-- Supabase'e bir anon/authenticated key ile erişim açılırsa, cross-tenant
-- veri sızıntısını DB seviyesinde engellemek — bugünkü tek koruma katmanı
-- olan "uygulama kodunda WHERE user_id = ... unutulmasın" varsayımına
-- ikinci bir savunma katmanı eklemek.
--
-- `auth.jwt()->>'sub'` kullanımı Supabase'in Clerk için native
-- "Third-Party Auth" entegrasyonunu varsayar (bkz. dosya sonundaki not).
-- Bu entegrasyon kurulmadan authenticated/anon rolüyle gelen bir istekte
-- auth.jwt() boş döner → politikalar hiçbir satır döndürmez (varsayılan
-- güvenli: erişim yok, hata değil).
-- ═══════════════════════════════════════════════════════════════════

-- ── trades ────────────────────────────────────────────────────────
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_select_own" ON trades
  FOR SELECT USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "trades_insert_own" ON trades
  FOR INSERT WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "trades_update_own" ON trades
  FOR UPDATE USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "trades_delete_own" ON trades
  FOR DELETE USING (user_id = auth.jwt()->>'sub');

-- ── push_subscriptions ───────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.jwt()->>'sub');

CREATE POLICY "push_subscriptions_update_own" ON push_subscriptions
  FOR UPDATE USING (user_id = auth.jwt()->>'sub');

CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
  FOR DELETE USING (user_id = auth.jwt()->>'sub');

-- ── go_signals ───────────────────────────────────────────────────
-- DİKKAT: bu tabloda user_id kolonu YOK — kullanıcıya özel değil, tüm
-- paritelerin global GO sinyal logu (server-side cron'un append-only
-- yazdığı bir kayıt, bkz. 003_create_go_signals.sql başlığı). "Sadece
-- ilgili kullanıcı" politikası buraya uygulanamaz çünkü sahiplik kavramı
-- yok — herhangi bir giriş yapmış kullanıcı okuyabilir, yazma sadece
-- service_role'e (zaten RLS'i bypass ediyor) açık, authenticated/anon
-- için INSERT/UPDATE/DELETE politikası TANIMLANMADI (Postgres varsayılanı:
-- politika yoksa erişim yok).
ALTER TABLE go_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "go_signals_select_authenticated" ON go_signals
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ── Not: Clerk JWT'sini Supabase Auth'a bağlamak ────────────────────
-- Bugün hiçbir kod tarayıcıdan doğrudan Supabase'e bağlanmıyor (sadece
-- server-side service_role), yani bu adım BUGÜN ZORUNLU DEĞİL. İleride
-- browser'dan doğrudan Supabase erişimi (örn. realtime subscription)
-- eklenirse gereken adımlar:
--   1. Supabase Dashboard → Authentication → Sign In / Providers →
--      Third Party Auth → Clerk ekle → Clerk Frontend API URL'ini gir
--      (bkz. /api/debug/beta-claims'te daha önce gördüğümüz "iss" değeri,
--      örn. https://native-lynx-21.clerk.accounts.dev — Clerk Dashboard →
--      API Keys → "Frontend API URL" alanından da okunabilir).
--   2. supabase-js client'ı oluştururken Clerk session token'ını
--      Authorization header'ı olarak geçir:
--        const { getToken } = useAuth(); // @clerk/nextjs
--        const supabase = createClient(url, anonKey, {
--          global: { headers: { Authorization: `Bearer ${await getToken()}` } },
--        });
--      (veya supabase-js v2.43+'daki native `accessToken` opsiyonu).
--   3. Bu kurulmadan yukarıdaki auth.jwt()->>'sub' politikaları hiçbir
--      zaman eşleşmez (anon/authenticated rolüyle gelen isteklerde
--      auth.jwt() NULL döner) — zararsız, sadece "her zaman reddet"
--      anlamına gelir, mevcut server-side akışı hiç etkilemez.
