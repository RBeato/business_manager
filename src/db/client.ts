import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config/index.js';
import type {
  App,
  Provider,
  DailyInstalls,
  DailyRevenue,
  DailySubscriptions,
  DailyActiveUsers,
  DailyFeatureUsage,
  DailyProviderCosts,
  DailyWebsiteTraffic,
  DailyEmailMetrics,
  DailyReport,
  IngestionLog,
} from '../types/index.js';

// Use a simpler generic type to avoid strict type checking issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: SupabaseClient<any> | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const config = getConfig();
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseClient;
}

// ============================================
// APP OPERATIONS
// ============================================

export async function getActiveApps(): Promise<App[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('is_active', true)
    .order('slug');

  if (error) throw new Error(`Failed to fetch apps: ${error.message}`);
  return (data || []) as App[];
}

export async function getAppBySlug(slug: string): Promise<App | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch app: ${error.message}`);
  }
  return data as App | null;
}

// ============================================
// PROVIDER OPERATIONS
// ============================================

export async function getActiveProviders(): Promise<Provider[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('is_active', true)
    .order('slug');

  if (error) throw new Error(`Failed to fetch providers: ${error.message}`);
  return (data || []) as Provider[];
}

export async function getProviderBySlug(slug: string): Promise<Provider | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch provider: ${error.message}`);
  }
  return data as Provider | null;
}

// ============================================
// UPSERT OPERATIONS (idempotent inserts)
// ============================================

export async function upsertDailyInstalls(
  data: Omit<DailyInstalls, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_installs').upsert(data, {
    onConflict: 'app_id,date,platform,country',
  });

  if (error) throw new Error(`Failed to upsert daily_installs: ${error.message}`);
}

export async function upsertDailyRevenue(
  data: Omit<DailyRevenue, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_revenue').upsert(data, {
    onConflict: 'app_id,date,platform,country,currency',
  });

  if (error) throw new Error(`Failed to upsert daily_revenue: ${error.message}`);
}

export async function upsertDailySubscriptions(
  data: Omit<DailySubscriptions, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_subscriptions').upsert(data, {
    onConflict: 'app_id,date,platform,product_id',
  });

  if (error) throw new Error(`Failed to upsert daily_subscriptions: ${error.message}`);
}

export async function upsertDailyActiveUsers(
  data: Omit<DailyActiveUsers, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_active_users').upsert(data, {
    onConflict: 'app_id,date,platform',
  });

  if (error) throw new Error(`Failed to upsert daily_active_users: ${error.message}`);
}

export async function upsertDailyFeatureUsage(
  data: Omit<DailyFeatureUsage, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_feature_usage').upsert(data, {
    onConflict: 'app_id,date,platform,feature_name',
  });

  if (error) throw new Error(`Failed to upsert daily_feature_usage: ${error.message}`);
}

export async function upsertDailyProviderCosts(
  data: Omit<DailyProviderCosts, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_provider_costs').upsert(data, {
    onConflict: 'provider_id,app_id,date',
  });

  if (error) throw new Error(`Failed to upsert daily_provider_costs: ${error.message}`);
}

export async function upsertDailyWebsiteTraffic(
  data: Omit<DailyWebsiteTraffic, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_website_traffic').upsert(data, {
    onConflict: 'app_id,date,source,medium,campaign',
  });

  if (error) throw new Error(`Failed to upsert daily_website_traffic: ${error.message}`);
}

export async function upsertDailyEmailMetrics(
  data: Omit<DailyEmailMetrics, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_email_metrics').upsert(data, {
    onConflict: 'app_id,date,email_type',
  });

  if (error) throw new Error(`Failed to upsert daily_email_metrics: ${error.message}`);
}

export async function upsertDailyReport(
  data: Omit<DailyReport, 'id' | 'created_at'>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('daily_reports').upsert(data, {
    onConflict: 'date,report_type',
  });

  if (error) throw new Error(`Failed to upsert daily_report: ${error.message}`);
}

// ============================================
// INGESTION LOGGING
// ============================================

export async function createIngestionLog(
  data: Omit<IngestionLog, 'id' | 'created_at'>
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: result, error } = await supabase
    .from('ingestion_logs')
    .insert(data)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create ingestion log: ${error.message}`);
  return (result as { id: string }).id;
}

export async function updateIngestionLog(
  id: string,
  updates: Partial<IngestionLog>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ingestion_logs')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(`Failed to update ingestion log: ${error.message}`);
}

// ============================================
// QUERY HELPERS
// ============================================

export async function getDailyMetricsForDate(date: string): Promise<{
  installs: DailyInstalls[];
  revenue: DailyRevenue[];
  subscriptions: DailySubscriptions[];
  activeUsers: DailyActiveUsers[];
  providerCosts: DailyProviderCosts[];
}> {
  const supabase = getSupabaseClient();

  const [installs, revenue, subscriptions, activeUsers, providerCosts] = await Promise.all([
    supabase.from('daily_installs').select('*').eq('date', date),
    supabase.from('daily_revenue').select('*').eq('date', date),
    supabase.from('daily_subscriptions').select('*').eq('date', date),
    supabase.from('daily_active_users').select('*').eq('date', date),
    supabase.from('daily_provider_costs').select('*').eq('date', date),
  ]);

  return {
    installs: (installs.data || []) as DailyInstalls[],
    revenue: (revenue.data || []) as DailyRevenue[],
    subscriptions: (subscriptions.data || []) as DailySubscriptions[],
    activeUsers: (activeUsers.data || []) as DailyActiveUsers[],
    providerCosts: (providerCosts.data || []) as DailyProviderCosts[],
  };
}

export async function getMetricsForDateRange(
  startDate: string,
  endDate: string
): Promise<{
  installs: DailyInstalls[];
  revenue: DailyRevenue[];
  subscriptions: DailySubscriptions[];
  activeUsers: DailyActiveUsers[];
}> {
  const supabase = getSupabaseClient();

  const [installs, revenue, subscriptions, activeUsers] = await Promise.all([
    supabase
      .from('daily_installs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),
    supabase
      .from('daily_revenue')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),
    supabase
      .from('daily_subscriptions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),
    supabase
      .from('daily_active_users')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),
  ]);

  return {
    installs: (installs.data || []) as DailyInstalls[],
    revenue: (revenue.data || []) as DailyRevenue[],
    subscriptions: (subscriptions.data || []) as DailySubscriptions[],
    activeUsers: (activeUsers.data || []) as DailyActiveUsers[],
  };
}

export async function getLatestReport(
  type: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<DailyReport | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('report_type', type)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch latest report: ${error.message}`);
  }
  return data as DailyReport | null;
}
