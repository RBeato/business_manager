// SQLite schema for business_manager
// Migrated from Supabase/PostgreSQL migrations 001-009

export const SCHEMA_SQL = `
-- ============================================
-- CORE REGISTRY TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mobile', 'web', 'desktop', 'api')),
    platforms TEXT NOT NULL DEFAULT '[]',
    apple_app_id TEXT,
    apple_bundle_id TEXT,
    google_package_name TEXT,
    revenuecat_app_id TEXT,
    firebase_app_id TEXT,
    ga4_property_id TEXT,
    ga4_stream_id TEXT,
    description TEXT,
    icon_url TEXT,
    website_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('ai', 'infrastructure', 'analytics', 'payment', 'email', 'other')),
    api_base_url TEXT,
    api_config TEXT DEFAULT '{}',
    billing_cycle TEXT DEFAULT 'monthly',
    currency TEXT DEFAULT 'USD',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- DAILY METRICS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS daily_installs (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    country TEXT DEFAULT '',
    installs INTEGER NOT NULL DEFAULT 0,
    uninstalls INTEGER DEFAULT 0,
    updates INTEGER DEFAULT 0,
    product_page_views INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, platform, country)
);

CREATE TABLE IF NOT EXISTS daily_revenue (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'stripe')),
    country TEXT DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'USD',
    gross_revenue REAL NOT NULL DEFAULT 0,
    net_revenue REAL NOT NULL DEFAULT 0,
    refunds REAL DEFAULT 0,
    iap_revenue REAL DEFAULT 0,
    subscription_revenue REAL DEFAULT 0,
    ad_revenue REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    paying_users INTEGER DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, platform, country, currency)
);

CREATE TABLE IF NOT EXISTS daily_subscriptions (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'stripe')),
    product_id TEXT DEFAULT '',
    active_subscriptions INTEGER DEFAULT 0,
    active_trials INTEGER DEFAULT 0,
    new_trials INTEGER DEFAULT 0,
    trial_conversions INTEGER DEFAULT 0,
    trial_cancellations INTEGER DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    renewals INTEGER DEFAULT 0,
    cancellations INTEGER DEFAULT 0,
    expirations INTEGER DEFAULT 0,
    reactivations INTEGER DEFAULT 0,
    billing_retries INTEGER DEFAULT 0,
    grace_period_entries INTEGER DEFAULT 0,
    mrr REAL DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, platform, product_id)
);

CREATE TABLE IF NOT EXISTS daily_active_users (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'all')),
    dau INTEGER DEFAULT 0,
    wau INTEGER DEFAULT 0,
    mau INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    avg_session_duration_seconds INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    returning_users INTEGER DEFAULT 0,
    d1_retention REAL,
    d7_retention REAL,
    d30_retention REAL,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, platform)
);

CREATE TABLE IF NOT EXISTS daily_feature_usage (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'all')),
    feature_name TEXT NOT NULL,
    unique_users INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    started_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, platform, feature_name)
);

CREATE TABLE IF NOT EXISTS daily_provider_costs (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    app_id TEXT DEFAULT '' REFERENCES apps(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    usage_quantity REAL DEFAULT 0,
    usage_unit TEXT,
    cost_breakdown TEXT DEFAULT '{}',
    usage_breakdown TEXT DEFAULT '{}',
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider_id, app_id, date)
);

CREATE TABLE IF NOT EXISTS daily_website_traffic (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    source TEXT DEFAULT '',
    medium TEXT DEFAULT '',
    campaign TEXT DEFAULT '',
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    pageviews INTEGER DEFAULT 0,
    avg_session_duration_seconds INTEGER DEFAULT 0,
    bounce_rate REAL,
    pages_per_session REAL,
    signups INTEGER DEFAULT 0,
    app_downloads INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, source, medium, campaign)
);

CREATE TABLE IF NOT EXISTS daily_email_metrics (
    id TEXT PRIMARY KEY,
    app_id TEXT DEFAULT '' REFERENCES apps(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN ('support', 'sales', 'newsletter', 'transactional', 'other')),
    received INTEGER DEFAULT 0,
    sent INTEGER DEFAULT 0,
    tickets_opened INTEGER DEFAULT 0,
    tickets_closed INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,
    avg_resolution_time_minutes INTEGER,
    opens INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unsubscribes INTEGER DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, email_type)
);

CREATE TABLE IF NOT EXISTS daily_search_console (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    query TEXT DEFAULT '',
    page TEXT DEFAULT '',
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    position REAL DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, query, page)
);

CREATE TABLE IF NOT EXISTS daily_umami_stats (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    website_id TEXT NOT NULL,
    pageviews INTEGER DEFAULT 0,
    visitors INTEGER DEFAULT 0,
    visits INTEGER DEFAULT 0,
    bounce_rate REAL DEFAULT 0,
    avg_visit_duration INTEGER DEFAULT 0,
    top_pages TEXT,
    top_referrers TEXT,
    top_countries TEXT,
    top_browsers TEXT,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(app_id, date, website_id)
);

-- ============================================
-- REPORTS & LOGGING
-- ============================================

CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'daily',
    summary_text TEXT,
    insights TEXT DEFAULT '[]',
    metrics_snapshot TEXT NOT NULL,
    email_sent_at TEXT,
    email_recipients TEXT,
    html_content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(date, report_type)
);

CREATE TABLE IF NOT EXISTS ingestion_logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
    provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details TEXT,
    request_metadata TEXT,
    response_metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- CONTENT ENGINE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY,
    website TEXT NOT NULL CHECK (website IN ('healthopenpage', 'meditnation', 'riffroutine')),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    meta_description TEXT,
    keywords TEXT,
    target_keyword TEXT,
    seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'rejected')),
    scheduled_publish_date TEXT,
    published_date TEXT,
    ai_model TEXT DEFAULT 'deepseek-chat',
    generation_prompt TEXT,
    review_notes TEXT,
    image_url TEXT,
    word_count INTEGER,
    reading_time_minutes INTEGER,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(website, slug)
);

CREATE TABLE IF NOT EXISTS blog_topics (
    id TEXT PRIMARY KEY,
    website TEXT NOT NULL CHECK (website IN ('healthopenpage', 'meditnation', 'riffroutine')),
    topic TEXT NOT NULL,
    target_keyword TEXT,
    search_volume INTEGER,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'generated', 'published', 'skipped')),
    notes TEXT,
    category TEXT,
    related_blog_post_id TEXT REFERENCES blog_posts(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_seo_metrics (
    id TEXT PRIMARY KEY,
    blog_post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    date TEXT NOT NULL DEFAULT (date('now')),
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    average_position REAL DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(blog_post_id, date, source)
);

CREATE TABLE IF NOT EXISTS content_calendar (
    id TEXT PRIMARY KEY,
    website TEXT NOT NULL UNIQUE CHECK (website IN ('healthopenpage', 'meditnation', 'riffroutine')),
    posts_per_week INTEGER DEFAULT 2 CHECK (posts_per_week >= 0 AND posts_per_week <= 7),
    preferred_publish_days TEXT DEFAULT '["monday","thursday"]',
    preferred_publish_time TEXT DEFAULT '09:00:00',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- TELEGRAM INTEGRATION TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS telegram_actions (
    id TEXT PRIMARY KEY,
    callback_id TEXT UNIQUE NOT NULL,
    action_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telegram_notifications (
    id TEXT PRIMARY KEY,
    notification_type TEXT NOT NULL,
    target_id TEXT,
    message_id INTEGER,
    chat_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- REVENUECAT EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS revenuecat_events (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_user_id TEXT,
    product_id TEXT,
    price REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    price_in_purchased_currency REAL,
    country_code TEXT,
    store TEXT,
    environment TEXT NOT NULL DEFAULT 'PRODUCTION',
    transaction_id TEXT,
    commission_percentage REAL,
    takehome_percentage REAL,
    entitlement_ids TEXT,
    event_timestamp TEXT,
    webhook_payload TEXT NOT NULL,
    notified INTEGER DEFAULT 0,
    processed_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES (performance for date-range queries)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_daily_installs_date ON daily_installs(date);
CREATE INDEX IF NOT EXISTS idx_daily_installs_app ON daily_installs(app_id);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_date ON daily_revenue(date);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_app ON daily_revenue(app_id);
CREATE INDEX IF NOT EXISTS idx_daily_subscriptions_date ON daily_subscriptions(date);
CREATE INDEX IF NOT EXISTS idx_daily_subscriptions_app ON daily_subscriptions(app_id);
CREATE INDEX IF NOT EXISTS idx_daily_active_users_date ON daily_active_users(date);
CREATE INDEX IF NOT EXISTS idx_daily_active_users_app ON daily_active_users(app_id);
CREATE INDEX IF NOT EXISTS idx_daily_feature_usage_date ON daily_feature_usage(date);
CREATE INDEX IF NOT EXISTS idx_daily_provider_costs_date ON daily_provider_costs(date);
CREATE INDEX IF NOT EXISTS idx_daily_provider_costs_provider ON daily_provider_costs(provider_id);
CREATE INDEX IF NOT EXISTS idx_daily_website_traffic_date ON daily_website_traffic(date);
CREATE INDEX IF NOT EXISTS idx_daily_email_metrics_date ON daily_email_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_search_console_date ON daily_search_console(date);
CREATE INDEX IF NOT EXISTS idx_daily_umami_stats_date ON daily_umami_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_source ON ingestion_logs(source);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_date ON ingestion_logs(date);
CREATE INDEX IF NOT EXISTS idx_blog_posts_website ON blog_posts(website);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_topics_website ON blog_topics(website);
CREATE INDEX IF NOT EXISTS idx_blog_topics_status ON blog_topics(status);
CREATE INDEX IF NOT EXISTS idx_telegram_actions_target ON telegram_actions(target_id);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_type ON telegram_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_revenuecat_events_type ON revenuecat_events(event_type);
CREATE INDEX IF NOT EXISTS idx_revenuecat_events_app ON revenuecat_events(app_id);

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW IF NOT EXISTS portfolio_daily_summary AS
SELECT
    di.date,
    COUNT(DISTINCT di.app_id) as apps_with_installs,
    SUM(di.installs) as total_installs,
    (SELECT SUM(dr.gross_revenue) FROM daily_revenue dr WHERE dr.date = di.date) as total_revenue,
    (SELECT SUM(dau_t.dau) FROM daily_active_users dau_t WHERE dau_t.date = di.date AND dau_t.platform = 'all') as total_dau,
    (SELECT SUM(dpc.cost) FROM daily_provider_costs dpc WHERE dpc.date = di.date) as total_costs
FROM daily_installs di
GROUP BY di.date
ORDER BY di.date DESC;

CREATE VIEW IF NOT EXISTS app_health AS
SELECT
    a.id,
    a.slug,
    a.name,
    (SELECT SUM(di.installs) FROM daily_installs di WHERE di.app_id = a.id AND di.date >= date('now', '-7 days')) as installs_7d,
    (SELECT SUM(dr.gross_revenue) FROM daily_revenue dr WHERE dr.app_id = a.id AND dr.date >= date('now', '-7 days')) as revenue_7d,
    (SELECT AVG(dau.dau) FROM daily_active_users dau WHERE dau.app_id = a.id AND dau.date >= date('now', '-7 days') AND dau.platform = 'all') as avg_dau_7d,
    (SELECT SUM(ds.mrr) FROM daily_subscriptions ds WHERE ds.app_id = a.id AND ds.date = date('now', '-1 day')) as current_mrr
FROM apps a
WHERE a.is_active = 1;

-- ============================================
-- TRIGGERS (auto-update updated_at)
-- ============================================

CREATE TRIGGER IF NOT EXISTS apps_updated_at
AFTER UPDATE ON apps
BEGIN
    UPDATE apps SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS providers_updated_at
AFTER UPDATE ON providers
BEGIN
    UPDATE providers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS blog_posts_updated_at
AFTER UPDATE ON blog_posts
BEGIN
    UPDATE blog_posts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS blog_topics_updated_at
AFTER UPDATE ON blog_topics
BEGIN
    UPDATE blog_topics SET updated_at = datetime('now') WHERE id = NEW.id;
END;
`;
