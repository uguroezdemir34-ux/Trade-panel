-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — nowpayments_subscriptions: source kolonu
-- Migration 022
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: referral ödül kredisi (davet eden kişi arkadaşı ödeme
-- yaptığında 1 ay Pro kazanır) mevcut nowpayments_subscriptions
-- tablosuna current_period_end uzatarak yazılacak — YENİ bir tablo/cron
-- açmak yerine mevcut günlük süre-dolum kontrolünü (bkz.
-- lib/billing/subscriptionCheck.ts) aynen tekrar kullanmak için. Bu
-- kolon, ileride biri "neden bu kullanıcı hiç ödeme yapmadan pro
-- görünüyor" diye sorduğunda gerçek ödeme (process_nowpayments_ipn
-- RPC'si) ile referral kredisini (yeni, ayrı bir yazma yolu) ayırt
-- edebilmek için — process_nowpayments_ipn RPC'sinin GÖVDESİNE
-- dokunulmuyor, bu kolonu o RPC doldurmuyor (varsayılan 'payment' kalır),
-- referral kredi yolu ayrı bir UPDATE/UPSERT ile 'referral_credit' yazacak.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE nowpayments_subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'payment';
-- Değerler: 'payment' (process_nowpayments_ipn RPC — gerçek ödeme) |
-- 'referral_credit' (referral ödülü — bkz. lib/referral/grantCredit.ts,
-- ayrı görev)

-- ─── DOWN (elle çalıştırılır, otomatik değil) ───
-- ALTER TABLE nowpayments_subscriptions DROP COLUMN IF EXISTS source;
