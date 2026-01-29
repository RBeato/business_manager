import { getConfig, formatDate } from '../../config/index.js';
import {
  getProviderBySlug,
  upsertDailyProviderCosts,
  createIngestionLog,
  updateIngestionLog,
} from '../../db/client.js';
import type { IngestionResult, IngestionContext } from '../../types/index.js';

const NEON_API = 'https://console.neon.tech/api/v2';

interface NeonProject {
  id: string;
  name: string;
  region_id: string;
  created_at: string;
  updated_at: string;
}

interface NeonConsumption {
  period_id: string;
  period_start: string;
  period_end: string;
  data_storage_bytes_hour: number;
  synthetic_storage_size_bytes: number;
  data_transfer_bytes: number;
  written_data_bytes: number;
  compute_time_seconds: number;
  active_time_seconds: number;
}

interface NeonUsageResponse {
  periods: NeonConsumption[];
}

// Neon pricing (approximate, varies by plan)
const PRICING = {
  compute_per_hour: 0.0255, // Compute units per hour
  storage_per_gb_month: 0.000164, // Per GB-hour
  data_transfer_per_gb: 0.09, // Per GB egress
  written_data_per_gb: 0.096, // Per GB written
};

async function fetchProjects(apiKey: string): Promise<NeonProject[]> {
  const response = await fetch(`${NEON_API}/projects`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Neon API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as { projects: NeonProject[] };
  return data.projects || [];
}

async function fetchConsumption(
  apiKey: string,
  projectId: string,
  date: Date
): Promise<NeonConsumption | null> {
  const dateStr = formatDate(date);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDateStr = formatDate(nextDay);

  const response = await fetch(
    `${NEON_API}/projects/${projectId}/consumption?from=${dateStr}&to=${nextDateStr}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    throw new Error(`Neon API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as NeonUsageResponse;
  return data.periods?.[0] || null;
}

function calculateCost(consumption: NeonConsumption): {
  total: number;
  breakdown: Record<string, number>;
} {
  // Convert compute time to hours
  const computeHours = consumption.compute_time_seconds / 3600;
  const computeCost = computeHours * PRICING.compute_per_hour;

  // Storage (GB-hours)
  const storageGbHours =
    consumption.data_storage_bytes_hour / (1024 * 1024 * 1024);
  const storageCost = storageGbHours * PRICING.storage_per_gb_month;

  // Data transfer
  const transferGb = consumption.data_transfer_bytes / (1024 * 1024 * 1024);
  const transferCost = transferGb * PRICING.data_transfer_per_gb;

  // Written data
  const writtenGb = consumption.written_data_bytes / (1024 * 1024 * 1024);
  const writtenCost = writtenGb * PRICING.written_data_per_gb;

  return {
    total: computeCost + storageCost + transferCost + writtenCost,
    breakdown: {
      compute: computeCost,
      storage: storageCost,
      data_transfer: transferCost,
      written_data: writtenCost,
    },
  };
}

export async function ingestNeonData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.neon) {
    return {
      success: true,
      source: 'neon',
      date: dateStr,
      records_processed: 0,
      error: 'Neon not configured',
    };
  }

  const provider = await getProviderBySlug('neon');
  if (!provider) {
    return {
      success: false,
      source: 'neon',
      date: dateStr,
      records_processed: 0,
      error: 'Neon provider not found in database',
    };
  }

  const logId = await createIngestionLog({
    source: 'neon',
    provider_id: provider.id,
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    const { apiKey } = config.neon;

    // Fetch all projects
    const projects = await fetchProjects(apiKey);

    // Aggregate costs across projects
    let totalCost = 0;
    const costByProject: Record<string, number> = {};
    const usageBreakdown: Record<string, number> = {
      total_compute_hours: 0,
      total_storage_gb: 0,
      total_transfer_gb: 0,
      total_written_gb: 0,
    };

    for (const project of projects) {
      const consumption = await fetchConsumption(
        apiKey,
        project.id,
        context.date
      );

      if (consumption) {
        const costs = calculateCost(consumption);
        totalCost += costs.total;
        costByProject[project.name] = costs.total;

        // Accumulate usage
        usageBreakdown['total_compute_hours']! +=
          consumption.compute_time_seconds / 3600;
        usageBreakdown['total_storage_gb']! +=
          consumption.synthetic_storage_size_bytes / (1024 * 1024 * 1024);
        usageBreakdown['total_transfer_gb']! +=
          consumption.data_transfer_bytes / (1024 * 1024 * 1024);
        usageBreakdown['total_written_gb']! +=
          consumption.written_data_bytes / (1024 * 1024 * 1024);
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Upsert provider costs
    await upsertDailyProviderCosts({
      provider_id: provider.id,
      app_id: undefined,
      date: dateStr,
      cost: totalCost,
      currency: 'USD',
      usage_quantity: projects.length,
      usage_unit: 'projects',
      cost_breakdown: costByProject,
      usage_breakdown: usageBreakdown,
      raw_data: {
        project_count: projects.length,
        project_names: projects.map((p) => p.name),
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
      source: 'neon',
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
      source: 'neon',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
