/**
 * One-time migration: Supabase PostgreSQL → Local SQLite
 *
 * Usage: npx tsx scripts/migrate-from-supabase.ts
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 * After running, you can pause/delete the business_manager Supabase project.
 */

import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { getDb, closeDb, newId } from '../src/db/sqlite-client.js';

dotenvConfig();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tables to migrate in dependency order (foreign keys)
const TABLES = [
  'apps',
  'providers',
  'ingestion_logs',
  'daily_installs',
  'daily_revenue',
  'daily_subscriptions',
  'daily_active_users',
  'daily_feature_usage',
  'daily_provider_costs',
  'daily_website_traffic',
  'daily_email_metrics',
  'daily_search_console',
  'daily_umami_stats',
  'daily_reports',
  'blog_posts',
  'blog_topics',
  'blog_seo_metrics',
  'content_calendar',
  'telegram_actions',
  'telegram_notifications',
  'revenuecat_events',
];

// Columns that store JSON/arrays in PostgreSQL → TEXT in SQLite
const JSON_COLUMNS: Record<string, string[]> = {
  apps: ['platforms'],
  providers: ['api_config'],
  daily_installs: ['raw_data'],
  daily_revenue: ['raw_data'],
  daily_subscriptions: ['raw_data'],
  daily_active_users: ['raw_data'],
  daily_feature_usage: ['raw_data'],
  daily_provider_costs: ['raw_data', 'cost_breakdown', 'usage_breakdown'],
  daily_website_traffic: ['raw_data'],
  daily_email_metrics: ['raw_data'],
  daily_search_console: ['raw_data'],
  daily_umami_stats: ['raw_data', 'top_pages', 'top_referrers', 'top_countries', 'top_browsers'],
  daily_reports: ['insights', 'metrics_snapshot', 'email_recipients'],
  ingestion_logs: ['error_details', 'request_metadata', 'response_metadata'],
  blog_posts: ['keywords'],
  content_calendar: ['preferred_publish_days'],
  telegram_notifications: ['metadata'],
  revenuecat_events: ['webhook_payload', 'entitlement_ids'],
};

// Columns that are booleans in PG → INTEGER in SQLite
const BOOL_COLUMNS: Record<string, string[]> = {
  apps: ['is_active'],
  providers: ['is_active'],
  content_calendar: ['active'],
  revenuecat_events: ['notified'],
};

// Columns that may be NULL but need empty string for UNIQUE constraints
const NULL_TO_EMPTY: Record<string, string[]> = {
  daily_installs: ['country'],
  daily_revenue: ['country'],
  daily_subscriptions: ['product_id'],
  daily_provider_costs: ['app_id'],
  daily_website_traffic: ['source', 'medium', 'campaign'],
  daily_email_metrics: ['app_id'],
  daily_search_console: ['query', 'page'],
};

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    allRows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

function transformRow(
  table: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...row };

  // Serialize JSON/array columns to TEXT
  const jsonCols = JSON_COLUMNS[table] || [];
  for (const col of jsonCols) {
    if (col in result && result[col] != null && typeof result[col] !== 'string') {
      result[col] = JSON.stringify(result[col]);
    }
  }

  // Convert booleans to 0/1
  const boolCols = BOOL_COLUMNS[table] || [];
  for (const col of boolCols) {
    if (col in result) {
      result[col] = result[col] ? 1 : 0;
    }
  }

  // Convert NULL to empty string for UNIQUE constraint columns
  const nullToEmpty = NULL_TO_EMPTY[table] || [];
  for (const col of nullToEmpty) {
    if (result[col] == null) {
      result[col] = '';
    }
  }

  // Convert remaining undefined/null values
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) {
      result[key] = null;
    }
  }

  return result;
}

function getTableColumns(db: ReturnType<typeof getDb>, table: string): string[] {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return info.map((col) => col.name);
}

function insertRows(
  db: ReturnType<typeof getDb>,
  table: string,
  rows: Record<string, unknown>[]
): number {
  if (rows.length === 0) return 0;

  // Only use columns that exist in the SQLite schema (filter out PG-only columns)
  const validCols = new Set(getTableColumns(db, table));
  const cols = Object.keys(rows[0]!).filter((c) => validCols.has(c));

  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);

  let inserted = 0;
  const insertMany = db.transaction((rowList: Record<string, unknown>[]) => {
    for (const row of rowList) {
      const result = stmt.run(...cols.map((c) => row[c] ?? null));
      if (result.changes > 0) inserted++;
    }
  });

  insertMany(rows);
  return inserted;
}

async function migrate() {
  console.log('=== Supabase → SQLite Migration ===\n');
  console.log(`Source: ${SUPABASE_URL}`);

  const db = getDb();
  // Disable FK checks during migration (some rows reference missing parents)
  db.pragma('foreign_keys = OFF');
  const results: { table: string; fetched: number; inserted: number }[] = [];

  for (const table of TABLES) {
    process.stdout.write(`Migrating ${table}...`);

    try {
      const rows = await fetchAll(table);
      const transformed = rows.map((row) => transformRow(table, row));
      const inserted = insertRows(db, table, transformed);

      results.push({ table, fetched: rows.length, inserted });
      console.log(` ${rows.length} rows fetched, ${inserted} inserted`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` ERROR: ${msg}`);
      results.push({ table, fetched: 0, inserted: 0 });
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===');
  console.log('Table'.padEnd(30) + 'Fetched'.padStart(10) + 'Inserted'.padStart(10));
  console.log('-'.repeat(50));

  let totalFetched = 0;
  let totalInserted = 0;
  for (const r of results) {
    console.log(r.table.padEnd(30) + String(r.fetched).padStart(10) + String(r.inserted).padStart(10));
    totalFetched += r.fetched;
    totalInserted += r.inserted;
  }

  console.log('-'.repeat(50));
  console.log('TOTAL'.padEnd(30) + String(totalFetched).padStart(10) + String(totalInserted).padStart(10));

  // Re-enable FK checks
  db.pragma('foreign_keys = ON');

  closeDb();
  console.log('\nMigration complete! SQLite database ready at data/business_manager.db');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
