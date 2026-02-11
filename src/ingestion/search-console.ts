import { google } from 'googleapis';
import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailySearchConsole,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

async function getAuthClient() {
  const config = getConfig();
  if (!config.firebase) {
    throw new Error('Firebase not configured (needed for GSC service account auth)');
  }

  const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  return auth.getClient();
}

interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[];
  responseAggregationType?: string;
}

async function fetchSearchAnalytics(
  siteUrl: string,
  date: Date,
  dimensions: string[],
  rowLimit: number = 50
): Promise<SearchAnalyticsRow[]> {
  const auth = await getAuthClient();
  const accessToken = await auth.getAccessToken();
  const dateStr = formatDate(date);

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: dateStr,
        endDate: dateStr,
        dimensions,
        rowLimit,
        dataState: 'final',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GSC API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as SearchAnalyticsResponse;
  return data.rows || [];
}

async function ingestForApp(app: App, date: Date): Promise<number> {
  if (!app.website_url) return 0;

  // GSC uses "sc-domain:example.com" for domain properties or "https://www.example.com/" for URL prefix
  const siteUrl = app.website_url.startsWith('sc-domain:')
    ? app.website_url
    : app.website_url.endsWith('/')
      ? app.website_url
      : app.website_url + '/';
  const dateStr = formatDate(date);
  let records = 0;

  // 1. Fetch aggregate (no dimensions)
  const aggregateRows = await fetchSearchAnalytics(siteUrl, date, []);
  if (aggregateRows.length > 0) {
    const row = aggregateRows[0]!;
    await upsertDailySearchConsole({
      app_id: app.id,
      date: dateStr,
      query: '', // Aggregate - must be non-null for UNIQUE constraint upsert
      page: '',
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      raw_data: { type: 'aggregate' },
    });
    records++;
  }

  // 2. Fetch by query (top 50)
  const queryRows = await fetchSearchAnalytics(siteUrl, date, ['query'], 50);
  for (const row of queryRows) {
    await upsertDailySearchConsole({
      app_id: app.id,
      date: dateStr,
      query: row.keys[0] || '',
      page: '', // Must be non-null for UNIQUE constraint upsert
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      raw_data: { type: 'query' },
    });
    records++;
  }

  // 3. Fetch by page (top 50)
  const pageRows = await fetchSearchAnalytics(siteUrl, date, ['page'], 50);
  for (const row of pageRows) {
    await upsertDailySearchConsole({
      app_id: app.id,
      date: dateStr,
      query: '', // Must be non-null for UNIQUE constraint upsert
      page: row.keys[0] || '',
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      raw_data: { type: 'page' },
    });
    records++;
  }

  return records;
}

export async function ingestSearchConsoleData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.firebase) {
    return {
      success: true,
      source: 'search-console',
      date: dateStr,
      records_processed: 0,
      error: 'Firebase not configured (needed for GSC service account auth)',
    };
  }

  const logId = await createIngestionLog({
    source: 'search-console',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Get web apps with a website URL
    const webApps = context.apps.filter(
      (app) => app.type === 'web' && app.website_url
    );

    if (webApps.length === 0) {
      await updateIngestionLog(logId, {
        status: 'success',
        completed_at: new Date().toISOString(),
        records_processed: 0,
      });

      return {
        success: true,
        source: 'search-console',
        date: dateStr,
        records_processed: 0,
      };
    }

    for (const app of webApps) {
      try {
        const count = await ingestForApp(app, context.date);
        recordsProcessed += count;
        console.log(`  GSC ${app.slug}: ${count} records`);
      } catch (error) {
        // Log per-app errors but continue with other apps
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`  GSC ${app.slug}: failed - ${msg}`);
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
      source: 'search-console',
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
      source: 'search-console',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
