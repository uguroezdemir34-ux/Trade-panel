-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — score_history: her cron çalışmasında her pair için ham
-- skor snapshot'ı (GO/NO fark etmeksizin)
-- Migration 009
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
--
-- Bağlam: go_signals (003_create_go_signals.sql) SADECE GO geçişlerini
-- (append-only, isNewSignal filtresinden geçenler) tutuyor — bloklanan/
-- eşiği geçemeyen sinyaller hiç yazılmıyor. Bu, "trending_strong rejimde
-- composite overextended'e takılıp NO'ya düşen kaç sinyal var, bunlar
-- sonradan nasıl hareket etti" gibi soruları CEVAPSIZ bırakıyor çünkü o
-- veri hiç var olmuyor (chat'te tartışıldı, bkz. RSI/regime araştırması).
--
-- score_history bunu tamamlar: app/api/cron/signal-check/route.ts zaten
-- saatte bir TÜM pariteler için computeScore() çalıştırıyor (bkz.
-- lib/server/signalEngine.ts computeAllSignals) — bu migration, o mevcut
-- hesaplamanın sonucunu (verdict ne olursa olsun) ayrıca bu tabloya da
-- yazan bir ek adım için şema sağlıyor. Skor hesaplama mantığının
-- KENDİSİ değişmiyor — sadece zaten hesaplanan değerler ek olarak
-- loglanıyor.
--
-- overext_flags: lib/score/orchestrator.ts'in ScoreResult.overextFlags
-- alanı — checkOverextended() (lib/score/blocks.ts) tetiklenmediyse 0,
-- tetiklendiyse (yani 2+ flag birleştiyse, blocks.ts:126 "flags.length>=2"
-- eşiği) flag sayısı (>=2). Ayrı bir "hangi hard block tetiklendi" hesabı
-- BURADA YAPILMIYOR — orchestrator.ts zaten hesaplamış olan alan aynen
-- taşınıyor, lib/score/*'a hiçbir değişiklik gerekmedi.
--
-- Fiyat/outcome takibi (bloklanan bir sinyal "gerçekten kaçırıldı mı"
-- sorusu) bu migration'ın KAPSAMI DIŞINDA — kullanıcı onayıyla ayrı bir
-- turda ele alınacak (bkz. go_signals'taki outcome_15m/outcome_1h deseni,
-- migration 008).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS score_history (
  id                  TEXT PRIMARY KEY,          -- pair_signalTs (bkz. go_signals'taki pair_direction_signalTs deseni — burada direction yön değiştirse bile aynı bar için TEK satır isteniyor)
  pair                TEXT        NOT NULL,
  direction           TEXT        NOT NULL,
  verdict             TEXT        NOT NULL,
  score               INTEGER     NOT NULL,
  base_score          NUMERIC     NOT NULL,       -- bonus/modifier ÖNCESİ ham skor (orchestrator.ts ScoreResult.baseScore)
  effective_threshold INTEGER,
  regime              TEXT,
  sweep_bonus         INTEGER     NOT NULL DEFAULT 0,
  regime_bonus        INTEGER     NOT NULL DEFAULT 0,
  overext_flags       INTEGER     NOT NULL DEFAULT 0,  -- 0 = checkOverextended tetiklenmedi, >=2 = tetiklendi (flag sayısı)
  blocks              TEXT[]      NOT NULL DEFAULT '{}',
  soft_blocks         TEXT[]      NOT NULL DEFAULT '{}',
  price               NUMERIC(24,8) NOT NULL,
  signal_ts           BIGINT      NOT NULL,      -- kapanmış bar timestamp'i (ms) — go_signals.signal_ts ile aynı semantik
  engine_version      TEXT        NOT NULL,
  sub_trend           INTEGER     NOT NULL DEFAULT 0,
  sub_adx             INTEGER     NOT NULL DEFAULT 0,
  sub_rsi             INTEGER     NOT NULL DEFAULT 0,
  sub_volume          INTEGER     NOT NULL DEFAULT 0,
  sub_bb              INTEGER     NOT NULL DEFAULT 0,
  sub_vwap            INTEGER     NOT NULL DEFAULT 0,
  sub_funding         INTEGER     NOT NULL DEFAULT 0,
  sub_macro           INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS score_history_pair_ts_idx        ON score_history (pair, signal_ts DESC);
CREATE INDEX IF NOT EXISTS score_history_regime_idx         ON score_history (regime, signal_ts DESC);
CREATE INDEX IF NOT EXISTS score_history_overext_idx        ON score_history (overext_flags) WHERE overext_flags > 0;

-- ── RLS ─────────────────────────────────────────────────────────────
-- go_signals ile aynı desen (004_rls_policies.sql) — kullanıcıya özel
-- değil, global bir skor logu. Yazma sadece service_role'e (zaten RLS'i
-- bypass ediyor), authenticated/anon için sadece SELECT.
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_history_select_authenticated" ON score_history;
CREATE POLICY "score_history_select_authenticated" ON score_history
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
