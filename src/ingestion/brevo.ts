/**
 * Brevo (formerly Sendinblue) - Transactional Email Metrics Ingestion
 *
 * Fetches daily email stats (sends, opens, clicks, bounces, unsubscribes)
 * for healthopenpage.com and riffroutine.com.
 */

import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailyEmailMetrics,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

interface BrevoReportDay {
  date: string;
  requests: number;
  delivered: number;
  hardBounces: number;
  softBounces: number;
  clicks: number;
  uniqueClicks: number;
  opens: number;
  uniqueOpens: number;
  spamReports: number;
  blocked: number;
  invalid: number;
  unsubscribed: number;
}

async function fetchDailyStats(
  apiKey: string,
  date: string
): Promise<BrevoReportDay | null> {
  const response = await fetch(
    `${BREVO_API_BASE}/smtp/statistics/reports?startDate=${date}&endDate=${date}`,
    {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API error: ${response.status} - ${body}`);
  }

  const data = (await response.json()) as { reports?: BrevoReportDay[] };

  if (!data.reports || data.reports.length === 0) {
    return null;
  }

  return data.reports[0]!;
}

export async function ingestBrevoData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.brevo) {
    return {
      success: true,
      source: 'brevo',
      date: dateStr,
      records_processed: 0,
      error: 'Brevo not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'brevo',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    for (const [websiteName, websiteConfig] of Object.entries(config.brevo.websites)) {
      const app = context.apps.find((a: App) => a.slug === websiteConfig.appSlug);
      if (!app) {
        console.warn(`  Skipping ${websiteName}: app slug "${websiteConfig.appSlug}" not found`);
        continue;
      }

      try {
        const report = await fetchDailyStats(websiteConfig.apiKey, dateStr);

        if (!report) {
          console.log(`  ${websiteName}: no data for ${dateStr}`);
          continue;
        }

        await upsertDailyEmailMetrics({
          app_id: app.id,
          date: dateStr,
          email_type: 'transactional',
          sent: report.requests,
          received: report.delivered,
          opens: report.uniqueOpens,
          clicks: report.uniqueClicks,
          unsubscribes: report.unsubscribed,
          raw_data: report as unknown as Record<string, unknown>,
        });
        recordsProcessed++;

        console.log(
          `  ${websiteName}: ${report.requests} sent, ${report.uniqueOpens} opens, ${report.uniqueClicks} clicks`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
        console.warn(`  Skipping ${websiteName}: ${msg}`);
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
      source: 'brevo',
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
      source: 'brevo',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
