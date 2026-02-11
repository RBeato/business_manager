-- Umami analytics daily stats
-- Tracks pageviews, visitors, bounce rate, and breakdowns from self-hosted Umami

CREATE TABLE IF NOT EXISTS daily_umami_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  website_id VARCHAR(100) NOT NULL,
  pageviews INTEGER DEFAULT 0,
  visitors INTEGER DEFAULT 0,
  visits INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  avg_visit_duration INTEGER DEFAULT 0,
  top_pages JSONB,
  top_referrers JSONB,
  top_countries JSONB,
  top_browsers JSONB,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, date, website_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_umami_stats_date ON daily_umami_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_umami_stats_app ON daily_umami_stats(app_id, date DESC);
