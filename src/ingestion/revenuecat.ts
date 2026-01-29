import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailySubscriptions,
  upsertDailyRevenue,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

const REVENUECAT_API = 'https://api.revenuecat.com/v1';

interface RevenueCatOverview {
  active_subscribers_count: number;
  active_trials_count: number;
  mrr: number;
  revenue: number;
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
  apiKey: string
): Promise<Response> {
  const response = await fetch(`${REVENUECAT_API}${endpoint}`, {
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
    const response = await fetchWithAuth(
      `/projects/${app.revenuecat_app_id}/overview`,
      apiKey
    );
    const data = await response.json() as RevenueCatOverview;
    return data;
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
  prevDate.setDate(prevDate.getDate() - 1);
  const startDateStr = formatDate(prevDate);

  try {
    // Fetch charts data for the specific date range
    const response = await fetchWithAuth(
      `/projects/${app.revenuecat_app_id}/charts?start_date=${startDateStr}&end_date=${dateStr}`,
      apiKey
    );
    const data = await response.json() as RevenueCatMetrics;
    return data;
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
    const { apiKey } = config.revenueCat;

    // Get apps with RevenueCat configured
    const rcApps = context.apps.filter((app) => app.revenuecat_app_id);

    for (const app of rcApps) {
      // Fetch overview for current state
      const overview = await fetchOverview(app, apiKey);

      // Fetch metrics for the specific date
      const metrics = await fetchMetrics(app, context.date, apiKey);

      if (metrics) {
        const activeSubscribers = getValueForDate(
          metrics.active_subscribers,
          dateStr
        );
        const activeTrials = getValueForDate(metrics.active_trials, dateStr);
        const newTrials = getValueForDate(metrics.new_trials, dateStr);
        const trialConversions = getValueForDate(
          metrics.trial_conversions,
          dateStr
        );
        const newCustomers = getValueForDate(metrics.new_customers, dateStr);
        const churnedCustomers = getValueForDate(
          metrics.churned_customers,
          dateStr
        );
        const revenue = getValueForDate(metrics.revenue, dateStr);
        const mrr = getValueForDate(metrics.mrr, dateStr);

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
            new_trials: Math.round(newTrials / app.platforms.length),
            trial_conversions: Math.round(trialConversions / app.platforms.length),
            new_subscriptions: Math.round(newCustomers / app.platforms.length),
            cancellations: Math.round(churnedCustomers / app.platforms.length),
            mrr: mrr / app.platforms.length,
            raw_data: {
              metrics_date: dateStr,
              overview,
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
            raw_data: { source: 'revenuecat' } as unknown as Record<string, unknown>,
          });
          recordsProcessed++;
        }
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
