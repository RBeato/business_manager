-- Google Search Console daily metrics
-- Tracks impressions, clicks, CTR, and position by query and page

CREATE TABLE IF NOT EXISTS daily_search_console (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  query VARCHAR(500),        -- NULL for aggregate
  page VARCHAR(500),         -- NULL for aggregate
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  position DECIMAL(5,2) DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, date, query, page)
);

CREATE INDEX IF NOT EXISTS idx_daily_search_console_date ON daily_search_console(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_search_console_app ON daily_search_console(app_id, date DESC);
