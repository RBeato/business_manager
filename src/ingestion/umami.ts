import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailyUmamiStats,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

// Mapping of app slugs to their Umami website IDs (from .env)
function getUmamiWebsiteIds(): Record<string, string> {
  const ids: Record<string, string> = {};

  if (process.env.UMAMI_MEDITNATION_WEBSITE_ID) {
    ids['meditnation_website'] = process.env.UMAMI_MEDITNATION_WEBSITE_ID;
  }
  if (process.env.UMAMI_HEALTHOPENPAGE_WEBSITE_ID) {
    ids['health_open_page'] = process.env.UMAMI_HEALTHOPENPAGE_WEBSITE_ID;
  }
  if (process.env.UMAMI_RIFFROUTINE_WEBSITE_ID) {
    ids['riffroutine'] = process.env.UMAMI_RIFFROUTINE_WEBSITE_ID;
  }

  return ids;
}

interface UmamiStatsResponse {
  pageviews: { value: number; prev: number };
  visitors: { value: number; prev: number };
  visits: { value: number; prev: number };
  bounces: { value: number; prev: number };
  totaltime: { value: number; prev: number };
}

interface UmamiMetricItem {
  x: string;
  y: number;
}

async function umamiGet<T>(apiUrl: string, token: string, path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Umami API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
}

async function fetchStats(
  apiUrl: string,
  token: string,
  websiteId: string,
  startAt: number,
  endAt: number
): Promise<UmamiStatsResponse> {
  return umamiGet<UmamiStatsResponse>(
    apiUrl,
    token,
    `/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`
  );
}

async function fetchMetrics(
  apiUrl: string,
  token: string,
  websiteId: string,
  startAt: number,
  endAt: number,
  type: string,
  limit: number = 20
): Promise<UmamiMetricItem[]> {
  return umamiGet<UmamiMetricItem[]>(
    apiUrl,
    token,
    `/api/websites/${websiteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=${type}&limit=${limit}`
  );
}

function metricsToRecord(items: UmamiMetricItem[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    result[item.x] = item.y;
  }
  return result;
}

async function ingestForApp(
  app: App,
  websiteId: string,
  date: Date,
  apiUrl: string,
  token: string
): Promise<number> {
  const dateStr = formatDate(date);

  // Calculate start/end timestamps for the day (UTC)
  const startAt = new Date(dateStr + 'T00:00:00Z').getTime();
  const endAt = new Date(dateStr + 'T23:59:59.999Z').getTime();

  // Fetch stats and all metric breakdowns in parallel
  const [stats, topPages, topReferrers, topCountries, topBrowsers] = await Promise.all([
    fetchStats(apiUrl, token, websiteId, startAt, endAt),
    fetchMetrics(apiUrl, token, websiteId, startAt, endAt, 'url', 20),
    fetchMetrics(apiUrl, token, websiteId, startAt, endAt, 'referrer', 20),
    fetchMetrics(apiUrl, token, websiteId, startAt, endAt, 'country', 20),
    fetchMetrics(apiUrl, token, websiteId, startAt, endAt, 'browser', 20),
  ]);

  // Calculate bounce rate and avg visit duration
  const visits = stats.visits.value || 0;
  const bounceRate = visits > 0 ? (stats.bounces.value / visits) * 100 : 0;
  const avgDuration = visits > 0 ? Math.round(stats.totaltime.value / visits) : 0;

  await upsertDailyUmamiStats({
    app_id: app.id,
    date: dateStr,
    website_id: websiteId,
    pageviews: stats.pageviews.value,
    visitors: stats.visitors.value,
    visits: visits,
    bounce_rate: bounceRate,
    avg_visit_duration: avgDuration,
    top_pages: metricsToRecord(topPages),
    top_referrers: metricsToRecord(topReferrers),
    top_countries: metricsToRecord(topCountries),
    top_browsers: metricsToRecord(topBrowsers),
    raw_data: { stats } as unknown as Record<string, unknown>,
  });

  return 1;
}

export async function ingestUmamiData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.umami) {
    return {
      success: true,
      source: 'umami',
      date: dateStr,
      records_processed: 0,
      error: 'Umami not configured',
    };
  }

  const websiteIds = getUmamiWebsiteIds();
  if (Object.keys(websiteIds).length === 0) {
    return {
      success: true,
      source: 'umami',
      date: dateStr,
      records_processed: 0,
      error: 'No Umami website IDs configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'umami',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    for (const app of context.apps) {
      const websiteId = websiteIds[app.slug];
      if (!websiteId) continue;

      try {
        const count = await ingestForApp(
          app,
          websiteId,
          context.date,
          config.umami.apiUrl,
          config.umami.apiToken
        );
        recordsProcessed += count;
        console.log(`  Umami ${app.slug}: ${count} records`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`  Umami ${app.slug}: failed - ${msg}`);
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
      source: 'umami',
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
      source: 'umami',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
