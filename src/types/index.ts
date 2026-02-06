// ============================================
// DATABASE TYPES
// ============================================

export interface App {
  id: string;
  slug: string;
  name: string;
  type: 'mobile' | 'web' | 'desktop' | 'api';
  platforms: string[];

  // App store identifiers
  apple_app_id?: string;
  apple_bundle_id?: string;
  google_package_name?: string;

  // RevenueCat
  revenuecat_app_id?: string;

  // Firebase/Analytics
  firebase_app_id?: string;
  ga4_property_id?: string;
  ga4_stream_id?: string;

  // Metadata
  description?: string;
  icon_url?: string;
  website_url?: string;
  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  slug: string;
  name: string;
  category: 'ai' | 'infrastructure' | 'analytics' | 'payment' | 'email' | 'other';

  api_base_url?: string;
  api_config: Record<string, unknown>;

  billing_cycle: 'daily' | 'monthly' | 'usage';
  currency: string;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyInstalls {
  id: string;
  app_id: string;
  date: string;
  platform: 'ios' | 'android' | 'web';
  country?: string;

  installs: number;
  uninstalls?: number;
  updates?: number;

  product_page_views?: number;
  impressions?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyRevenue {
  id: string;
  app_id: string;
  date: string;
  platform: 'ios' | 'android' | 'web' | 'stripe';
  country?: string;
  currency: string;

  gross_revenue: number;
  net_revenue: number;
  refunds?: number;

  iap_revenue?: number;
  subscription_revenue?: number;
  ad_revenue?: number;

  transaction_count?: number;
  paying_users?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailySubscriptions {
  id: string;
  app_id: string;
  date: string;
  platform: 'ios' | 'android' | 'web' | 'stripe';
  product_id?: string;

  active_subscriptions?: number;
  active_trials?: number;

  new_trials?: number;
  trial_conversions?: number;
  trial_cancellations?: number;

  new_subscriptions?: number;
  renewals?: number;
  cancellations?: number;
  expirations?: number;
  reactivations?: number;

  billing_retries?: number;
  grace_period_entries?: number;

  mrr?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyActiveUsers {
  id: string;
  app_id: string;
  date: string;
  platform: 'ios' | 'android' | 'web' | 'all';

  dau?: number;
  wau?: number;
  mau?: number;

  sessions?: number;
  avg_session_duration_seconds?: number;

  new_users?: number;
  returning_users?: number;

  d1_retention?: number;
  d7_retention?: number;
  d30_retention?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyFeatureUsage {
  id: string;
  app_id: string;
  date: string;
  platform: 'ios' | 'android' | 'web' | 'all';
  feature_name: string;

  unique_users?: number;
  event_count?: number;

  started_count?: number;
  completed_count?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyProviderCosts {
  id: string;
  provider_id: string;
  app_id?: string;
  date: string;

  cost: number;
  currency: string;

  usage_quantity?: number;
  usage_unit?: string;

  cost_breakdown?: Record<string, number>;
  usage_breakdown?: Record<string, number>;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyWebsiteTraffic {
  id: string;
  app_id: string;
  date: string;
  source?: string;
  medium?: string;
  campaign?: string;

  sessions?: number;
  users?: number;
  new_users?: number;
  pageviews?: number;

  avg_session_duration_seconds?: number;
  bounce_rate?: number;
  pages_per_session?: number;

  signups?: number;
  app_downloads?: number;
  purchases?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyEmailMetrics {
  id: string;
  app_id?: string;
  date: string;
  email_type: 'support' | 'sales' | 'newsletter' | 'transactional' | 'other';

  received?: number;
  sent?: number;

  tickets_opened?: number;
  tickets_closed?: number;
  avg_response_time_minutes?: number;
  avg_resolution_time_minutes?: number;

  opens?: number;
  clicks?: number;
  unsubscribes?: number;

  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface DailyReport {
  id: string;
  date: string;
  report_type: 'daily' | 'weekly' | 'monthly';

  summary_text?: string;
  insights: ReportInsight[];
  metrics_snapshot: MetricsSnapshot;

  email_sent_at?: string;
  email_recipients?: string[];

  html_content?: string;
  created_at: string;
}

export interface IngestionLog {
  id: string;
  source: string;
  app_id?: string;
  provider_id?: string;

  date: string;
  started_at: string;
  completed_at?: string;

  status: 'running' | 'success' | 'partial' | 'failed';
  records_processed?: number;

  error_message?: string;
  error_details?: Record<string, unknown>;

  request_metadata?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;

  created_at: string;
}

// ============================================
// DERIVED/CALCULATED TYPES
// ============================================

export interface ReportInsight {
  type: 'positive' | 'negative' | 'neutral' | 'alert';
  category: 'revenue' | 'users' | 'engagement' | 'costs' | 'retention' | 'general';
  title: string;
  description: string;
  metric_change?: number;
  metric_unit?: string;
}

export interface MetricsSnapshot {
  // Revenue
  total_revenue: number;
  total_mrr: number;
  revenue_change_pct: number;

  // Users
  total_dau: number;
  total_installs: number;
  dau_change_pct: number;

  // Costs
  total_costs: number;
  cost_per_user: number;
  costs_change_pct: number;

  // By app
  apps: AppMetricsSnapshot[];

  // By provider
  providers: ProviderMetricsSnapshot[];
}

export interface AppMetricsSnapshot {
  app_id: string;
  app_slug: string;
  app_name: string;

  revenue: number;
  mrr: number;
  dau: number;
  installs: number;

  revenue_change_pct: number;
  dau_change_pct: number;
}

export interface ProviderMetricsSnapshot {
  provider_id: string;
  provider_slug: string;
  provider_name: string;

  cost: number;
  usage_quantity?: number;
  usage_unit?: string;

  cost_change_pct: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface AppStoreConnectSalesReport {
  provider: string;
  provider_country: string;
  sku: string;
  developer: string;
  title: string;
  version: string;
  product_type_identifier: string;
  units: number;
  developer_proceeds: number;
  begin_date: string;
  end_date: string;
  customer_currency: string;
  country_code: string;
  currency_of_proceeds: string;
  apple_identifier: string;
  customer_price: number;
  promo_code: string;
  parent_identifier: string;
  subscription: string;
  period: string;
  category: string;
  cmb: string;
  device: string;
  supported_platforms: string;
  proceeds_reason: string;
  preserved_pricing: string;
  client: string;
  order_type: string;
}

export interface GooglePlaySalesReport {
  order_number: string;
  charged_date: string;
  charged_time: string;
  financial_status: string;
  device_model: string;
  product_title: string;
  product_id: string;
  product_type: string;
  sku_id: string;
  currency_of_sale: string;
  item_price: number;
  taxes_collected: number;
  charged_amount: number;
  city_of_buyer: string;
  state_of_buyer: string;
  postal_code_of_buyer: string;
  country_of_buyer: string;
}

export interface RevenueCatSubscriber {
  subscriber_id: string;
  first_seen: string;
  last_seen: string;
  entitlements: Record<string, RevenueCatEntitlement>;
  subscriptions: Record<string, RevenueCatSubscription>;
  non_subscriptions: Record<string, RevenueCatNonSubscription[]>;
}

export interface RevenueCatEntitlement {
  expires_date: string;
  grace_period_expires_date?: string;
  product_identifier: string;
  purchase_date: string;
}

export interface RevenueCatSubscription {
  billing_issues_detected_at?: string;
  expires_date: string;
  grace_period_expires_date?: string;
  is_sandbox: boolean;
  original_purchase_date: string;
  period_type: string;
  product_plan_identifier?: string;
  purchase_date: string;
  refunded_at?: string;
  store: string;
  unsubscribe_detected_at?: string;
}

export interface RevenueCatNonSubscription {
  id: string;
  is_sandbox: boolean;
  purchase_date: string;
  store: string;
}

export interface RevenueCatOverview {
  active_subscribers: number;
  active_trials: number;
  mrr: number;
  revenue: number;
}

export interface FirebaseAnalyticsEvent {
  event_name: string;
  event_count: number;
  user_count: number;
  event_params?: Record<string, string | number>;
}

export interface GA4Report {
  dimension_headers: Array<{ name: string }>;
  metric_headers: Array<{ name: string; type: string }>;
  rows: Array<{
    dimension_values: Array<{ value: string }>;
    metric_values: Array<{ value: string }>;
  }>;
}

// ============================================
// INGESTION TYPES
// ============================================

export interface IngestionResult {
  success: boolean;
  source: string;
  date: string;
  records_processed: number;
  error?: string;
  error_details?: Record<string, unknown>;
}

export interface IngestionContext {
  date: Date;
  apps: App[];
  providers: Provider[];
  dryRun?: boolean;
}

export type IngestionFunction = (
  context: IngestionContext
) => Promise<IngestionResult>;

// ============================================
// REPORT TYPES
// ============================================

export interface ReportConfig {
  date: Date;
  type: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  includeInsights: boolean;
}

export interface GeneratedReport {
  date: string;
  type: 'daily' | 'weekly' | 'monthly';
  metrics: MetricsSnapshot;
  insights: ReportInsight[];
  html: string;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface AppStoreConnectConfig {
  keyId: string;
  issuerId: string;
  privateKey: string;
}

export interface GooglePlayConfig {
  serviceAccountJson: string;
}

export interface RevenueCatConfig {
  apiKey: string;  // Legacy fallback key
  appKeys?: Record<string, string | undefined>;  // Per-app keys: { app_slug: api_key }
}

export interface FirebaseConfig {
  serviceAccountJson: string;
}

export interface AnthropicConfig {
  apiKey: string;
}

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

export interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  appStoreConnect?: AppStoreConnectConfig;
  googlePlay?: GooglePlayConfig;
  revenueCat?: RevenueCatConfig;
  firebase?: FirebaseConfig;
  anthropic?: AnthropicConfig;
  deepseek?: { apiKey: string };
  elevenlabs?: { apiKey: string };
  cartesia?: { apiKey: string };
  googleCloud?: { billingAccountId: string };
  neon?: { apiKey: string };
  resend?: ResendConfig;
  email?: {
    recipients: string[];
  };
}
