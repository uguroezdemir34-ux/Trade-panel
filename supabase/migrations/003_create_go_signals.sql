-- GO signal log — append-only, server-side cron writes (no user scope).
-- Dedup key: pair_direction_signalTs (last closed candle timestamp in ms).
-- Cron retries are idempotent: same key → merge-duplicates upsert is a no-op.

CREATE TABLE IF NOT EXISTS go_signals (
  id                  TEXT PRIMARY KEY,          -- pair_direction_signalTs
  pair                TEXT        NOT NULL,
  direction           TEXT        NOT NULL,
  score               INTEGER     NOT NULL,
  effective_threshold INTEGER,
  trigger_price       NUMERIC(24,8) NOT NULL,
  signal_ts           BIGINT      NOT NULL,      -- closed candle timestamp (ms)
  pullback_active     BOOLEAN     NOT NULL DEFAULT false,
  regime              TEXT,
  sweep_bonus         INTEGER     NOT NULL DEFAULT 0,
  regime_bonus        INTEGER     NOT NULL DEFAULT 0,
  blocks              TEXT[]      NOT NULL DEFAULT '{}',
  soft_blocks         TEXT[]      NOT NULL DEFAULT '{}',
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

CREATE INDEX IF NOT EXISTS go_signals_pair_ts_idx      ON go_signals (pair, signal_ts DESC);
CREATE INDEX IF NOT EXISTS go_signals_engine_idx       ON go_signals (engine_version, signal_ts DESC);
