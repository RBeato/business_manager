-- Content Engine: Automated Blog Post Generation System
-- Created: 2026-02-06

-- Blog posts table: Stores generated and published content
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  website TEXT NOT NULL CHECK (website IN ('healthopenpage', 'meditnation', 'riffroutine')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL, -- Full markdown content
  meta_description TEXT,
  keywords TEXT[],
  target_keyword TEXT,
  seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected')),
  scheduled_publish_date TIMESTAMPTZ,
  published_date TIMESTAMPTZ,
  ai_model TEXT DEFAULT 'deepseek-chat',
  generation_prompt TEXT, -- Store prompt for reproducibility
  review_notes TEXT, -- Admin feedback
  image_url TEXT, -- Featured image
  word_count INTEGER,
  reading_time_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website, slug)
);

-- Content calendar: Publishing schedule per website
CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  website TEXT NOT NULL UNIQUE CHECK (website IN ('healthopenpage', 'meditnation', 'riffroutine')),
  posts_per_week INTEGER DEFAULT 2 CHECK (posts_per_week >= 0 AND posts_per_week <= 7),
  preferred_publish_days TEXT[] DEFAULT ARRAY['monday', 'thursday'], -- Day names lowercase
  preferred_publish_time TIME DEFAULT '09:00:00',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog topics: Queue of topics to generate
CREATE TABLE IF NOT EXISTS blog_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  website TEXT NOT NULL CHECK (website IN ('healthopenpage', 'meditnation', 'riffroutine')),
  topic TEXT NOT NULL,
  target_keyword TEXT,
  search_volume INTEGER, -- Monthly searches
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=low, 10=high
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'generated', 'published', 'skipped')),
  notes TEXT,
  category TEXT, -- e.g., 'lab-analysis', 'famous-guitarists', 'meditation-techniques'
  related_blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO performance tracking
CREATE TABLE IF NOT EXISTS blog_seo_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0, -- Click-through rate
  average_position DECIMAL(5,2) DEFAULT 0,
  source TEXT DEFAULT 'manual', -- 'gsc', 'manual', 'estimated'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blog_post_id, date, source)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_website ON blog_posts(website);
CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled ON blog_posts(scheduled_publish_date) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_blog_topics_status ON blog_topics(website, status);
CREATE INDEX IF NOT EXISTS idx_blog_topics_priority ON blog_topics(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_blog_seo_metrics_date ON blog_seo_metrics(blog_post_id, date DESC);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_calendar_updated_at BEFORE UPDATE ON content_calendar
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_topics_updated_at BEFORE UPDATE ON blog_topics
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed initial content calendars
INSERT INTO content_calendar (website, posts_per_week, preferred_publish_days, preferred_publish_time)
VALUES
  ('healthopenpage', 2, ARRAY['monday', 'thursday'], '09:00:00'),
  ('meditnation', 1, ARRAY['wednesday'], '10:00:00'),
  ('riffroutine', 3, ARRAY['monday', 'wednesday', 'friday'], '08:00:00')
ON CONFLICT (website) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE blog_posts IS 'AI-generated blog posts with review workflow';
COMMENT ON TABLE content_calendar IS 'Publishing schedule configuration per website';
COMMENT ON TABLE blog_topics IS 'Queue of blog topics to be generated';
COMMENT ON TABLE blog_seo_metrics IS 'SEO performance tracking per post';
COMMENT ON COLUMN blog_posts.status IS 'draft -> pending_review -> approved -> published | rejected';
COMMENT ON COLUMN blog_posts.seo_score IS 'Keyword optimization score (0-100)';
COMMENT ON COLUMN blog_topics.priority IS '1=low priority, 10=urgent';
