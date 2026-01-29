import { google } from 'googleapis';
import { getConfig, formatDate } from '../../config/index.js';
import {
  getProviderBySlug,
  upsertDailyProviderCosts,
  createIngestionLog,
  updateIngestionLog,
} from '../../db/client.js';
import type { IngestionResult, IngestionContext } from '../../types/index.js';

interface CostEntry {
  service: string;
  sku: string;
  cost: number;
  currency: string;
  usage: number;
  usageUnit: string;
}

async function getAuthClient() {
  const config = getConfig();
  if (!config.firebase) {
    throw new Error('Google Cloud service account not configured');
  }

  const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-billing.readonly'],
  });

  return auth.getClient();
}

async function fetchBillingData(
  billingAccountId: string,
  date: Date
): Promise<CostEntry[]> {
  const auth = await getAuthClient();

  // Use BigQuery export or Cloud Billing API
  // Note: Billing data is typically exported to BigQuery for detailed analysis
  // This is a simplified version using the Cloud Billing API

  const cloudbilling = google.cloudbilling({
    version: 'v1',
    auth: auth as ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T> ? T : never,
  });

  try {
    // Get billing account info
    const accountInfo = await cloudbilling.billingAccounts.get({
      name: `billingAccounts/${billingAccountId}`,
    });

    // Note: For detailed daily costs, you'd typically query BigQuery
    // where billing data is exported. This is a placeholder.

    // The Cloud Billing API provides SKU pricing, not usage data
    // For actual usage, you need BigQuery export or Cost Management API
    return [];
  } catch (error) {
    console.warn('Could not fetch GCP billing data:', error);
    return [];
  }
}

async function fetchBigQueryBillingData(
  projectId: string,
  datasetId: string,
  date: Date
): Promise<CostEntry[]> {
  const auth = await getAuthClient();

  const bigquery = google.bigquery({
    version: 'v2',
    auth: auth as ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> extends Promise<infer T> ? T : never,
  });

  const dateStr = formatDate(date);

  // Standard billing export table query
  const query = `
    SELECT
      service.description as service,
      sku.description as sku,
      SUM(cost) as cost,
      currency,
      SUM(usage.amount) as usage,
      usage.unit as usage_unit
    FROM \`${projectId}.${datasetId}.gcp_billing_export_v1_*\`
    WHERE DATE(usage_start_time) = '${dateStr}'
    GROUP BY service.description, sku.description, currency, usage.unit
    ORDER BY cost DESC
  `;

  try {
    const response = await bigquery.jobs.query({
      projectId,
      requestBody: {
        query,
        useLegacySql: false,
      },
    });

    const rows = response.data.rows || [];
    return rows.map((row) => ({
      service: row.f?.[0]?.v as string || '',
      sku: row.f?.[1]?.v as string || '',
      cost: parseFloat(row.f?.[2]?.v as string || '0'),
      currency: row.f?.[3]?.v as string || 'USD',
      usage: parseFloat(row.f?.[4]?.v as string || '0'),
      usageUnit: row.f?.[5]?.v as string || '',
    }));
  } catch (error) {
    console.warn('Could not fetch BigQuery billing data:', error);
    return [];
  }
}

export async function ingestGoogleCloudData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.googleCloud) {
    return {
      success: true,
      source: 'google-cloud',
      date: dateStr,
      records_processed: 0,
      error: 'Google Cloud billing not configured',
    };
  }

  const provider = await getProviderBySlug('google_cloud');
  if (!provider) {
    return {
      success: false,
      source: 'google-cloud',
      date: dateStr,
      records_processed: 0,
      error: 'Google Cloud provider not found in database',
    };
  }

  const logId = await createIngestionLog({
    source: 'google-cloud',
    provider_id: provider.id,
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    const { billingAccountId } = config.googleCloud;

    // Try BigQuery first (if configured)
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const billingDataset = process.env.GOOGLE_CLOUD_BILLING_DATASET;

    let costEntries: CostEntry[] = [];

    if (projectId && billingDataset) {
      costEntries = await fetchBigQueryBillingData(
        projectId,
        billingDataset,
        context.date
      );
    } else {
      // Fall back to basic billing API
      costEntries = await fetchBillingData(billingAccountId, context.date);
    }

    // Aggregate by service
    const costByService: Record<string, number> = {};
    const usageByService: Record<string, { amount: number; unit: string }> = {};
    let totalCost = 0;

    for (const entry of costEntries) {
      totalCost += entry.cost;
      costByService[entry.service] =
        (costByService[entry.service] || 0) + entry.cost;

      if (!usageByService[entry.service]) {
        usageByService[entry.service] = { amount: 0, unit: entry.usageUnit };
      }
      usageByService[entry.service]!.amount += entry.usage;
    }

    // Build usage breakdown
    const usageBreakdown: Record<string, number> = {};
    for (const [service, usage] of Object.entries(usageByService)) {
      usageBreakdown[`${service}_${usage.unit}`] = usage.amount;
    }

    // Upsert provider costs
    await upsertDailyProviderCosts({
      provider_id: provider.id,
      app_id: undefined,
      date: dateStr,
      cost: totalCost,
      currency: 'USD',
      usage_quantity: undefined,
      usage_unit: undefined,
      cost_breakdown: costByService,
      usage_breakdown: usageBreakdown,
      raw_data: {
        entry_count: costEntries.length,
        services: Object.keys(costByService),
      } as unknown as Record<string, unknown>,
    });
    recordsProcessed++;

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'google-cloud',
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
      source: 'google-cloud',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
