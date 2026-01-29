import { getConfig, formatDate } from '../../config/index.js';
import {
  getProviderBySlug,
  upsertDailyProviderCosts,
  createIngestionLog,
  updateIngestionLog,
} from '../../db/client.js';
import type { IngestionResult, IngestionContext } from '../../types/index.js';

const SUPABASE_MANAGEMENT_API = 'https://api.supabase.com/v1';

interface ProjectUsage {
  project_id: string;
  project_name: string;
  db_size_bytes: number;
  db_egress_bytes: number;
  storage_size_bytes: number;
  storage_egress_bytes: number;
  monthly_active_users: number;
  function_invocations: number;
  function_execution_time_ms: number;
  realtime_message_count: number;
  realtime_peak_connections: number;
}

interface BillingUsage {
  period_start: string;
  period_end: string;
  total_cost_usd: number;
  projects: ProjectUsage[];
}

async function fetchUsage(managementKey: string): Promise<BillingUsage | null> {
  const response = await fetch(`${SUPABASE_MANAGEMENT_API}/usage`, {
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 403) {
      return null;
    }
    const error = await response.text();
    throw new Error(`Supabase API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as BillingUsage;
  return data;
}

interface ProjectInfo {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
}

async function fetchProjects(managementKey: string): Promise<ProjectInfo[]> {
  const response = await fetch(`${SUPABASE_MANAGEMENT_API}/projects`, {
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as ProjectInfo[];
  return data;
}

// Supabase pricing estimates (Pro plan)
const PRICING = {
  db_size_per_gb: 0.125, // $0.125/GB/month
  db_egress_per_gb: 0.09, // $0.09/GB
  storage_per_gb: 0.021, // $0.021/GB/month
  storage_egress_per_gb: 0.09, // $0.09/GB
  mau_base: 50000, // Included in Pro
  mau_overage_per_100k: 25, // $25/100k MAU overage
  function_invocations_base: 500000,
  function_invocations_per_million: 2, // $2/million
};

function estimateDailyCost(usage: ProjectUsage): number {
  // Convert to GB
  const dbSizeGb = usage.db_size_bytes / (1024 * 1024 * 1024);
  const dbEgressGb = usage.db_egress_bytes / (1024 * 1024 * 1024);
  const storageSizeGb = usage.storage_size_bytes / (1024 * 1024 * 1024);
  const storageEgressGb = usage.storage_egress_bytes / (1024 * 1024 * 1024);

  // Estimate daily portion of monthly costs
  const dailyFraction = 1 / 30;

  let cost = 0;

  // Database
  cost += dbSizeGb * PRICING.db_size_per_gb * dailyFraction;
  cost += dbEgressGb * PRICING.db_egress_per_gb;

  // Storage
  cost += storageSizeGb * PRICING.storage_per_gb * dailyFraction;
  cost += storageEgressGb * PRICING.storage_egress_per_gb;

  // MAU overage
  const mauOverage = Math.max(0, usage.monthly_active_users - PRICING.mau_base);
  cost += (mauOverage / 100000) * PRICING.mau_overage_per_100k * dailyFraction;

  // Functions
  const functionOverage = Math.max(
    0,
    usage.function_invocations - PRICING.function_invocations_base
  );
  cost +=
    (functionOverage / 1000000) *
    PRICING.function_invocations_per_million *
    dailyFraction;

  return cost;
}

export async function ingestSupabaseData(
  context: IngestionContext
): Promise<IngestionResult> {
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  const managementKey = process.env.SUPABASE_MANAGEMENT_API_KEY;

  if (!managementKey) {
    return {
      success: true,
      source: 'supabase',
      date: dateStr,
      records_processed: 0,
      error: 'Supabase Management API not configured',
    };
  }

  const provider = await getProviderBySlug('supabase');
  if (!provider) {
    return {
      success: false,
      source: 'supabase',
      date: dateStr,
      records_processed: 0,
      error: 'Supabase provider not found in database',
    };
  }

  const logId = await createIngestionLog({
    source: 'supabase',
    provider_id: provider.id,
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Fetch usage data
    const usage = await fetchUsage(managementKey);

    if (!usage) {
      // Fall back to project-level estimates
      const projects = await fetchProjects(managementKey);

      // Just record that we have these projects
      await upsertDailyProviderCosts({
        provider_id: provider.id,
        app_id: undefined,
        date: dateStr,
        cost: 0, // Cannot estimate without usage data
        currency: 'USD',
        usage_quantity: projects.length,
        usage_unit: 'projects',
        cost_breakdown: {},
        usage_breakdown: { project_count: projects.length },
        raw_data: {
          projects: projects.map((p) => ({ id: p.id, name: p.name })),
        } as unknown as Record<string, unknown>,
      });
      recordsProcessed++;
    } else {
      // Aggregate usage across projects
      let totalCost = 0;
      const costByProject: Record<string, number> = {};
      const usageBreakdown: Record<string, number> = {
        total_db_size_gb: 0,
        total_storage_size_gb: 0,
        total_mau: 0,
        total_function_invocations: 0,
      };

      for (const project of usage.projects) {
        const projectCost = estimateDailyCost(project);
        totalCost += projectCost;
        costByProject[project.project_name] = projectCost;

        usageBreakdown['total_db_size_gb']! +=
          project.db_size_bytes / (1024 * 1024 * 1024);
        usageBreakdown['total_storage_size_gb']! +=
          project.storage_size_bytes / (1024 * 1024 * 1024);
        usageBreakdown['total_mau']! += project.monthly_active_users;
        usageBreakdown['total_function_invocations']! +=
          project.function_invocations;
      }

      await upsertDailyProviderCosts({
        provider_id: provider.id,
        app_id: undefined,
        date: dateStr,
        cost: totalCost,
        currency: 'USD',
        usage_quantity: usage.projects.length,
        usage_unit: 'projects',
        cost_breakdown: costByProject,
        usage_breakdown: usageBreakdown,
        raw_data: {
          period_start: usage.period_start,
          period_end: usage.period_end,
          reported_total: usage.total_cost_usd,
        } as unknown as Record<string, unknown>,
      });
      recordsProcessed++;
    }

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'supabase',
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
      source: 'supabase',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
