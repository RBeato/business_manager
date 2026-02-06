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

interface RevenueCatChartData {
  date: string;
  value: number;
}

interface RevenueCatMetrics {
  active_subscribers: RevenueCatChartData[];
  active_trials: RevenueCatChartData[];
  new_trials: RevenueCatChartData[];
  trial_conversions: RevenueCatChartData[];
  new_customers: RevenueCatChartData[];
  churned_customers: RevenueCatChartData[];
  revenue: RevenueCatChartData[];
  mrr: RevenueCatChartData[];
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

async function fetchMetrics(
  app: App,
  date: Date,
  apiKey: string
): Promise<RevenueCatMetrics | null> {
  if (!app.revenuecat_app_id) return null;

  const dateStr = formatDate(date);
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 30); // Fetch last 30 days for context
  const startDateStr = formatDate(prevDate);

  try {
    // v2 API uses individual metric endpoints
    // Try fetching the main metrics we care about
    const metricsToFetch = [
      'active_subscriptions',
      'active_trials',
      'new_trials',
      'trial_conversion',
      'revenue',
      'mrr',
    ];

    const results: Partial<RevenueCatMetrics> = {};

    for (const metric of metricsToFetch) {
      try {
        const response = await fetchWithAuth(
          `/projects/${app.revenuecat_app_id}/metrics/${metric}?start_date=${startDateStr}&end_date=${dateStr}&resolution=day`,
          apiKey,
          'v2'
        );
        const data = await response.json() as { values: RevenueCatChartData[] };

        // Map metric names to our expected format
        const keyMap: Record<string, keyof RevenueCatMetrics> = {
          'active_subscriptions': 'active_subscribers',
          'active_trials': 'active_trials',
          'new_trials': 'new_trials',
          'trial_conversion': 'trial_conversions',
          'revenue': 'revenue',
          'mrr': 'mrr',
        };

        const key = keyMap[metric];
        if (key && data.values) {
          results[key] = data.values;
        }
      } catch {
        // Individual metric failed, continue with others
      }

      // Rate limiting between metric calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // If we got any data, return it
    if (Object.keys(results).length > 0) {
      return {
        active_subscribers: results.active_subscribers || [],
        active_trials: results.active_trials || [],
        new_trials: results.new_trials || [],
        trial_conversions: results.trial_conversions || [],
        new_customers: [],
        churned_customers: [],
        revenue: results.revenue || [],
        mrr: results.mrr || [],
      };
    }

    return null;
  } catch (error) {
    console.warn(`Could not fetch RevenueCat metrics for ${app.slug}:`, error);
    return null;
  }
}

function getValueForDate(
  data: RevenueCatChartData[],
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

      console.log(`RevenueCat ${app.slug}: ${overview.active_subscribers_count} subs, $${overview.revenue} revenue (28d), $${overview.mrr} MRR`);

      // Use overview data directly (v2 API doesn't support historical timeseries)
      const activeSubscribers = overview.active_subscribers_count;
      const activeTrials = overview.active_trials_count;
      const revenue = overview.revenue;
      const mrr = overview.mrr;
      const newCustomers = overview.new_customers;

      // Upsert subscription data for each platform
      for (const platform of ['ios', 'android'] as const) {
        if (!app.platforms.includes(platform)) continue;

        await upsertDailySubscriptions({
          app_id: app.id,
          date: dateStr,
          platform,
          product_id: undefined, // Aggregate across all products
          active_subscriptions: Math.round(activeSubscribers / app.platforms.length),
          active_trials: Math.round(activeTrials / app.platforms.length),
          new_trials: 0, // Not available in overview
          trial_conversions: 0, // Not available in overview
          new_subscriptions: Math.round(newCustomers / app.platforms.length),
          cancellations: 0, // Not available in overview
          mrr: mrr / app.platforms.length,
          raw_data: {
            metrics_date: dateStr,
            overview,
            source: 'revenuecat_v2_overview',
          } as unknown as Record<string, unknown>,
        });
        recordsProcessed++;

        // Also upsert subscription revenue
        await upsertDailyRevenue({
          app_id: app.id,
          date: dateStr,
          platform,
          country: undefined,
          currency: 'USD',
          gross_revenue: revenue / app.platforms.length,
          net_revenue: (revenue * 0.85) / app.platforms.length, // Estimate after store fees
          subscription_revenue: revenue / app.platforms.length,
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
