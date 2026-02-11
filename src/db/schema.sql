-- Business Metrics Hub Database Schema
-- Run this against your Supabase PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- REGISTRY TABLES
-- ============================================

-- Apps registry - all tracked applications
CREATE TABLE IF NOT EXISTS apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mobile', 'web', 'desktop', 'api')),
    platforms JSONB NOT NULL DEFAULT '[]', -- ["ios", "android", "web"]

    -- App store identifiers
    apple_app_id VARCHAR(50),
    apple_bundle_id VARCHAR(255),
    google_package_name VARCHAR(255),

    -- RevenueCat
    revenuecat_app_id VARCHAR(100),

    -- Firebase/Analytics
    firebase_app_id VARCHAR(100),
    ga4_property_id VARCHAR(50),
    ga4_stream_id VARCHAR(50),

    -- Metadata
    description TEXT,
    icon_url VARCHAR(500),
    website_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service providers registry (AI, infrastructure, etc.)
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('ai', 'infrastructure', 'analytics', 'payment', 'email', 'other')),

    -- API configuration (encrypted in practice)
    api_base_url VARCHAR(500),
    api_config JSONB DEFAULT '{}',

    -- Cost tracking
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- daily, monthly, usage
    currency VARCHAR(3) DEFAULT 'USD',

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DAILY METRICS TABLES
-- ============================================

-- Daily app installs by platform and country
CREATE TABLE IF NOT EXISTS daily_installs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    country VARCHAR(2), -- ISO 3166-1 alpha-2, NULL for aggregate

    -- Install metrics
    installs INTEGER NOT NULL DEFAULT 0,
    uninstalls INTEGER DEFAULT 0,
    updates INTEGER DEFAULT 0,

    -- Impressions/views
    product_page_views INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,

    -- Raw data for debugging
    raw_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, platform, country)
);

-- Daily revenue by app, platform, and country
CREATE TABLE IF NOT EXISTS daily_revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'stripe')),
    country VARCHAR(2), -- NULL for aggregate
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Revenue breakdown
    gross_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    net_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0, -- after store fees
    refunds DECIMAL(12, 2) DEFAULT 0,

    -- Revenue by type
    iap_revenue DECIMAL(12, 2) DEFAULT 0, -- one-time IAP
    subscription_revenue DECIMAL(12, 2) DEFAULT 0,
    ad_revenue DECIMAL(12, 2) DEFAULT 0,

    -- Transaction counts
    transaction_count INTEGER DEFAULT 0,
    paying_users INTEGER DEFAULT 0,

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, platform, country, currency)
);

-- Daily subscription events (trials, conversions, cancellations)
CREATE TABLE IF NOT EXISTS daily_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'stripe')),
    product_id VARCHAR(255), -- specific subscription product, NULL for aggregate

    -- Active counts (snapshot at end of day)
    active_subscriptions INTEGER DEFAULT 0,
    active_trials INTEGER DEFAULT 0,

    -- Flow metrics (events during the day)
    new_trials INTEGER DEFAULT 0,
    trial_conversions INTEGER DEFAULT 0,
    trial_cancellations INTEGER DEFAULT 0,

    new_subscriptions INTEGER DEFAULT 0, -- direct, no trial
    renewals INTEGER DEFAULT 0,
    cancellations INTEGER DEFAULT 0,
    expirations INTEGER DEFAULT 0,
    reactivations INTEGER DEFAULT 0,

    -- Billing issues
    billing_retries INTEGER DEFAULT 0,
    grace_period_entries INTEGER DEFAULT 0,

    -- MRR snapshot (USD)
    mrr DECIMAL(12, 2) DEFAULT 0,

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, platform, product_id)
);

-- Daily active users metrics
CREATE TABLE IF NOT EXISTS daily_active_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'all')),

    -- Active user counts
    dau INTEGER DEFAULT 0, -- daily active users
    wau INTEGER DEFAULT 0, -- weekly active (users active in last 7 days)
    mau INTEGER DEFAULT 0, -- monthly active (users active in last 30 days)

    -- Session metrics
    sessions INTEGER DEFAULT 0,
    avg_session_duration_seconds INTEGER DEFAULT 0,

    -- New vs returning
    new_users INTEGER DEFAULT 0,
    returning_users INTEGER DEFAULT 0,

    -- Retention cohort data
    d1_retention DECIMAL(5, 2), -- % retained after 1 day
    d7_retention DECIMAL(5, 2),
    d30_retention DECIMAL(5, 2),

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, platform)
);

-- Daily feature usage analytics
CREATE TABLE IF NOT EXISTS daily_feature_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'all')),
    feature_name VARCHAR(255) NOT NULL,

    -- Usage counts
    unique_users INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,

    -- Funnel/conversion (optional)
    started_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, platform, feature_name)
);

-- Daily provider costs (AI, infrastructure, etc.)
CREATE TABLE IF NOT EXISTS daily_provider_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    app_id UUID REFERENCES apps(id) ON DELETE SET NULL, -- NULL for shared costs
    date DATE NOT NULL,

    -- Cost
    cost DECIMAL(12, 4) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Usage (provider-specific)
    usage_quantity DECIMAL(18, 6) DEFAULT 0,
    usage_unit VARCHAR(50), -- tokens, characters, requests, seconds, GB, etc.

    -- Breakdown by operation type
    cost_breakdown JSONB DEFAULT '{}', -- {"input_tokens": 1.50, "output_tokens": 3.00}
    usage_breakdown JSONB DEFAULT '{}', -- {"input_tokens": 100000, "output_tokens": 50000}

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(provider_id, app_id, date)
);

-- Daily website traffic (GA4)
CREATE TABLE IF NOT EXISTS daily_website_traffic (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    source VARCHAR(100), -- organic, direct, referral, etc. NULL for total
    medium VARCHAR(100),
    campaign VARCHAR(255),

    -- Traffic metrics
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    pageviews INTEGER DEFAULT 0,

    -- Engagement
    avg_session_duration_seconds INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5, 2),
    pages_per_session DECIMAL(5, 2),

    -- Conversions
    signups INTEGER DEFAULT 0,
    app_downloads INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, source, medium, campaign)
);

-- Daily email metrics (support, leads, newsletters)
CREATE TABLE IF NOT EXISTS daily_email_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID REFERENCES apps(id) ON DELETE SET NULL, -- NULL for company-wide
    date DATE NOT NULL,
    email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('support', 'sales', 'newsletter', 'transactional', 'other')),

    -- Volume
    received INTEGER DEFAULT 0,
    sent INTEGER DEFAULT 0,

    -- Support-specific
    tickets_opened INTEGER DEFAULT 0,
    tickets_closed INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,
    avg_resolution_time_minutes INTEGER,

    -- Newsletter/marketing
    opens INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unsubscribes INTEGER DEFAULT 0,

    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_id, date, email_type)
);

-- Google Search Console daily metrics
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

-- Umami analytics daily stats
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

-- ============================================
-- REPORTS & LOGGING
-- ============================================

-- Daily generated reports archive
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    report_type VARCHAR(50) NOT NULL DEFAULT 'daily', -- daily, weekly, monthly

    -- Report content
    summary_text TEXT, -- AI-generated summary
    insights JSONB DEFAULT '[]', -- array of insight objects
    metrics_snapshot JSONB NOT NULL, -- all key metrics

    -- Delivery
    email_sent_at TIMESTAMPTZ,
    email_recipients TEXT[],

    -- HTML content for reference
    html_content TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(date, report_type)
);

-- Ingestion audit log
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(100) NOT NULL, -- app-store, google-play, firebase, anthropic, etc.
    app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,

    date DATE NOT NULL, -- date of data being ingested
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
    records_processed INTEGER DEFAULT 0,

    error_message TEXT,
    error_details JSONB,

    -- Request/response for debugging
    request_metadata JSONB,
    response_metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Apps
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_active ON apps(is_active) WHERE is_active = true;

-- Providers
CREATE INDEX IF NOT EXISTS idx_providers_slug ON providers(slug);
CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category);

-- Daily tables - date range queries are common
CREATE INDEX IF NOT EXISTS idx_daily_installs_date ON daily_installs(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_installs_app_date ON daily_installs(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_revenue_date ON daily_revenue(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_app_date ON daily_revenue(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_subscriptions_date ON daily_subscriptions(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_subscriptions_app_date ON daily_subscriptions(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_active_users_date ON daily_active_users(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_active_users_app_date ON daily_active_users(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_feature_usage_date ON daily_feature_usage(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_feature_usage_app_date ON daily_feature_usage(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_provider_costs_date ON daily_provider_costs(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_provider_costs_provider_date ON daily_provider_costs(provider_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_website_traffic_date ON daily_website_traffic(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_website_traffic_app_date ON daily_website_traffic(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_email_metrics_date ON daily_email_metrics(date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_search_console_date ON daily_search_console(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_search_console_app ON daily_search_console(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_umami_stats_date ON daily_umami_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_umami_stats_app ON daily_umami_stats(app_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_date ON ingestion_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_source ON ingestion_logs(source, date DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default apps
INSERT INTO apps (slug, name, type, platforms, description) VALUES
    ('guitar_progression_generator', 'Guitar Progression Generator', 'mobile', '["ios", "android"]', 'AI-powered guitar chord progression generator'),
    ('smguitar', 'SM Guitar', 'mobile', '["ios", "android"]', 'Guitar learning and practice app'),
    ('ear_n_play', 'Ear N Play', 'mobile', '["ios", "android"]', 'Ear training for musicians'),
    ('meditnation_mobile', 'Meditnation Mobile', 'mobile', '["ios", "android"]', 'Meditation and mindfulness app'),
    ('meditnation_website', 'Meditnation Website', 'web', '["web"]', 'Meditnation marketing website')
ON CONFLICT (slug) DO NOTHING;

-- Insert default providers
INSERT INTO providers (slug, name, category) VALUES
    ('anthropic', 'Anthropic', 'ai'),
    ('elevenlabs', 'ElevenLabs', 'ai'),
    ('cartesia', 'Cartesia', 'ai'),
    ('google_cloud', 'Google Cloud', 'infrastructure'),
    ('supabase', 'Supabase', 'infrastructure'),
    ('neon', 'Neon', 'infrastructure'),
    ('resend', 'Resend', 'email'),
    ('revenuecat', 'RevenueCat', 'payment')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- VIEWS
-- ============================================

-- Portfolio summary view
CREATE OR REPLACE VIEW portfolio_daily_summary AS
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

-- App health view
CREATE OR REPLACE VIEW app_health AS
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
