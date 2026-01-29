import { getActiveApps, getActiveProviders } from '../db/client.js';
import { getYesterday } from '../config/index.js';
import type { IngestionResult, IngestionContext, IngestionFunction } from '../types/index.js';

import { ingestAppStoreData } from './app-store.js';
import { ingestGooglePlayData } from './google-play.js';
import { ingestRevenueCatData } from './revenuecat.js';
import { ingestFirebaseData } from './firebase.js';
import { ingestWebsiteData } from './website.js';
import { ingestEmailData } from './email.js';
import {
  ingestAnthropicData,
  ingestElevenLabsData,
  ingestCartesiaData,
  ingestGoogleCloudData,
  ingestSupabaseData,
  ingestNeonData,
} from './providers/index.js';

// Registry of all ingestion functions
const INGESTION_SOURCES: Record<string, IngestionFunction> = {
  'app-store': ingestAppStoreData,
  'google-play': ingestGooglePlayData,
  revenuecat: ingestRevenueCatData,
  firebase: ingestFirebaseData,
  website: ingestWebsiteData,
  email: ingestEmailData,
  anthropic: ingestAnthropicData,
  elevenlabs: ingestElevenLabsData,
  cartesia: ingestCartesiaData,
  'google-cloud': ingestGoogleCloudData,
  supabase: ingestSupabaseData,
  neon: ingestNeonData,
};

export interface IngestionOptions {
  date?: Date;
  sources?: string[];
  dryRun?: boolean;
}

export interface IngestionSummary {
  date: string;
  started_at: string;
  completed_at: string;
  total_sources: number;
  successful_sources: number;
  failed_sources: number;
  total_records: number;
  results: IngestionResult[];
}

export async function runIngestion(
  options: IngestionOptions = {}
): Promise<IngestionSummary> {
  const date = options.date || getYesterday();
  const sources = options.sources || Object.keys(INGESTION_SOURCES);
  const startedAt = new Date().toISOString();

  console.log(`Starting ingestion for ${date.toISOString().split('T')[0]}`);
  console.log(`Sources: ${sources.join(', ')}`);

  // Build context
  const apps = await getActiveApps();
  const providers = await getActiveProviders();

  const context: IngestionContext = {
    date,
    apps,
    providers,
    dryRun: options.dryRun,
  };

  console.log(`Loaded ${apps.length} apps and ${providers.length} providers`);

  // Run ingestion for each source
  const results: IngestionResult[] = [];

  for (const source of sources) {
    const ingestionFn = INGESTION_SOURCES[source];
    if (!ingestionFn) {
      console.warn(`Unknown ingestion source: ${source}`);
      continue;
    }

    console.log(`\n--- Ingesting: ${source} ---`);

    try {
      const result = await ingestionFn(context);
      results.push(result);

      if (result.success) {
        console.log(`✓ ${source}: ${result.records_processed} records`);
      } else {
        console.error(`✗ ${source}: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${source}: Unexpected error - ${errorMessage}`);

      results.push({
        success: false,
        source,
        date: date.toISOString().split('T')[0]!,
        records_processed: 0,
        error: errorMessage,
      });
    }
  }

  const completedAt = new Date().toISOString();

  const summary: IngestionSummary = {
    date: date.toISOString().split('T')[0]!,
    started_at: startedAt,
    completed_at: completedAt,
    total_sources: sources.length,
    successful_sources: results.filter((r) => r.success).length,
    failed_sources: results.filter((r) => !r.success).length,
    total_records: results.reduce((sum, r) => sum + r.records_processed, 0),
    results,
  };

  console.log('\n=== Ingestion Summary ===');
  console.log(`Date: ${summary.date}`);
  console.log(
    `Sources: ${summary.successful_sources}/${summary.total_sources} successful`
  );
  console.log(`Records: ${summary.total_records}`);
  console.log(
    `Duration: ${
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
    }s`
  );

  return summary;
}

// Run specific ingestion source
export async function runSourceIngestion(
  source: string,
  options: Omit<IngestionOptions, 'sources'> = {}
): Promise<IngestionResult> {
  const ingestionFn = INGESTION_SOURCES[source];
  if (!ingestionFn) {
    throw new Error(`Unknown ingestion source: ${source}`);
  }

  const date = options.date || getYesterday();
  const apps = await getActiveApps();
  const providers = await getActiveProviders();

  const context: IngestionContext = {
    date,
    apps,
    providers,
    dryRun: options.dryRun,
  };

  return ingestionFn(context);
}

// Get available sources
export function getAvailableSources(): string[] {
  return Object.keys(INGESTION_SOURCES);
}
