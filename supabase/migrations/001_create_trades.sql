-- ═══════════════════════════════════════════════════════════════════
-- QUANTIX OS — Trade History Schema
-- Migration 001 — Initial trades table
--
-- Apply via: Supabase Dashboard → SQL Editor → run this script
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trades (
  -- Primary key — matches TradeSnapshot.id (pair_direction_timestamp format)
  id            TEXT        PRIMARY KEY,

  -- Owner — Clerk userId (e.g. "user_2abc...")
  user_id       TEXT        NOT NULL,

  -- Queryable fields (indexed for fast P&L queries)
  pair          TEXT        NOT NULL,
  direction     TEXT        NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  status        TEXT        NOT NULL CHECK (status IN ('pending', 'open', 'closed')),
  is_paper      BOOLEAN     NOT NULL DEFAULT false,
  opened_at     BIGINT      NOT NULL,     -- epoch ms
  closed_at     BIGINT,                   -- epoch ms, NULL until closed
  pnl_usd       NUMERIC(16, 4),
  r_multiple    NUMERIC(8,  4),

  -- Full TradeSnapshot object — source of truth for P&L analytics
  snapshot      JSONB       NOT NULL,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index: fast lookup for a user's closed trades sorted by date
CREATE INDEX IF NOT EXISTS trades_user_closed_idx
  ON trades (user_id, closed_at DESC NULLS LAST);

-- Index: fast lookup by status (open positions)
CREATE INDEX IF NOT EXISTS trades_user_status_idx
  ON trades (user_id, status);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trades_updated_at ON trades;
CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Notes ──────────────────────────────────────────────────────────
-- RLS is NOT used here — authentication is enforced server-side via
-- Clerk in Next.js API routes using the service role key.
-- The service role key is NEVER exposed to the browser.
-- ───────────────────────────────────────────────────────────────────
