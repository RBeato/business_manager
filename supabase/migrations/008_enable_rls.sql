-- Enable Row Level Security on all public tables.
-- service_role bypasses RLS automatically in Supabase.
-- anon role gets read access (dashboard) and write access on content tables.
-- Idempotent: drops existing policies before recreating.

-- ============================================
-- STEP 1: Enable RLS on all tables
-- ============================================

ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_active_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_provider_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_website_traffic ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_email_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_search_console ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_umami_stats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop existing policies (idempotent)
-- ============================================

DROP POLICY IF EXISTS "anon_read_apps" ON apps;
DROP POLICY IF EXISTS "anon_read_providers" ON providers;
DROP POLICY IF EXISTS "anon_read_daily_installs" ON daily_installs;
DROP POLICY IF EXISTS "anon_read_daily_revenue" ON daily_revenue;
DROP POLICY IF EXISTS "anon_read_daily_subscriptions" ON daily_subscriptions;
DROP POLICY IF EXISTS "anon_read_daily_active_users" ON daily_active_users;
DROP POLICY IF EXISTS "anon_read_daily_feature_usage" ON daily_feature_usage;
DROP POLICY IF EXISTS "anon_read_daily_provider_costs" ON daily_provider_costs;
DROP POLICY IF EXISTS "anon_read_daily_website_traffic" ON daily_website_traffic;
DROP POLICY IF EXISTS "anon_read_daily_email_metrics" ON daily_email_metrics;
DROP POLICY IF EXISTS "anon_read_daily_reports" ON daily_reports;
DROP POLICY IF EXISTS "anon_read_daily_search_console" ON daily_search_console;
DROP POLICY IF EXISTS "anon_read_daily_umami_stats" ON daily_umami_stats;
DROP POLICY IF EXISTS "anon_read_blog_posts" ON blog_posts;
DROP POLICY IF EXISTS "anon_write_blog_posts" ON blog_posts;
DROP POLICY IF EXISTS "anon_update_blog_posts" ON blog_posts;
DROP POLICY IF EXISTS "anon_read_blog_topics" ON blog_topics;
DROP POLICY IF EXISTS "anon_update_blog_topics" ON blog_topics;
DROP POLICY IF EXISTS "anon_read_blog_seo_metrics" ON blog_seo_metrics;
DROP POLICY IF EXISTS "anon_read_content_calendar" ON content_calendar;

-- ============================================
-- STEP 3: Create policies for anon (dashboard)
-- ============================================

-- Registry tables
CREATE POLICY "anon_read_apps" ON apps FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_providers" ON providers FOR SELECT TO anon USING (true);

-- Daily metrics tables (dashboard reads these)
CREATE POLICY "anon_read_daily_installs" ON daily_installs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_revenue" ON daily_revenue FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_subscriptions" ON daily_subscriptions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_active_users" ON daily_active_users FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_feature_usage" ON daily_feature_usage FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_provider_costs" ON daily_provider_costs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_website_traffic" ON daily_website_traffic FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_email_metrics" ON daily_email_metrics FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_reports" ON daily_reports FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_search_console" ON daily_search_console FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_daily_umami_stats" ON daily_umami_stats FOR SELECT TO anon USING (true);

-- Content tables (dashboard reads + writes via API routes)
CREATE POLICY "anon_read_blog_posts" ON blog_posts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_blog_posts" ON blog_posts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_blog_posts" ON blog_posts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_blog_topics" ON blog_topics FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_blog_topics" ON blog_topics FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_blog_seo_metrics" ON blog_seo_metrics FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_content_calendar" ON content_calendar FOR SELECT TO anon USING (true);

-- Telegram tables: no anon access (webhook uses service_role)
-- Ingestion logs: no anon access

-- ============================================
-- STEP 4: Fix SECURITY DEFINER views
-- ============================================

CREATE OR REPLACE VIEW portfolio_daily_summary
WITH (security_invoker = true)
AS
SELECT
    date,
    COUNT(DISTINCT di.app_id) as apps_with_installs,
    SUM(di.installs) as total_installs,
    (SELECT SUM(gross_revenue) FROM daily_revenue dr WHERE dr.date = di.date) as total_revenue,
    (SELECT SUM(dau) FROM daily_active_users dau_t WHERE dau_t.date = di.date AND dau_t.platform = 'all') as total_dau,
    (SELECT SUM(cost) FROM daily_provider_costs dpc WHERE dpc.date = di.date) as total_costs
FROM daily_installs di
GROUP BY date
ORDER BY date DESC;

CREATE OR REPLACE VIEW app_health
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.slug,
    a.name,
    (SELECT SUM(installs) FROM daily_installs di WHERE di.app_id = a.id AND di.date >= CURRENT_DATE - 7) as installs_7d,
    (SELECT SUM(gross_revenue) FROM daily_revenue dr WHERE dr.app_id = a.id AND dr.date >= CURRENT_DATE - 7) as revenue_7d,
    (SELECT AVG(dau) FROM daily_active_users dau WHERE dau.app_id = a.id AND dau.date >= CURRENT_DATE - 7 AND dau.platform = 'all') as avg_dau_7d,
    (SELECT SUM(mrr) FROM daily_subscriptions ds WHERE ds.app_id = a.id AND ds.date = CURRENT_DATE - 1) as current_mrr
FROM apps a
WHERE a.is_active = true;
