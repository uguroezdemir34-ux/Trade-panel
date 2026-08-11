-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — VIP Telegram davet linki
-- Migration 023 — vip_telegram_invites
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: Pro abonelik satın alan kullanıcıya, ayrı/özel bir "VIP"
-- Telegram grubuna tek kullanımlık bir davet linki üretilir (Stripe
-- webhook → Telegram createChatInviteLink, bkz.
-- lib/notify/telegram/vipInvite.ts). Bu tablo o linki userId başına
-- SAKLAR — checkout.session.completed / customer.subscription.updated
-- webhook'u idempotent kalsın diye (aynı kullanıcı için ikinci kez
-- tetiklendiğinde yeni link ÜRETİLMEZ, var olan okunur).
--
-- member_limit=1 ile üretildiği için link zaten tek kullanımlık —
-- paylaşılsa bile ikinci kişi giremez. Abonelik iptal olduğunda linki
-- SİLMİYORUZ/grup üyeliğini geri almıyoruz (bkz. lib/notify/telegram/
-- vipInvite.ts dosya başı notu — kapsam dışı, ayrı bir görev).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vip_telegram_invites (
  user_id     TEXT        PRIMARY KEY,  -- Clerk userId
  invite_link TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 011/019'daki hatadan ders alındı (bkz. 012/020 düzeltmeleri) — bu kez
-- RLS baştan açık, hiç kapalı bırakılmadı:
ALTER TABLE vip_telegram_invites ENABLE ROW LEVEL SECURITY;
-- Bilerek anon/authenticated için hiçbir policy tanımlanmıyor (Postgres
-- varsayılanı: policy yoksa erişim yok) — service_role RLS'i her zaman
-- bypass eder, tek okuyucu app/api/vip-invite/route.ts server-side.

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- DROP TABLE IF EXISTS vip_telegram_invites;
