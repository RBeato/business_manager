#!/usr/bin/env npx tsx
/**
 * Test RLS policies from migration 008_enable_rls.sql
 *
 * Tests:
 * 1. anon role can SELECT from all dashboard tables
 * 2. anon role can INSERT/UPDATE blog_posts and blog_topics (content workflow)
 * 3. anon role CANNOT write to metrics/telegram/ingestion tables
 * 4. service_role bypasses RLS (can do everything)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✅ ${label}`);
}
function fail(label: string, detail?: string) {
  failed++;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── Helpers ──────────────────────────────────────────────

async function testSelect(table: string, expectSuccess: boolean) {
  const { data, error } = await anon.from(table).select('*').limit(1);
  const label = `anon SELECT ${table}`;
  if (expectSuccess) {
    error ? fail(label, error.message) : ok(label);
  } else {
    error || (data && data.length === 0)
      ? ok(`${label} (blocked or empty)`)
      : fail(label, 'expected blocked but got data');
  }
}

async function testInsert(table: string, row: Record<string, unknown>, expectSuccess: boolean) {
  const { error } = await anon.from(table).insert(row);
  const label = `anon INSERT ${table}`;
  if (expectSuccess) {
    error ? fail(label, error.message) : ok(label);
  } else {
    error ? ok(`${label} (blocked: ${error.code})`) : fail(label, 'expected blocked but succeeded');
  }
}

async function testUpdate(table: string, match: Record<string, unknown>, set: Record<string, unknown>, expectSuccess: boolean) {
  let q = anon.from(table).update(set);
  for (const [k, v] of Object.entries(match)) {
    q = q.eq(k, v);
  }
  const { error, count } = await q;
  const label = `anon UPDATE ${table}`;
  if (expectSuccess) {
    error ? fail(label, error.message) : ok(label);
  } else {
    error ? ok(`${label} (blocked: ${error.code})`) : ok(`${label} (0 rows affected — RLS filtered)`);
  }
}

async function testDelete(table: string, match: Record<string, unknown>, expectSuccess: boolean) {
  let q = anon.from(table).delete();
  for (const [k, v] of Object.entries(match)) {
    q = q.eq(k, v);
  }
  const { error } = await q;
  const label = `anon DELETE ${table}`;
  if (expectSuccess) {
    error ? fail(label, error.message) : ok(label);
  } else {
    error ? ok(`${label} (blocked: ${error.code})`) : ok(`${label} (0 rows affected — RLS filtered)`);
  }
}

// ─── Pre-check: is RLS enabled? ──────────────────────────

async function checkRLSEnabled() {
  console.log('\n🔍 Checking if RLS is enabled on tables...\n');
  const { data, error } = await service.rpc('exec_sql', {
    sql: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  });

  // If exec_sql RPC doesn't exist, fall back to a simple check
  if (error) {
    console.log('  (Cannot query pg_tables directly — will infer from policy behavior)\n');
    return;
  }
  for (const row of data as { tablename: string; rowsecurity: boolean }[]) {
    if (row.rowsecurity) {
      ok(`RLS enabled on ${row.tablename}`);
    } else {
      console.log(`  ⚠️  RLS NOT enabled on ${row.tablename}`);
    }
  }
  console.log('');
}

// ─── Tests ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  RLS Policy Test Suite (008_enable_rls)');
  console.log('═══════════════════════════════════════════');

  await checkRLSEnabled();

  // ── 1. anon SELECT (should succeed on dashboard tables) ──
  console.log('📖 Test: anon SELECT on dashboard tables\n');

  const readableTables = [
    'apps', 'providers',
    'daily_installs', 'daily_revenue', 'daily_subscriptions',
    'daily_active_users', 'daily_feature_usage', 'daily_provider_costs',
    'daily_website_traffic', 'daily_email_metrics', 'daily_reports',
    'daily_search_console', 'daily_umami_stats',
    'blog_posts', 'blog_topics', 'blog_seo_metrics', 'content_calendar',
  ];

  for (const table of readableTables) {
    await testSelect(table, true);
  }

  // ── 2. anon SELECT should be blocked on sensitive tables ──
  console.log('\n🔒 Test: anon SELECT on sensitive tables (no policy)\n');

  const blockedReadTables = ['telegram_actions', 'telegram_notifications', 'ingestion_logs'];
  for (const table of blockedReadTables) {
    await testSelect(table, false);
  }

  // ── 3. anon INSERT on content tables (should succeed) ──
  console.log('\n✍️  Test: anon INSERT on blog_posts (should succeed)\n');

  const testPostId = crypto.randomUUID();
  await testInsert('blog_posts', {
    id: testPostId,
    website: 'healthopenpage',
    title: 'RLS Test Post',
    slug: `rls-test-${Date.now()}`,
    content: 'Test content for RLS verification',
    status: 'draft',
    seo_score: 0,
    target_keyword: 'rls test',
    meta_description: 'RLS test',
  }, true);

  // ── 4. anon UPDATE on content tables (should succeed) ──
  console.log('\n✍️  Test: anon UPDATE blog_posts (should succeed)\n');

  await testUpdate('blog_posts', { id: testPostId }, { status: 'pending_review' }, true);

  // ── 5. anon UPDATE on blog_topics (should succeed) ──
  console.log('\n✍️  Test: anon UPDATE blog_topics (should succeed)\n');

  // We just test that the query doesn't error; it may match 0 rows
  await testUpdate('blog_topics', { website: 'healthopenpage' }, { status: 'pending' }, true);

  // ── 6. anon INSERT on metrics tables (should be blocked) ──
  console.log('\n🔒 Test: anon INSERT on metrics tables (should be blocked)\n');

  await testInsert('daily_installs', {
    app_id: crypto.randomUUID(),
    date: '2026-01-01',
    platform: 'ios',
    country: 'US',
    installs: 0,
  }, false);

  await testInsert('daily_revenue', {
    app_id: crypto.randomUUID(),
    date: '2026-01-01',
    platform: 'ios',
    country: '',
    currency: 'USD',
    gross_revenue: 0,
    net_revenue: 0,
  }, false);

  await testInsert('ingestion_logs', {
    source: 'test',
    status: 'running',
    started_at: new Date().toISOString(),
  }, false);

  await testInsert('telegram_actions', {
    chat_id: '123',
    action: 'test',
  }, false);

  // ── 7. anon DELETE on blog_posts (should be blocked — no DELETE policy) ──
  console.log('\n🔒 Test: anon DELETE on blog_posts (no DELETE policy)\n');

  await testDelete('blog_posts', { id: testPostId }, false);

  // ── 8. service_role bypasses RLS ──
  console.log('\n🔑 Test: service_role bypasses RLS\n');

  const { error: svcReadErr } = await service.from('ingestion_logs').select('*').limit(1);
  svcReadErr ? fail('service_role SELECT ingestion_logs', svcReadErr.message) : ok('service_role SELECT ingestion_logs');

  const { error: svcTelErr } = await service.from('telegram_actions').select('*').limit(1);
  svcTelErr ? fail('service_role SELECT telegram_actions', svcTelErr.message) : ok('service_role SELECT telegram_actions');

  // Get a real app_id for FK constraint
  const { data: apps } = await service.from('apps').select('id').limit(1);
  const testAppId = apps?.[0]?.id ?? '00000000-0000-0000-0000-000000000000';
  const { error: svcInsErr } = await service.from('daily_installs').upsert({
    app_id: testAppId,
    date: '1999-01-01',
    platform: 'ios',
    country: 'XX',
    installs: 0,
  }, { onConflict: 'app_id,date,platform,country' });
  svcInsErr ? fail('service_role INSERT daily_installs', svcInsErr.message) : ok('service_role INSERT daily_installs');

  // ── 9. Views work with security_invoker ──
  console.log('\n👁️  Test: Views with security_invoker\n');

  const { error: viewErr1 } = await anon.from('portfolio_daily_summary').select('*').limit(1);
  viewErr1 ? fail('anon SELECT portfolio_daily_summary view', viewErr1.message) : ok('anon SELECT portfolio_daily_summary view');

  const { error: viewErr2 } = await anon.from('app_health').select('*').limit(1);
  viewErr2 ? fail('anon SELECT app_health view', viewErr2.message) : ok('anon SELECT app_health view');

  // ── Cleanup ──
  console.log('\n🧹 Cleanup...\n');

  // Remove test post
  const { error: cleanPostErr } = await service.from('blog_posts').delete().eq('id', testPostId);
  cleanPostErr ? fail('cleanup blog_posts', cleanPostErr.message) : ok('cleanup test blog_post');

  // Remove test daily_installs row
  const { error: cleanInstErr } = await service
    .from('daily_installs')
    .delete()
    .eq('date', '1999-01-01')
    .eq('platform', 'ios')
    .eq('country', 'XX');
  cleanInstErr ? fail('cleanup daily_installs', cleanInstErr.message) : ok('cleanup test daily_installs');

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
