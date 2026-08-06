-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — NOWPayments abonelik altyapısı
-- Migration 017
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: Türkiye'den Stripe hesabı açma engeli nedeniyle ödeme
-- entegrasyonu NOWPayments'a (kripto ödeme işlemcisi) uyarlanıyor.
-- Stripe'ın aksine NOWPayments'ta yerleşik "abonelik/otomatik yenileme"
-- yok — bu yüzden current_period_end'i biz tutuyoruz, bitince
-- /api/cron/daily-summary'ye eklenen izole bir kontrol free'ye düşürüyor
-- (bkz. o dosyadaki checkExpiredNowPaymentsSubscriptions()).
--
-- Dış değerlendirmenin önerdiği şema (last_payment_id/last_event_id ile
-- "hangi ödeme üyeliği uzattı" izlenebilir kalıyor) ve atomik işleme
-- (process_nowpayments_ipn RPC — idempotency kontrolü + event insert +
-- subscription upsert TEK transaction'da, Clerk senkronu bilerek DIŞARIDA
-- bırakıldı, webhook route'u RPC başarılı dönünce ayrı bir adım olarak
-- çağırıyor — yarıda kalırsa yeniden denenebilir).
--
-- IF NOT EXISTS ile idempotent.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nowpayments_subscriptions (
  user_id            TEXT PRIMARY KEY,
  plan               TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  status             TEXT NOT NULL DEFAULT 'inactive', -- 'inactive' | 'active' | 'expired'
  current_period_end TIMESTAMPTZ,
  last_payment_id    TEXT,
  last_event_id      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nowpayments_events (
  event_id     TEXT PRIMARY KEY,  -- NOWPayments payment_id + payment_status birleşimi (aynı payment birden fazla durum geçişi gönderir, her geçiş ayrı event)
  payment_id   TEXT NOT NULL,
  user_id      TEXT,
  status       TEXT NOT NULL,     -- NOWPayments payment_status (waiting/confirming/confirmed/finished/failed/expired/...)
  payload      JSONB NOT NULL,    -- ham IPN body — hata ayıklama için tam saklanıyor
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nowpayments_events_payment_idx ON nowpayments_events (payment_id, processed_at DESC);

-- Atomik IPN işleme: idempotency + event insert + subscription upsert TEK
-- transaction'da (bir Postgres fonksiyonunun gövdesi doğal olarak tek
-- transaction'dır). Clerk senkronu BİLEREK burada YOK — dış API çağrısı bir
-- SQL fonksiyonunun içine konulmaz, webhook route'u bu fonksiyon başarıyla
-- dönünce Clerk'i AYRI bir adım olarak çağırıyor.
--
-- p_new_plan NULL olabilir — ara durumlar (waiting/confirming/sending) için:
-- event yine kaydedilir (izlenebilirlik) AMA subscription tablosuna HİÇ
-- dokunulmaz. Bu olmadan, yenileme ödemesi henüz "confirmed" olmadan gelen
-- "waiting" IPN'i aktif bir pro kullanıcıyı yanlışlıkla free'ye düşürürdü.
--
-- Dönüş: { already_processed: boolean, plan: text } — already_processed
-- true ise webhook route Clerk senkronunu ATLAR (idempotent tekrar teslimat).
CREATE OR REPLACE FUNCTION process_nowpayments_ipn(
  p_event_id TEXT,
  p_payment_id TEXT,
  p_user_id TEXT,
  p_status TEXT,
  p_payload JSONB,
  p_new_plan TEXT,           -- 'pro' | 'free' | NULL (ara durum — plan değişmiyor)
  p_period_end TIMESTAMPTZ   -- yalnızca p_new_plan='pro' iken anlamlı
) RETURNS TABLE (already_processed BOOLEAN, plan TEXT) AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM nowpayments_events WHERE event_id = p_event_id) THEN
    RETURN QUERY SELECT TRUE, (SELECT ns.plan FROM nowpayments_subscriptions ns WHERE ns.user_id = p_user_id);
    RETURN;
  END IF;

  INSERT INTO nowpayments_events (event_id, payment_id, user_id, status, payload)
  VALUES (p_event_id, p_payment_id, p_user_id, p_status, p_payload);

  IF p_new_plan IS NULL THEN
    -- Ara durum: sadece event kaydedildi, subscription tablosuna dokunma.
    RETURN QUERY SELECT FALSE, (SELECT ns.plan FROM nowpayments_subscriptions ns WHERE ns.user_id = p_user_id);
    RETURN;
  END IF;

  INSERT INTO nowpayments_subscriptions (user_id, plan, status, current_period_end, last_payment_id, last_event_id, updated_at)
  VALUES (
    p_user_id,
    p_new_plan,
    CASE WHEN p_new_plan = 'pro' THEN 'active' ELSE 'inactive' END,
    p_period_end,
    p_payment_id,
    p_event_id,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end,
    last_payment_id = EXCLUDED.last_payment_id,
    last_event_id = EXCLUDED.last_event_id,
    updated_at = now();

  RETURN QUERY SELECT FALSE, p_new_plan;
END;
$$ LANGUAGE plpgsql;
