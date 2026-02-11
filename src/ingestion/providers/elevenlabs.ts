import { getConfig, formatDate } from '../../config/index.js';
import {
  getProviderBySlug,
  upsertDailyProviderCosts,
  createIngestionLog,
  updateIngestionLog,
} from '../../db/client.js';
import type { IngestionResult, IngestionContext } from '../../types/index.js';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

interface UsageStats {
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix: number;
}

interface HistoryItem {
  history_item_id: string;
  request_id: string;
  voice_id: string;
  voice_name: string;
  text: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  content_type: string;
  state: string;
  settings: {
    similarity_boost: number;
    stability: number;
  };
}

interface HistoryResponse {
  history: HistoryItem[];
  has_more: boolean;
  last_history_item_id?: string;
}

// ElevenLabs pricing (varies by plan, these are pay-as-you-go rates)
const COST_PER_CHARACTER = 0.00018; // Approximate cost per character

async function fetchUsageStats(apiKey: string): Promise<UsageStats> {
  const response = await fetch(`${ELEVENLABS_API}/user/subscription`, {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as UsageStats;
  return data;
}

async function fetchHistory(
  apiKey: string,
  date: Date
): Promise<HistoryItem[]> {
  const items: HistoryItem[] = [];
  let hasMore = true;
  let pageId: string | undefined;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const startUnix = Math.floor(startOfDay.getTime() / 1000);
  const endUnix = Math.floor(endOfDay.getTime() / 1000);

  while (hasMore) {
    const url = new URL(`${ELEVENLABS_API}/history`);
    url.searchParams.set('page_size', '100');
    if (pageId) {
      url.searchParams.set('start_after_history_item_id', pageId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as HistoryResponse;

    // Filter to items on the target date
    const dateItems = data.history.filter(
      (item) => item.date_unix >= startUnix && item.date_unix <= endUnix
    );
    items.push(...dateItems);

    // Check if we've gone past the target date
    const oldestItem = data.history[data.history.length - 1];
    if (oldestItem && oldestItem.date_unix < startUnix) {
      hasMore = false;
    } else {
      hasMore = data.has_more;
      pageId = data.last_history_item_id;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return items;
}

export async function ingestElevenLabsData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.elevenlabs) {
    return {
      success: true,
      source: 'elevenlabs',
      date: dateStr,
      records_processed: 0,
      error: 'ElevenLabs not configured',
    };
  }

  const provider = await getProviderBySlug('elevenlabs');
  if (!provider) {
    return {
      success: false,
      source: 'elevenlabs',
      date: dateStr,
      records_processed: 0,
      error: 'ElevenLabs provider not found in database',
    };
  }

  const logId = await createIngestionLog({
    source: 'elevenlabs',
    provider_id: provider.id,
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    const { apiKey } = config.elevenlabs;

    let totalCharacters = 0;
    let totalCost = 0;
    let usageBreakdown: Record<string, unknown> = {};
    let rawData: Record<string, unknown> = {};

    // Try fetching detailed history first
    try {
      const history = await fetchHistory(apiKey, context.date);

      const usageByVoice: Record<string, number> = {};
      for (const item of history) {
        const charChange =
          item.character_count_change_to - item.character_count_change_from;
        totalCharacters += charChange;

        const voiceName = item.voice_name || item.voice_id;
        usageByVoice[voiceName] = (usageByVoice[voiceName] || 0) + charChange;
      }

      totalCost = totalCharacters * COST_PER_CHARACTER;
      usageBreakdown = {
        total_characters: totalCharacters,
        requests: history.length,
        ...usageByVoice,
      };
      rawData = {
        source: 'history',
        history_count: history.length,
        voices_used: Object.keys(usageByVoice),
      };
    } catch (historyError) {
      // History endpoint requires speech_history_read permission.
      // Fall back to subscription data (aggregate usage only).
      console.warn(`  ElevenLabs history unavailable, trying subscription data`);

      try {
        const stats = await fetchUsageStats(apiKey);
        totalCharacters = stats.character_count;
        totalCost = totalCharacters * COST_PER_CHARACTER;
        usageBreakdown = {
          total_characters: totalCharacters,
          character_limit: stats.character_limit,
        };
        rawData = {
          source: 'subscription',
          character_count: stats.character_count,
          character_limit: stats.character_limit,
          next_reset_unix: stats.next_character_count_reset_unix,
        };
      } catch (subError) {
        // API key lacks both history and subscription read permissions.
        // Record zero usage — key needs to be regenerated with proper scopes.
        console.warn(`  ElevenLabs subscription data also unavailable (key lacks permissions)`);
        rawData = { source: 'unavailable', error: 'API key missing required permissions' };
      }
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
      cost_breakdown: { text_to_speech: totalCost },
      usage_breakdown: usageBreakdown,
      raw_data: rawData,
    });
    recordsProcessed++;

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'elevenlabs',
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
      source: 'elevenlabs',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
