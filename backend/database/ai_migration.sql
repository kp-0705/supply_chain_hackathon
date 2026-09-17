-- ============================================================================
-- AI EXTENSION MIGRATION
-- Run once against the existing micron_supply database.
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO NOTHING).
-- ============================================================================

-- 1. Add ai_recommendation JSONB column to demand_raw
--    Stores the full AI recommendation object:
--    { suggested_quantity, allocation_pct, confidence, reason, generated_at, ... }
--    The existing flat columns (suggested_quantity, confidence, reason) are still
--    updated for backward-compatible querying.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'demand_raw' AND column_name = 'ai_recommendation'
  ) THEN
    ALTER TABLE demand_raw ADD COLUMN ai_recommendation JSONB;
  END IF;
END $$;

-- 2. Create chatbot_messages audit table
--    Records every customer chatbot interaction for quality review and
--    future model evaluation. Does NOT expose this data back to users.
CREATE TABLE IF NOT EXISTS chatbot_messages (
  message_id  BIGSERIAL   PRIMARY KEY,
  demand_id   BIGINT      NOT NULL REFERENCES demand_raw(demand_id) ON DELETE CASCADE,
  customer_id BIGINT      NOT NULL REFERENCES customers(customer_id),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_demand    ON chatbot_messages(demand_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_customer  ON chatbot_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_created   ON chatbot_messages(created_at DESC);
