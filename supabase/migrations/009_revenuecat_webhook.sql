-- RevenueCat Webhook Events
-- Stores real-time purchase/subscription events from RevenueCat webhooks
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS revenuecat_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text UNIQUE NOT NULL,                    -- RevenueCat event ID (idempotency key)
  event_type text NOT NULL,                          -- INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
  app_id text NOT NULL,                              -- RevenueCat app_id
  app_user_id text,                                  -- RevenueCat user ID
  product_id text,                                   -- e.g. "lifetime_access", "monthly_pro"
  price numeric(12,2) DEFAULT 0,                     -- Price amount
  currency text DEFAULT 'USD',                       -- Currency code
  price_in_purchased_currency numeric(12,2),         -- Price in buyer's currency
  country_code text,                                 -- US, PT, etc.
  store text,                                        -- APP_STORE, PLAY_STORE
  environment text NOT NULL DEFAULT 'PRODUCTION',    -- PRODUCTION or SANDBOX
  transaction_id text,                               -- original_transaction_id
  commission_percentage numeric(5,4),                -- e.g. 0.1500
  takehome_percentage numeric(5,4),                  -- e.g. 0.8500
  entitlement_ids text[],                            -- Array of entitlement names
  event_timestamp timestamptz,                       -- When the event occurred in RevenueCat
  webhook_payload jsonb NOT NULL,                    -- Full raw payload for debugging
  notified boolean DEFAULT false,                    -- Whether Telegram notification was sent
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rc_events_type ON revenuecat_events (event_type);
CREATE INDEX IF NOT EXISTS idx_rc_events_app ON revenuecat_events (app_id);
CREATE INDEX IF NOT EXISTS idx_rc_events_env ON revenuecat_events (environment);
CREATE INDEX IF NOT EXISTS idx_rc_events_created ON revenuecat_events (created_at DESC);

-- RLS: service_role for writes (webhook), anon read for dashboard
ALTER TABLE revenuecat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_revenuecat_events" ON revenuecat_events
  FOR SELECT TO anon USING (true);
