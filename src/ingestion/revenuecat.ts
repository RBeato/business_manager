import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailySubscriptions,
  upsertDailyRevenue,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

const REVENUECAT_API_V1 = 'https://api.revenuecat.com/v1';
const REVENUECAT_API_V2 = 'https://api.revenuecat.com/v2';

interface RevenueCatOverviewMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  period: string;
}

interface RevenueCatOverview {
  active_subscribers_count: number;
  active_trials_count: number;
  mrr: number;
  mrr_eur: number;
  revenue: number;
  revenue_eur: number;
  new_customers: number;
  active_users: number;
}

interface DailyValue {
  date: string;
  value: number;
}

interface ChartResponse {
  values: number[][];  // [[timestamp, value1, value2?], ...]
  segments: { display_name: string }[];
  resolution: string;
}

interface DailyMetrics {
  active_subscribers: DailyValue[];
  active_trials: DailyValue[];
  new_trials: DailyValue[];
  trial_conversions: DailyValue[];
  new_customers: DailyValue[];
  revenue: DailyValue[];
  mrr: DailyValue[];
}

async function fetchWithAuth(
  endpoint: string,
  apiKey: string,
  apiVersion: 'v1' | 'v2' = 'v2'
): Promise<Response> {
  const baseUrl = apiVersion === 'v2' ? REVENUECAT_API_V2 : REVENUECAT_API_V1;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RevenueCat API error: ${response.status} - ${error}`);
  }

  return response;
}

async function fetchOverview(
  app: App,
  apiKey: string
): Promise<RevenueCatOverview | null> {
  if (!app.revenuecat_app_id) return null;

  try {
    // v2 API endpoint for overview metrics
    const response = await fetchWithAuth(
      `/projects/${app.revenuecat_app_id}/metrics/overview`,
      apiKey,
      'v2'
    );
    const data = await response.json() as { metrics: RevenueCatOverviewMetric[] };

    // Parse the array of metrics into our expected format
    const metricsArray = data.metrics || [];
    const getValue = (id: string): number => {
      const metric = metricsArray.find(m => m.id === id);
      return metric?.value || 0;
    };

    return {
      active_subscribers_count: getValue('active_subscriptions'),
      active_trials_count: getValue('active_trials'),
      mrr: getValue('mrr'),
      mrr_eur: getValue('mrr_eur'),
      revenue: getValue('revenue'),
      revenue_eur: getValue('revenue_eur'),
      new_customers: getValue('new_customers'),
      active_users: getValue('active_users'),
    };
  } catch (error) {
    console.warn(`Could not fetch RevenueCat overview for ${app.slug}:`, error);
    return null;
  }
}

/** Convert chart response [[timestamp, value, ...], ...] to [{date, value}] */
function parseChartValues(data: ChartResponse): DailyValue[] {
  if (!data.values?.length) return [];
  return data.values.map(row => ({
    date: formatDate(new Date(row[0] * 1000)),
    value: row[1] ?? 0,
  }));
}

async function fetchChartMetrics(
  app: App,
  date: Date,
  apiKey: string
): Promise<DailyMetrics | null> {
  if (!app.revenuecat_app_id) return null;

  const dateStr = formatDate(date);
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 7); // Fetch last 7 days
  const startDateStr = formatDate(prevDate);

  // Charts API metric names → our internal keys
  const chartsToFetch: [string, keyof DailyMetrics][] = [
    ['revenue', 'revenue'],
    ['actives', 'active_subscribers'],
    ['customers_new', 'new_customers'],
    ['trials_new', 'new_trials'],
    ['trial_conversion_rate', 'trial_conversions'],
    ['mrr', 'mrr'],
  ];

  const results: Partial<DailyMetrics> = {};
  let fetched = 0;

  for (const [chartName, key] of chartsToFetch) {
    try {
      const url = `/projects/${app.revenuecat_app_id}/charts/${chartName}?start_date=${startDateStr}&end_date=${dateStr}&realtime=false`;
      const response = await fetchWithAuth(url, apiKey, 'v2');
      const data = await response.json() as ChartResponse;
      results[key] = parseChartValues(data);
      fetched++;
    } catch {
      // Individual chart failed, continue with others
    }

    // Rate limiting between chart calls
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (fetched > 0) {
    return {
      active_subscribers: results.active_subscribers || [],
      active_trials: results.active_trials || [],
      new_trials: results.new_trials || [],
      trial_conversions: results.trial_conversions || [],
      new_customers: results.new_customers || [],
      revenue: results.revenue || [],
      mrr: results.mrr || [],
    };
  }

  return null;
}

function getValueForDate(
  data: DailyValue[],
  dateStr: string
): number {
  const entry = data.find((d) => d.date === dateStr);
  return entry?.value || 0;
}

export async function ingestRevenueCatData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.revenueCat) {
    return {
      success: true,
      source: 'revenuecat',
      date: dateStr,
      records_processed: 0,
      error: 'RevenueCat not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'revenuecat',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    const { apiKey: fallbackKey, appKeys } = config.revenueCat;

    // Get apps with RevenueCat configured
    const rcApps = context.apps.filter((app) => app.revenuecat_app_id);

    for (const app of rcApps) {
      // Use per-app key if available, otherwise fall back to legacy key
      const apiKey = appKeys?.[app.slug] || fallbackKey;

      if (!apiKey) {
        console.warn(`No API key for ${app.slug}, skipping`);
        continue;
      }

      // Fetch overview for current state (v2 API)
      const overview = await fetchOverview(app, apiKey);

      if (!overview) {
        console.warn(`Could not fetch RevenueCat data for ${app.slug}`);
        continue;
      }

      console.log(`RevenueCat ${app.slug}: ${overview.active_subscribers_count} active subs, $${overview.mrr} MRR (overview)`);

      // Fetch daily charts data for accurate metrics
      const metrics = await fetchChartMetrics(app, context.date, apiKey);

      // Use charts data when available, fall back to overview
      const dailyRevenue = metrics?.revenue?.length
        ? getValueForDate(metrics.revenue, dateStr)
        : overview.revenue / 28; // Approximate daily from 28-day aggregate

      // Point-in-time snapshots from charts, fallback to overview
      const activeSubscribers = metrics?.active_subscribers?.length
        ? getValueForDate(metrics.active_subscribers, dateStr)
        : overview.active_subscribers_count;
      const activeTrials = metrics?.active_trials?.length
        ? getValueForDate(metrics.active_trials, dateStr)
        : overview.active_trials_count;

      // MRR: charts API returns monthly resolution only, so always use overview
      // (overview.mrr is the current MRR which is correct for daily ingestion)
      const mrr = overview.mrr;

      // Daily event counts from charts (accurate per-day values)
      const dailyNewCustomers = metrics?.new_customers?.length
        ? getValueForDate(metrics.new_customers, dateStr)
        : Math.round(overview.new_customers / 28);
      const dailyNewTrials = metrics?.new_trials?.length
        ? getValueForDate(metrics.new_trials, dateStr)
        : 0;
      const dailyTrialConversions = metrics?.trial_conversions?.length
        ? getValueForDate(metrics.trial_conversions, dateStr)
        : 0;

      const dataSource = metrics ? 'revenuecat_v2_charts' : 'revenuecat_v2_overview';
      console.log(`  ${app.slug} [${dataSource}]: ${activeSubscribers} subs, ${dailyNewCustomers} new, $${dailyRevenue.toFixed(2)} rev, $${mrr.toFixed(2)} MRR`);

      // Only count mobile platforms (ios/android) for splitting
      const mobilePlatforms = (['ios', 'android'] as const).filter(
        p => app.platforms.includes(p)
      );
      const platformCount = mobilePlatforms.length || 1;

      // Upsert subscription data for each mobile platform
      // NOTE: country and product_id MUST be non-null strings for
      // PostgreSQL UNIQUE constraints to match on upsert (NULL != NULL)
      for (const platform of mobilePlatforms) {
        await upsertDailySubscriptions({
          app_id: app.id,
          date: dateStr,
          platform,
          product_id: '', // Aggregate across all products
          active_subscriptions: Math.round(activeSubscribers / platformCount),
          active_trials: Math.round(activeTrials / platformCount),
          new_trials: Math.round(dailyNewTrials / platformCount),
          trial_conversions: Math.round(dailyTrialConversions / platformCount),
          new_subscriptions: Math.round(dailyNewCustomers / platformCount),
          cancellations: 0, // Not available via API
          mrr: mrr / platformCount,
          raw_data: {
            metrics_date: dateStr,
            overview,
            source: dataSource,
          } as unknown as Record<string, unknown>,
        });
        recordsProcessed++;

        // Also upsert subscription revenue
        await upsertDailyRevenue({
          app_id: app.id,
          date: dateStr,
          platform,
          country: '', // Aggregate across all countries
          currency: 'USD',
          gross_revenue: dailyRevenue / platformCount,
          net_revenue: (dailyRevenue * 0.85) / platformCount, // Estimate after store fees
          subscription_revenue: dailyRevenue / platformCount,
          raw_data: { source: 'revenuecat_v2' } as unknown as Record<string, unknown>,
        });
        recordsProcessed++;
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'revenuecat',
      date: dateStr,
      records_processed: recordsProcessed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateIngestionLog(logId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      records_processed: recordsProcessed,
    });

    return {
      success: false,
      source: 'revenuecat',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
