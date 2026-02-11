-- Fix: PostgreSQL UNIQUE constraints treat NULL != NULL, which breaks upserts.
-- Every ingestion run was creating DUPLICATE rows instead of updating existing ones.
-- This migration:
-- 1. Removes duplicate rows (keeps only the latest per unique key)
-- 2. Updates NULL sentinel columns to empty strings
-- 3. Recreates UNIQUE constraints with NULLS NOT DISTINCT (PostgreSQL 15+)

-- ============================================
-- STEP 1: Clean up duplicate rows
-- ============================================

-- daily_revenue: Remove duplicates where country IS NULL
DELETE FROM daily_revenue a
USING daily_revenue b
WHERE a.id < b.id
  AND a.app_id = b.app_id
  AND a.date = b.date
  AND a.platform = b.platform
  AND a.currency = b.currency
  AND a.country IS NOT DISTINCT FROM b.country;

-- daily_subscriptions: Remove duplicates where product_id IS NULL
DELETE FROM daily_subscriptions a
USING daily_subscriptions b
WHERE a.id < b.id
  AND a.app_id = b.app_id
  AND a.date = b.date
  AND a.platform = b.platform
  AND a.product_id IS NOT DISTINCT FROM b.product_id;

-- daily_installs: Remove duplicates where country IS NULL
DELETE FROM daily_installs a
USING daily_installs b
WHERE a.id < b.id
  AND a.app_id = b.app_id
  AND a.date = b.date
  AND a.platform = b.platform
  AND a.country IS NOT DISTINCT FROM b.country;

-- daily_provider_costs: Remove duplicates where app_id IS NULL
DELETE FROM daily_provider_costs a
USING daily_provider_costs b
WHERE a.id < b.id
  AND a.provider_id = b.provider_id
  AND a.date = b.date
  AND a.app_id IS NOT DISTINCT FROM b.app_id;

-- daily_website_traffic: Remove duplicates where source/medium/campaign IS NULL
DELETE FROM daily_website_traffic a
USING daily_website_traffic b
WHERE a.id < b.id
  AND a.app_id = b.app_id
  AND a.date = b.date
  AND a.source IS NOT DISTINCT FROM b.source
  AND a.medium IS NOT DISTINCT FROM b.medium
  AND a.campaign IS NOT DISTINCT FROM b.campaign;

-- daily_email_metrics: Remove duplicates where app_id IS NULL
DELETE FROM daily_email_metrics a
USING daily_email_metrics b
WHERE a.id < b.id
  AND a.date = b.date
  AND a.email_type = b.email_type
  AND a.app_id IS NOT DISTINCT FROM b.app_id;

-- daily_search_console: Remove duplicates where query/page IS NULL
DELETE FROM daily_search_console a
USING daily_search_console b
WHERE a.id < b.id
  AND a.app_id = b.app_id
  AND a.date = b.date
  AND a.query IS NOT DISTINCT FROM b.query
  AND a.page IS NOT DISTINCT FROM b.page;

-- ============================================
-- STEP 2: Convert NULL values to empty strings
-- (for VARCHAR columns used in UNIQUE constraints)
-- ============================================

UPDATE daily_revenue SET country = '' WHERE country IS NULL;
UPDATE daily_subscriptions SET product_id = '' WHERE product_id IS NULL;
UPDATE daily_installs SET country = '' WHERE country IS NULL;
UPDATE daily_website_traffic SET source = '' WHERE source IS NULL;
UPDATE daily_website_traffic SET medium = '' WHERE medium IS NULL;
UPDATE daily_website_traffic SET campaign = '' WHERE campaign IS NULL;
UPDATE daily_search_console SET query = '' WHERE query IS NULL;
UPDATE daily_search_console SET page = '' WHERE page IS NULL;

-- ============================================
-- STEP 3: Recreate UNIQUE constraints with NULLS NOT DISTINCT
-- (for UUID columns like app_id that must remain nullable)
-- ============================================

-- daily_provider_costs: app_id can be NULL (shared costs)
ALTER TABLE daily_provider_costs
  DROP CONSTRAINT IF EXISTS daily_provider_costs_provider_id_app_id_date_key;
ALTER TABLE daily_provider_costs
  ADD CONSTRAINT daily_provider_costs_provider_id_app_id_date_key
  UNIQUE NULLS NOT DISTINCT (provider_id, app_id, date);

-- daily_email_metrics: app_id can be NULL (company-wide)
ALTER TABLE daily_email_metrics
  DROP CONSTRAINT IF EXISTS daily_email_metrics_app_id_date_email_type_key;
ALTER TABLE daily_email_metrics
  ADD CONSTRAINT daily_email_metrics_app_id_date_email_type_key
  UNIQUE NULLS NOT DISTINCT (app_id, date, email_type);
