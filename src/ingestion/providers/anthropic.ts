import { getConfig, formatDate } from '../../config/index.js';
import {
  getProviderBySlug,
  upsertDailyProviderCosts,
  createIngestionLog,
  updateIngestionLog,
} from '../../db/client.js';
import type { IngestionResult, IngestionContext } from '../../types/index.js';

const ANTHROPIC_API = 'https://api.anthropic.com/v1';

interface UsageRecord {
  date: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface UsageResponse {
  data: UsageRecord[];
  has_more: boolean;
}

// Pricing per 1M tokens (as of 2024)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-2.1': { input: 8.0, output: 24.0 },
  'claude-2.0': { input: 8.0, output: 24.0 },
  'claude-instant-1.2': { input: 0.8, output: 2.4 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Find matching pricing (partial match for model versions)
  let pricing = { input: 3.0, output: 15.0 }; // Default to Sonnet pricing

  for (const [modelPrefix, modelPricing] of Object.entries(MODEL_PRICING)) {
    if (model.toLowerCase().includes(modelPrefix.toLowerCase())) {
      pricing = modelPricing;
      break;
    }
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

async function fetchUsage(apiKey: string, date: Date): Promise<UsageRecord[]> {
  const dateStr = formatDate(date);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDateStr = formatDate(nextDay);

  // Note: Anthropic's usage API may have different endpoints
  // This is a placeholder based on common patterns
  const response = await fetch(`${ANTHROPIC_API}/usage?start_date=${dateStr}&end_date=${nextDateStr}`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // Usage API might not be available for all accounts
    if (response.status === 404 || response.status === 403) {
      console.warn('Anthropic usage API not available');
      return [];
    }
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as UsageResponse;
  return data.data || [];
}

export async function ingestAnthropicData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.anthropic) {
    return {
      success: true,
      source: 'anthropic',
      date: dateStr,
      records_processed: 0,
      error: 'Anthropic not configured',
    };
  }

  const provider = await getProviderBySlug('anthropic');
  if (!provider) {
    return {
      success: false,
      source: 'anthropic',
      date: dateStr,
      records_processed: 0,
      error: 'Anthropic provider not found in database',
    };
  }

  const logId = await createIngestionLog({
    source: 'anthropic',
    provider_id: provider.id,
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    const usageRecords = await fetchUsage(config.anthropic.apiKey, context.date);

    // Aggregate usage by model
    const usageByModel = new Map<
      string,
      { inputTokens: number; outputTokens: number; cost: number }
    >();

    for (const record of usageRecords) {
      const model = record.model || 'unknown';
      const current = usageByModel.get(model) || {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };

      current.inputTokens += record.input_tokens || 0;
      current.outputTokens += record.output_tokens || 0;

      // Use reported cost if available, otherwise calculate
      if (record.cost_usd) {
        current.cost += record.cost_usd;
      } else {
        current.cost += calculateCost(
          model,
          record.input_tokens || 0,
          record.output_tokens || 0
        );
      }

      usageByModel.set(model, current);
    }

    // Calculate totals
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const costBreakdown: Record<string, number> = {};
    const usageBreakdown: Record<string, number> = {};

    for (const [model, usage] of usageByModel) {
      totalCost += usage.cost;
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;

      costBreakdown[model] = usage.cost;
      usageBreakdown[`${model}_input`] = usage.inputTokens;
      usageBreakdown[`${model}_output`] = usage.outputTokens;
    }

    // Upsert provider costs (aggregate, no specific app)
    await upsertDailyProviderCosts({
      provider_id: provider.id,
      app_id: undefined,
      date: dateStr,
      cost: totalCost,
      currency: 'USD',
      usage_quantity: totalInputTokens + totalOutputTokens,
      usage_unit: 'tokens',
      cost_breakdown: costBreakdown,
      usage_breakdown: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        ...usageBreakdown,
      },
      raw_data: { records: usageRecords } as unknown as Record<string, unknown>,
    });
    recordsProcessed++;

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'anthropic',
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
      source: 'anthropic',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
