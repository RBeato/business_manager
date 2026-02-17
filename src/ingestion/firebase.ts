import { google } from 'googleapis';
import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailyActiveUsers,
  upsertDailyFeatureUsage,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

const GA4_DATA_API = 'https://analyticsdata.googleapis.com/v1beta';

interface GA4Response {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

async function getAuthClient() {
  const config = getConfig();
  if (!config.firebase) {
    throw new Error('Firebase not configured');
  }

  const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  return auth.getClient();
}

async function fetchGA4Report(
  propertyId: string,
  dimensions: string[],
  metrics: string[],
  date: Date
): Promise<GA4Response> {
  const auth = await getAuthClient();
  const accessToken = await auth.getAccessToken();

  const dateStr = formatDate(date);

  const response = await fetch(
    `${GA4_DATA_API}/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: dateStr, endDate: dateStr }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GA4 API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as GA4Response;
  return data;
}

interface ActiveUsersMetrics {
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  sessions: number;
  avgSessionDuration: number;
}

async function fetchActiveUsers(
  app: App,
  date: Date
): Promise<ActiveUsersMetrics | null> {
  if (!app.ga4_property_id) return null;

  try {
    const report = await fetchGA4Report(
      app.ga4_property_id,
      [],
      [
        'activeUsers',
        'active7DayUsers',
        'active28DayUsers',
        'newUsers',
        'sessions',
        'averageSessionDuration',
      ],
      date
    );

    if (!report.rows || report.rows.length === 0) {
      return null;
    }

    const row = report.rows[0]!;
    return {
      dau: parseInt(row.metricValues[0]?.value || '0', 10),
      wau: parseInt(row.metricValues[1]?.value || '0', 10),
      mau: parseInt(row.metricValues[2]?.value || '0', 10),
      newUsers: parseInt(row.metricValues[3]?.value || '0', 10),
      sessions: parseInt(row.metricValues[4]?.value || '0', 10),
      avgSessionDuration: parseFloat(row.metricValues[5]?.value || '0'),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn(`  Skipping GA4 active users for ${app.slug}: ${msg}`);
    return null;
  }
}

interface FeatureUsageMetrics {
  eventName: string;
  eventCount: number;
  userCount: number;
}

async function fetchFeatureUsage(
  app: App,
  date: Date
): Promise<FeatureUsageMetrics[]> {
  if (!app.ga4_property_id) return [];

  try {
    const report = await fetchGA4Report(
      app.ga4_property_id,
      ['eventName'],
      ['eventCount', 'totalUsers'],
      date
    );

    if (!report.rows) return [];

    // Filter to relevant feature events (customize based on your event naming)
    const featureEvents = report.rows
      .filter((row) => {
        const eventName = row.dimensionValues[0]?.value || '';
        // Include custom events, exclude system events
        return (
          !eventName.startsWith('first_') &&
          !eventName.startsWith('session_') &&
          eventName !== 'page_view' &&
          eventName !== 'scroll' &&
          eventName !== 'click'
        );
      })
      .map((row) => ({
        eventName: row.dimensionValues[0]?.value || '',
        eventCount: parseInt(row.metricValues[0]?.value || '0', 10),
        userCount: parseInt(row.metricValues[1]?.value || '0', 10),
      }));

    return featureEvents;
  } catch (error) {
    const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn(`  Skipping GA4 feature usage for ${app.slug}: ${msg}`);
    return [];
  }
}

interface RetentionMetrics {
  d1Retention: number | null;
  d7Retention: number | null;
  d30Retention: number | null;
}

async function fetchRetention(
  app: App,
  date: Date
): Promise<RetentionMetrics> {
  if (!app.ga4_property_id) {
    return { d1Retention: null, d7Retention: null, d30Retention: null };
  }

  try {
    // GA4 retention cohort report
    const auth = await getAuthClient();
    const accessToken = await auth.getAccessToken();

    const dateStr = formatDate(date);

    const response = await fetch(
      `${GA4_DATA_API}/properties/${app.ga4_property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dimensions: [{ name: 'cohort' }, { name: 'cohortNthDay' }],
          metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
          cohortSpec: {
            cohorts: [
              {
                name: 'cohort',
                dimension: 'firstSessionDate',
                dateRange: {
                  startDate: formatDate(
                    new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000)
                  ),
                  endDate: dateStr,
                },
              },
            ],
            cohortsRange: {
              startOffset: 0,
              endOffset: 30,
              granularity: 'DAILY',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Retention API error: ${response.status}`);
    }

    const data = await response.json() as GA4Response;

    let d1 = null;
    let d7 = null;
    let d30 = null;

    for (const row of data.rows || []) {
      const day = parseInt(row.dimensionValues[1]?.value || '0', 10);
      const activeUsers = parseInt(row.metricValues[0]?.value || '0', 10);
      const totalUsers = parseInt(row.metricValues[1]?.value || '0', 10);

      if (totalUsers > 0) {
        const retention = (activeUsers / totalUsers) * 100;
        if (day === 1) d1 = retention;
        if (day === 7) d7 = retention;
        if (day === 30) d30 = retention;
      }
    }

    return { d1Retention: d1, d7Retention: d7, d30Retention: d30 };
  } catch (error) {
    const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn(`  Skipping GA4 retention for ${app.slug}: ${msg}`);
    return { d1Retention: null, d7Retention: null, d30Retention: null };
  }
}

export async function ingestFirebaseData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.firebase) {
    return {
      success: true,
      source: 'firebase',
      date: dateStr,
      records_processed: 0,
      error: 'Firebase not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'firebase',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Get apps with GA4 configured
    const ga4Apps = context.apps.filter((app) => app.ga4_property_id);

    for (const app of ga4Apps) {
      // Fetch active users
      const activeUsers = await fetchActiveUsers(app, context.date);

      if (activeUsers) {
        // Fetch retention
        const retention = await fetchRetention(app, context.date);

        // Determine platform (for mobile apps we track per-platform, for web it's 'web')
        const platforms = app.type === 'web' ? ['web'] : ['all'];

        for (const platform of platforms) {
          await upsertDailyActiveUsers({
            app_id: app.id,
            date: dateStr,
            platform: platform as 'ios' | 'android' | 'web' | 'all',
            dau: activeUsers.dau,
            wau: activeUsers.wau,
            mau: activeUsers.mau,
            new_users: activeUsers.newUsers,
            returning_users: activeUsers.dau - activeUsers.newUsers,
            sessions: activeUsers.sessions,
            avg_session_duration_seconds: Math.round(activeUsers.avgSessionDuration),
            d1_retention: retention.d1Retention ?? undefined,
            d7_retention: retention.d7Retention ?? undefined,
            d30_retention: retention.d30Retention ?? undefined,
            raw_data: { activeUsers, retention } as unknown as Record<string, unknown>,
          });
          recordsProcessed++;
        }
      }

      // Fetch feature usage
      const features = await fetchFeatureUsage(app, context.date);

      for (const feature of features) {
        await upsertDailyFeatureUsage({
          app_id: app.id,
          date: dateStr,
          platform: 'all',
          feature_name: feature.eventName,
          unique_users: feature.userCount,
          event_count: feature.eventCount,
          raw_data: feature as unknown as Record<string, unknown>,
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
      source: 'firebase',
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
      source: 'firebase',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
