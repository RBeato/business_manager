import { getConfig, formatDate } from '../../config/index.js';
import {
  getProviderBySlug,
  upsertDailyProviderCosts,
  createIngestionLog,
  updateIngestionLog,
} from '../../db/client.js';
import type { IngestionResult, IngestionContext } from '../../types/index.js';

const CARTESIA_API = 'https://api.cartesia.ai';

interface UsageRecord {
  id: string;
  created_at: string;
  characters: number;
  duration_seconds: number;
  model_id: string;
  voice_id: string;
}

interface UsageResponse {
  usage: UsageRecord[];
  total_characters: number;
  total_duration_seconds: number;
}

// Cartesia pricing (approximate - check current pricing)
const COST_PER_CHARACTER = 0.00015;

async function fetchUsage(apiKey: string, date: Date): Promise<UsageRecord[]> {
  const dateStr = formatDate(date);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDateStr = formatDate(nextDay);

  const response = await fetch(
    `${CARTESIA_API}/usage?start_date=${dateStr}&end_date=${nextDateStr}`,
    {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      // Usage endpoint might not exist
      return [];
    }
    const error = await response.text();
    throw new Error(`Cartesia API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as UsageResponse;
  return data.usage || [];
}

export async function ingestCartesiaData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.cartesia) {
    return {
      success: true,
      source: 'cartesia',
      date: dateStr,
      records_processed: 0,
      error: 'Cartesia not configured',
    };
  }

  const provider = await getProviderBySlug('cartesia');
  if (!provider) {
    return {
      success: false,
      source: 'cartesia',
      date: dateStr,
      records_processed: 0,
      error: 'Cartesia provider not found in database',
    };
  }

  const logId = await createIngestionLog({
    source: 'cartesia',
    provider_id: provider.id,
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    const { apiKey } = config.cartesia;

    const usageRecords = await fetchUsage(apiKey, context.date);

    // Aggregate usage
    let totalCharacters = 0;
    let totalDuration = 0;
    const usageByModel: Record<string, { characters: number; duration: number }> = {};
    const usageByVoice: Record<string, number> = {};

    for (const record of usageRecords) {
      totalCharacters += record.characters;
      totalDuration += record.duration_seconds;

      const model = record.model_id || 'default';
      if (!usageByModel[model]) {
        usageByModel[model] = { characters: 0, duration: 0 };
      }
      usageByModel[model]!.characters += record.characters;
      usageByModel[model]!.duration += record.duration_seconds;

      const voice = record.voice_id;
      usageByVoice[voice] = (usageByVoice[voice] || 0) + record.characters;
    }

    // Calculate cost
    const totalCost = totalCharacters * COST_PER_CHARACTER;

    // Build breakdown
    const costBreakdown: Record<string, number> = {};
    const usageBreakdown: Record<string, number> = {
      total_characters: totalCharacters,
      total_duration_seconds: totalDuration,
      requests: usageRecords.length,
    };

    for (const [model, usage] of Object.entries(usageByModel)) {
      costBreakdown[model] = usage.characters * COST_PER_CHARACTER;
      usageBreakdown[`${model}_characters`] = usage.characters;
      usageBreakdown[`${model}_duration`] = usage.duration;
    }

    // Upsert provider costs
    await upsertDailyProviderCosts({
      provider_id: provider.id,
      app_id: undefined,
      date: dateStr,
      cost: totalCost,
      currency: 'USD',
      usage_quantity: totalCharacters,
      usage_unit: 'characters',
      cost_breakdown: costBreakdown,
      usage_breakdown: usageBreakdown,
      raw_data: {
        record_count: usageRecords.length,
        voices_used: Object.keys(usageByVoice).length,
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
      source: 'cartesia',
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
      source: 'cartesia',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
