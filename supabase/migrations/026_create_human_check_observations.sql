-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — human_check_observations
-- Migration 026
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: lib/signal/humanTraderCheck.ts'in checkHumanTraderApproval()'ı
-- (S/R + hacim + R:R + trend çizgisi, 4 bağımsız AND koşulu) her "go"
-- verdict'inde hem client (useScoreEngine.ts) hem server (signalEngine.ts)
-- tarafında çağrılıyor, ama sonucu hiçbir yere KALICI olarak yazılmıyordu —
-- sadece console.debug/console.log ile anlık loglanıyor, sinyal geçtikten
-- sonra kayboluyordu. Bu tablo, cvd_vpin_observations (migration 019/020)
-- ile AYNI "gölge-gözlem" desenini takip ediyor: skor motoruna/onay
-- mantığına hiçbir etkisi yok, sadece "kaç deneme oldu, kaçı hangi kontrol
-- yüzünden reddedildi" sorusuna ileride basit bir SQL sorgusuyla cevap
-- vermek için. lib/signal/humanTraderCheck.ts'in mevcut approve/reject
-- mantığına bu migration'la HİÇ dokunulmadı.
--
-- Ayrı boolean kolonlar (tek bir "reason" string'i yerine) — her kontrol
-- BAĞIMSIZ reddedebilir (aynı anda birden fazlası tetiklenebilir), bu
-- yüzden "kaçı S/R yüzünden reddedildi" gibi bir soru
-- `count(*) FILTER (WHERE sr_rejected)` ile tek satırlık bir sorguyla
-- cevaplanabilsin diye. `reasons` (TEXT[]) ayrıca HumanTraderCheckResult'ın
-- insan-okunur gerekçe satırlarının TAMAMINI da taşıyor — booleanların
-- kaçırdığı detay (ör. gerçek R:R oranı, hangi seviyeye ne kadar yakın)
-- burada kalıyor.
--
-- source ('client' | 'server') — useScoreEngine.ts (tarayıcı, her skor
-- cycle'ında) ve signalEngine.ts (saatlik cron) BAĞIMSIZ olarak aynı GO
-- geçişini görebiliyor (farklı zamanlarda, farklı veri tazeliğiyle) —
-- analiz sırasında ikisi karıştırılmasın diye ayrı işaretleniyor.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS human_check_observations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  pair TEXT NOT NULL,
  direction TEXT NOT NULL,  -- 'LONG' | 'SHORT'
  source TEXT NOT NULL,     -- 'client' | 'server'
  approved BOOLEAN NOT NULL,
  sr_rejected BOOLEAN NOT NULL,
  volume_rejected BOOLEAN NOT NULL,
  rr_rejected BOOLEAN NOT NULL,
  rr_data_insufficient BOOLEAN NOT NULL,  -- rr_rejected'ın ALT KÜMESİ — "gerçekten kötü R:R" ile "ATR/ADX hesaplanamadı" ayrımı (CLAUDE.md §0.1 madde 3)
  trend_line_rejected BOOLEAN NOT NULL,
  reasons TEXT[]  -- HumanTraderCheckResult.reasons — tam insan-okunur detay
);

CREATE INDEX IF NOT EXISTS human_check_observations_pair_ts_idx
  ON human_check_observations (pair, created_at DESC);

-- ─── DOWN (elle çalıştırılır, otomatik değil — repodaki diğer
-- migration'larla aynı desen) ───
-- DROP TABLE IF EXISTS human_check_observations;
