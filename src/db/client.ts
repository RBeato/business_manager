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
  DailySearchConsole,
  DailyUmamiStats,
  DailyReport,
  IngestionLog,
  YouTubeOAuthToken,
  DailyYouTubeMetrics,
  YouTubeVideo,
} from '../types/index.js';
import { getDb, newId, parseJson, toJson, toBool, fromBool } from './sqlite-client.js';

// Re-export for convenience
export { getDb, closeDb } from './sqlite-client.js';

// ============================================
// ROW MAPPERS (SQLite rows → typed objects)
// ============================================

function mapApp(row: Record<string, unknown>): App {
  return {
    ...row,
    platforms: parseJson(row.platforms as string, []),
    is_active: toBool(row.is_active as number),
    api_config: undefined, // apps don't have api_config
  } as unknown as App;
}

function mapProvider(row: Record<string, unknown>): Provider {
  return {
    ...row,
    api_config: parseJson(row.api_config as string, {}),
    is_active: toBool(row.is_active as number),
  } as unknown as Provider;
}

function mapJsonFields(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result = { ...row };
  for (const field of fields) {
    if (field in result && typeof result[field] === 'string') {
      result[field] = parseJson(result[field] as string, null);
    }
  }
  return result;
}

const JSON_FIELDS_BY_TABLE: Record<string, string[]> = {
  daily_installs: ['raw_data'],
  daily_revenue: ['raw_data'],
  daily_subscriptions: ['raw_data'],
  daily_active_users: ['raw_data'],
  daily_feature_usage: ['raw_data'],
  daily_provider_costs: ['raw_data', 'cost_breakdown', 'usage_breakdown'],
  daily_website_traffic: ['raw_data'],
  daily_email_metrics: ['raw_data'],
  daily_search_console: ['raw_data'],
  daily_umami_stats: ['raw_data', 'top_pages', 'top_referrers', 'top_countries', 'top_browsers'],
  daily_reports: ['insights', 'metrics_snapshot', 'email_recipients'],
  ingestion_logs: ['error_details', 'request_metadata', 'response_metadata'],
  blog_posts: ['keywords'],
  telegram_notifications: ['metadata'],
  revenuecat_events: ['webhook_payload', 'entitlement_ids'],
  daily_youtube_metrics: ['raw_data'],
  youtube_videos: ['raw_data'],
  youtube_oauth_tokens: ['scopes'],
};

function mapRows<T>(table: string, rows: Record<string, unknown>[]): T[] {
  const jsonFields = JSON_FIELDS_BY_TABLE[table] || [];
  return rows.map((row) => mapJsonFields(row, jsonFields) as T);
}

// ============================================
// APP OPERATIONS
// ============================================

export async function getActiveApps(): Promise<App[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM apps WHERE is_active = 1 ORDER BY slug').all() as Record<string, unknown>[];
  return rows.map(mapApp);
}

export async function getAppBySlug(slug: string): Promise<App | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM apps WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  return row ? mapApp(row) : null;
}

// ============================================
// PROVIDER OPERATIONS
// ============================================

export async function getActiveProviders(): Promise<Provider[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM providers WHERE is_active = 1 ORDER BY slug').all() as Record<string, unknown>[];
  return rows.map(mapProvider);
}

export async function getProviderBySlug(slug: string): Promise<Provider | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM providers WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  return row ? mapProvider(row) : null;
}

// ============================================
// GENERIC UPSERT HELPER
// ============================================

function upsert(table: string, data: Record<string, unknown>, conflictCols: string): void {
  const db = getDb();
  const jsonFields = JSON_FIELDS_BY_TABLE[table] || [];

  // Add id and created_at
  const row: Record<string, unknown> = {
    id: newId(),
    created_at: new Date().toISOString(),
    ...data,
  };

  // Serialize JSON fields
  for (const field of jsonFields) {
    if (field in row && row[field] != null && typeof row[field] !== 'string') {
      row[field] = toJson(row[field]);
    }
  }

  // Convert booleans to integers
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'boolean') {
      row[key] = fromBool(value);
    }
    // Convert undefined to null
    if (value === undefined) {
      row[key] = null;
    }
    // Convert arrays to JSON for non-json fields
    if (Array.isArray(value)) {
      row[key] = JSON.stringify(value);
    }
  }

  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const conflictColsList = conflictCols.split(',').map(c => c.trim());
  const updateCols = cols.filter(
    (c) => c !== 'id' && c !== 'created_at' && !conflictColsList.includes(c)
  );
  const updateSet = updateCols.map((c) => `${c} = excluded.${c}`).join(', ');

  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(${conflictCols}) DO UPDATE SET ${updateSet}`;

  db.prepare(sql).run(...cols.map((c) => row[c] ?? null));
}

// ============================================
// UPSERT OPERATIONS (idempotent inserts)
// ============================================

export async function upsertDailyInstalls(
  data: Omit<DailyInstalls, 'id' | 'created_at'>
): Promise<void> {
  const row = { ...data, country: data.country ?? '' };
  upsert('daily_installs', row as unknown as Record<string, unknown>, 'app_id, date, platform, country');
}

export async function upsertDailyRevenue(
  data: Omit<DailyRevenue, 'id' | 'created_at'>
): Promise<void> {
  const row = { ...data, country: data.country ?? '' };
  upsert('daily_revenue', row as unknown as Record<string, unknown>, 'app_id, date, platform, country, currency');
}

export async function upsertDailySubscriptions(
  data: Omit<DailySubscriptions, 'id' | 'created_at'>
): Promise<void> {
  const row = { ...data, product_id: data.product_id ?? '' };
  upsert('daily_subscriptions', row as unknown as Record<string, unknown>, 'app_id, date, platform, product_id');
}

export async function upsertDailyActiveUsers(
  data: Omit<DailyActiveUsers, 'id' | 'created_at'>
): Promise<void> {
  upsert('daily_active_users', data as unknown as Record<string, unknown>, 'app_id, date, platform');
}

export async function upsertDailyFeatureUsage(
  data: Omit<DailyFeatureUsage, 'id' | 'created_at'>
): Promise<void> {
  upsert('daily_feature_usage', data as unknown as Record<string, unknown>, 'app_id, date, platform, feature_name');
}

export async function upsertDailyProviderCosts(
  data: Omit<DailyProviderCosts, 'id' | 'created_at'>
): Promise<void> {
  const row = { ...data, app_id: data.app_id ?? '' };
  upsert('daily_provider_costs', row as unknown as Record<string, unknown>, 'provider_id, app_id, date');
}

export async function upsertDailyWebsiteTraffic(
  data: Omit<DailyWebsiteTraffic, 'id' | 'created_at'>
): Promise<void> {
  const row = {
    ...data,
    source: data.source ?? '',
    medium: data.medium ?? '',
    campaign: data.campaign ?? '',
  };
  upsert('daily_website_traffic', row as unknown as Record<string, unknown>, 'app_id, date, source, medium, campaign');
}

export async function upsertDailyEmailMetrics(
  data: Omit<DailyEmailMetrics, 'id' | 'created_at'>
): Promise<void> {
  const row = { ...data, app_id: data.app_id ?? '' };
  upsert('daily_email_metrics', row as unknown as Record<string, unknown>, 'app_id, date, email_type');
}

export async function upsertDailySearchConsole(
  data: Omit<DailySearchConsole, 'id' | 'created_at'>
): Promise<void> {
  const row = {
    ...data,
    query: data.query ?? '',
    page: data.page ?? '',
  };
  upsert('daily_search_console', row as unknown as Record<string, unknown>, 'app_id, date, query, page');
}

export async function upsertDailyUmamiStats(
  data: Omit<DailyUmamiStats, 'id' | 'created_at'>
): Promise<void> {
  upsert('daily_umami_stats', data as unknown as Record<string, unknown>, 'app_id, date, website_id');
}

export async function upsertDailyReport(
  data: Omit<DailyReport, 'id' | 'created_at'>
): Promise<void> {
  upsert('daily_reports', data as unknown as Record<string, unknown>, 'date, report_type');
}

// ============================================
// INGESTION LOGGING
// ============================================

export async function createIngestionLog(
  data: Omit<IngestionLog, 'id' | 'created_at'>
): Promise<string> {
  const db = getDb();
  const id = newId();
  const row: Record<string, unknown> = {
    id,
    created_at: new Date().toISOString(),
    ...data,
  };

  // Serialize JSON fields
  for (const field of ['error_details', 'request_metadata', 'response_metadata']) {
    if (field in row && row[field] != null && typeof row[field] !== 'string') {
      row[field] = toJson(row[field]);
    }
  }

  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ingestion_logs (${cols.join(', ')}) VALUES (${placeholders})`;
  db.prepare(sql).run(...cols.map((c) => row[c] ?? null));
  return id;
}

export async function updateIngestionLog(
  id: string,
  updates: Partial<IngestionLog>
): Promise<void> {
  const db = getDb();
  const data: Record<string, unknown> = { ...updates };

  // Serialize JSON fields
  for (const field of ['error_details', 'request_metadata', 'response_metadata']) {
    if (field in data && data[field] != null && typeof data[field] !== 'string') {
      data[field] = toJson(data[field]);
    }
  }

  delete data.id;
  delete data.created_at;

  const setClauses = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const values = Object.values(data).map((v) => v ?? null);

  db.prepare(`UPDATE ingestion_logs SET ${setClauses} WHERE id = ?`).run(...values, id);
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
  const db = getDb();

  const installs = db.prepare('SELECT * FROM daily_installs WHERE date = ?').all(date) as Record<string, unknown>[];
  const revenue = db.prepare('SELECT * FROM daily_revenue WHERE date = ?').all(date) as Record<string, unknown>[];
  const subscriptions = db.prepare('SELECT * FROM daily_subscriptions WHERE date = ?').all(date) as Record<string, unknown>[];
  const activeUsers = db.prepare('SELECT * FROM daily_active_users WHERE date = ?').all(date) as Record<string, unknown>[];
  const providerCosts = db.prepare('SELECT * FROM daily_provider_costs WHERE date = ?').all(date) as Record<string, unknown>[];

  return {
    installs: mapRows('daily_installs', installs),
    revenue: mapRows('daily_revenue', revenue),
    subscriptions: mapRows('daily_subscriptions', subscriptions),
    activeUsers: mapRows('daily_active_users', activeUsers),
    providerCosts: mapRows('daily_provider_costs', providerCosts),
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
  const db = getDb();

  const installs = db.prepare('SELECT * FROM daily_installs WHERE date >= ? AND date <= ? ORDER BY date').all(startDate, endDate) as Record<string, unknown>[];
  const revenue = db.prepare('SELECT * FROM daily_revenue WHERE date >= ? AND date <= ? ORDER BY date').all(startDate, endDate) as Record<string, unknown>[];
  const subscriptions = db.prepare('SELECT * FROM daily_subscriptions WHERE date >= ? AND date <= ? ORDER BY date').all(startDate, endDate) as Record<string, unknown>[];
  const activeUsers = db.prepare('SELECT * FROM daily_active_users WHERE date >= ? AND date <= ? ORDER BY date').all(startDate, endDate) as Record<string, unknown>[];

  return {
    installs: mapRows('daily_installs', installs),
    revenue: mapRows('daily_revenue', revenue),
    subscriptions: mapRows('daily_subscriptions', subscriptions),
    activeUsers: mapRows('daily_active_users', activeUsers),
  };
}

export async function getLatestReport(
  type: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<DailyReport | null> {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM daily_reports WHERE report_type = ? ORDER BY date DESC LIMIT 1'
  ).get(type) as Record<string, unknown> | undefined;

  if (!row) return null;
  const [mapped] = mapRows<DailyReport>('daily_reports', [row]);
  return mapped ?? null;
}

// ============================================
// YOUTUBE OPERATIONS
// ============================================

export async function getYouTubeTokens(): Promise<YouTubeOAuthToken[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM youtube_oauth_tokens').all() as Record<string, unknown>[];
  return mapRows<YouTubeOAuthToken>('youtube_oauth_tokens', rows);
}

export async function getYouTubeToken(channelId: string): Promise<YouTubeOAuthToken | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM youtube_oauth_tokens WHERE channel_id = ?').get(channelId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const [mapped] = mapRows<YouTubeOAuthToken>('youtube_oauth_tokens', [row]);
  return mapped ?? null;
}

export async function upsertYouTubeToken(
  data: Omit<YouTubeOAuthToken, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  upsert('youtube_oauth_tokens', data as unknown as Record<string, unknown>, 'channel_id');
}

export async function upsertDailyYouTubeMetrics(
  data: Omit<DailyYouTubeMetrics, 'id' | 'created_at'>
): Promise<void> {
  upsert('daily_youtube_metrics', data as unknown as Record<string, unknown>, 'channel_id, date');
}

export async function upsertYouTubeVideo(
  data: Omit<YouTubeVideo, 'id' | 'created_at' | 'updated_at'>
): Promise<void> {
  upsert('youtube_videos', data as unknown as Record<string, unknown>, 'channel_id, video_id');
}

export async function getYouTubeMetrics(
  channelId: string,
  startDate: string,
  endDate: string
): Promise<DailyYouTubeMetrics[]> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM daily_youtube_metrics WHERE channel_id = ? AND date >= ? AND date <= ? ORDER BY date'
  ).all(channelId, startDate, endDate) as Record<string, unknown>[];
  return mapRows<DailyYouTubeMetrics>('daily_youtube_metrics', rows);
}

export async function getYouTubeVideos(channelId: string): Promise<YouTubeVideo[]> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM youtube_videos WHERE channel_id = ? ORDER BY views DESC'
  ).all(channelId) as Record<string, unknown>[];
  return rows.map(row => ({
    ...mapJsonFields(row, ['raw_data']),
    is_short: toBool(row.is_short as number),
  })) as unknown as YouTubeVideo[];
}

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

/**
 * @deprecated Use getDb() instead. Kept for backward compatibility during migration.
 * Returns a proxy that throws helpful errors if Supabase-style methods are called.
 */
export function getSupabaseClient(): never {
  throw new Error(
    'getSupabaseClient() is no longer available. The database has been migrated to SQLite. ' +
    'Use the exported query functions from src/db/client.ts instead.'
  );
}
