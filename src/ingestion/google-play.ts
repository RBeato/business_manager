import { google } from 'googleapis';
import { getConfig, formatDate } from '../config/index.js';
import {
  getActiveApps,
  upsertDailyInstalls,
  upsertDailyRevenue,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

interface GooglePlayStats {
  installs: number;
  uninstalls: number;
  updates: number;
  activeDevices: number;
}

interface GooglePlaySales {
  grossRevenue: number;
  netRevenue: number;
  transactions: number;
  refunds: number;
}

async function getAuthClient() {
  const config = getConfig();
  if (!config.googlePlay) {
    throw new Error('Google Play not configured');
  }

  const serviceAccount = JSON.parse(config.googlePlay.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      'https://www.googleapis.com/auth/androidpublisher',
      'https://www.googleapis.com/auth/playdeveloperreporting',
    ],
  });

  return auth.getClient();
}

async function fetchStatsReport(
  app: App,
  date: Date
): Promise<GooglePlayStats | null> {
  if (!app.google_package_name) return null;

  try {
    const auth = await getAuthClient();
    const playdeveloperreporting = google.playdeveloperreporting({
      version: 'v1beta1',
      auth: auth as ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T> ? T : never,
    });

    const dateStr = formatDate(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDateStr = formatDate(nextDay);

    // Query stats metrics
    const response = await playdeveloperreporting.vitals.stuckbackgroundwakelockrate.query({
      name: `apps/${app.google_package_name}`,
      requestBody: {
        dimensions: [],
        metrics: ['newUsersAcquired', 'activeUsers'],
        timelineSpec: {
          startTime: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
          endTime: { year: nextDay.getFullYear(), month: nextDay.getMonth() + 1, day: nextDay.getDate() },
        },
      },
    });

    // This is a placeholder - actual API response structure varies
    const data = response.data;
    return {
      installs: 0, // Would parse from actual response
      uninstalls: 0,
      updates: 0,
      activeDevices: 0,
    };
  } catch (error) {
    console.warn(`Could not fetch Google Play stats for ${app.slug}:`, error);
    return null;
  }
}

async function fetchSalesReport(
  app: App,
  date: Date
): Promise<Map<string, GooglePlaySales>> {
  if (!app.google_package_name) return new Map();

  const salesByCountry = new Map<string, GooglePlaySales>();

  try {
    const auth = await getAuthClient();
    const androidpublisher = google.androidpublisher({
      version: 'v3',
      auth: auth as ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T> ? T : never,
    });

    // Get monthly financial reports
    // Note: Google Play reports are typically available with a 2-day delay
    const dateStr = formatDate(date);
    const yearMonth = dateStr.substring(0, 7).replace('-', '');

    // Financial reports are typically exported to Google Cloud Storage
    // and then downloaded. The androidpublisher API doesn't have a direct
    // sales endpoint - you'd need to use the Play Developer Reporting API
    // or download reports from GCS.
    //
    // This is a placeholder - actual implementation would:
    // 1. Use google.storage to download the sales report CSV from GCS
    // 2. Parse the CSV and aggregate by country
    //
    // For now, return empty as a stub
    console.log(`Google Play sales report stub for ${app.google_package_name}`);

    return salesByCountry;
  } catch (error) {
    console.warn(`Could not fetch Google Play sales for ${app.slug}:`, error);
    return salesByCountry;
  }
}

export async function ingestGooglePlayData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.googlePlay) {
    return {
      success: true,
      source: 'google-play',
      date: dateStr,
      records_processed: 0,
      error: 'Google Play not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'google-play',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Get Android apps
    const androidApps = context.apps.filter((app) =>
      app.platforms.includes('android')
    );

    for (const app of androidApps) {
      if (!app.google_package_name) continue;

      // Fetch stats
      const stats = await fetchStatsReport(app, context.date);

      if (stats) {
        await upsertDailyInstalls({
          app_id: app.id,
          date: dateStr,
          platform: 'android',
          country: undefined,
          installs: stats.installs,
          uninstalls: stats.uninstalls,
          updates: stats.updates,
          raw_data: stats as unknown as Record<string, unknown>,
        });
        recordsProcessed++;
      }

      // Fetch sales
      const salesByCountry = await fetchSalesReport(app, context.date);

      for (const [country, sales] of salesByCountry) {
        await upsertDailyRevenue({
          app_id: app.id,
          date: dateStr,
          platform: 'android',
          country,
          currency: 'USD',
          gross_revenue: sales.grossRevenue,
          net_revenue: sales.netRevenue,
          refunds: sales.refunds,
          transaction_count: sales.transactions,
          raw_data: sales as unknown as Record<string, unknown>,
        });
        recordsProcessed++;
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'google-play',
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
      source: 'google-play',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
