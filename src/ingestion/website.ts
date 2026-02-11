import { google } from 'googleapis';
import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailyWebsiteTraffic,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

const GA4_DATA_API = 'https://analyticsdata.googleapis.com/v1beta';

interface GA4Response {
  rows?: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

async function getAuthClient() {
  const config = getConfig();
  if (!config.firebase) {
    throw new Error('Firebase/GA4 not configured');
  }

  const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  return auth.getClient();
}

interface TrafficMetrics {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
  pagesPerSession: number;
}

async function fetchTrafficBySource(
  propertyId: string,
  date: Date
): Promise<TrafficMetrics[]> {
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
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViewsPerSession' },
        ],
        limit: 100,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GA4 API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as GA4Response;

  return (data.rows || []).map((row) => ({
    source: row.dimensionValues[0]?.value || '(direct)',
    medium: row.dimensionValues[1]?.value || '(none)',
    sessions: parseInt(row.metricValues[0]?.value || '0', 10),
    users: parseInt(row.metricValues[1]?.value || '0', 10),
    newUsers: parseInt(row.metricValues[2]?.value || '0', 10),
    pageviews: parseInt(row.metricValues[3]?.value || '0', 10),
    avgSessionDuration: parseFloat(row.metricValues[4]?.value || '0'),
    bounceRate: parseFloat(row.metricValues[5]?.value || '0') * 100,
    pagesPerSession: parseFloat(row.metricValues[6]?.value || '0'),
  }));
}

interface ConversionMetrics {
  signups: number;
  appDownloads: number;
  purchases: number;
}

async function fetchConversions(
  propertyId: string,
  date: Date
): Promise<ConversionMetrics> {
  const auth = await getAuthClient();
  const accessToken = await auth.getAccessToken();
  const dateStr = formatDate(date);

  try {
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
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              inListFilter: {
                values: [
                  'sign_up',
                  'signup',
                  'app_download',
                  'download_click',
                  'purchase',
                  'begin_checkout',
                ],
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      return { signups: 0, appDownloads: 0, purchases: 0 };
    }

    const data = await response.json() as GA4Response;

    let signups = 0;
    let appDownloads = 0;
    let purchases = 0;

    for (const row of data.rows || []) {
      const eventName = row.dimensionValues[0]?.value || '';
      const count = parseInt(row.metricValues[0]?.value || '0', 10);

      if (eventName === 'sign_up' || eventName === 'signup') {
        signups += count;
      } else if (
        eventName === 'app_download' ||
        eventName === 'download_click'
      ) {
        appDownloads += count;
      } else if (eventName === 'purchase' || eventName === 'begin_checkout') {
        purchases += count;
      }
    }

    return { signups, appDownloads, purchases };
  } catch (error) {
    console.warn(`Could not fetch conversions:`, error);
    return { signups: 0, appDownloads: 0, purchases: 0 };
  }
}

export async function ingestWebsiteData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.firebase) {
    return {
      success: true,
      source: 'website',
      date: dateStr,
      records_processed: 0,
      error: 'Firebase/GA4 not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'website',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Get web apps with GA4 configured
    const webApps = context.apps.filter(
      (app) => app.type === 'web' && app.ga4_property_id
    );

    for (const app of webApps) {
      if (!app.ga4_property_id) continue;

      try {
        // Fetch traffic by source/medium
        const trafficData = await fetchTrafficBySource(
          app.ga4_property_id,
          context.date
        );

        // Fetch conversions (aggregate)
        const conversions = await fetchConversions(
          app.ga4_property_id,
          context.date
        );

        // First, upsert total traffic (no source/medium filter)
        const totalTraffic = trafficData.reduce(
          (acc, row) => ({
            sessions: acc.sessions + row.sessions,
            users: acc.users + row.users,
            newUsers: acc.newUsers + row.newUsers,
            pageviews: acc.pageviews + row.pageviews,
            avgSessionDuration:
              (acc.avgSessionDuration * acc.sessions +
                row.avgSessionDuration * row.sessions) /
              (acc.sessions + row.sessions || 1),
            bounceRate:
              (acc.bounceRate * acc.sessions + row.bounceRate * row.sessions) /
              (acc.sessions + row.sessions || 1),
            pagesPerSession:
              (acc.pagesPerSession * acc.sessions +
                row.pagesPerSession * row.sessions) /
              (acc.sessions + row.sessions || 1),
          }),
          {
            sessions: 0,
            users: 0,
            newUsers: 0,
            pageviews: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            pagesPerSession: 0,
          }
        );

        await upsertDailyWebsiteTraffic({
          app_id: app.id,
          date: dateStr,
          source: '', // Aggregate - must be non-null for UNIQUE constraint upsert
          medium: '',
          campaign: '',
          sessions: totalTraffic.sessions,
          users: totalTraffic.users,
          new_users: totalTraffic.newUsers,
          pageviews: totalTraffic.pageviews,
          avg_session_duration_seconds: Math.round(totalTraffic.avgSessionDuration),
          bounce_rate: totalTraffic.bounceRate,
          pages_per_session: totalTraffic.pagesPerSession,
          signups: conversions.signups,
          app_downloads: conversions.appDownloads,
          purchases: conversions.purchases,
          raw_data: { totalTraffic, conversions } as unknown as Record<string, unknown>,
        });
        recordsProcessed++;

        // Then upsert traffic by source/medium
        for (const traffic of trafficData) {
          await upsertDailyWebsiteTraffic({
            app_id: app.id,
            date: dateStr,
            source: traffic.source,
            medium: traffic.medium,
            campaign: '', // Must be non-null for UNIQUE constraint upsert
            sessions: traffic.sessions,
            users: traffic.users,
            new_users: traffic.newUsers,
            pageviews: traffic.pageviews,
            avg_session_duration_seconds: Math.round(traffic.avgSessionDuration),
            bounce_rate: traffic.bounceRate,
            pages_per_session: traffic.pagesPerSession,
            raw_data: traffic as unknown as Record<string, unknown>,
          });
          recordsProcessed++;
        }
      } catch (error) {
        // Per-app errors are non-fatal — log and continue with other apps
        const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
        console.warn(`  Skipping ${app.slug}: ${msg}`);
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
      source: 'website',
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
      source: 'website',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
