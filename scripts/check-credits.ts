#!/usr/bin/env tsx
/**
 * Check API credits and quotas
 *
 * Usage:
 *   npm run check-credits           # Check all services, send alerts if needed
 *   npm run check-credits -- --quiet  # Don't send alert emails
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { monitorCredits } from '../src/monitoring/credits.js';

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet') || args.includes('-q');

  console.log('\n🔍 API Credit & Quota Monitor\n');
  console.log('='.repeat(50) + '\n');

  const { results, alerts } = await monitorCredits(!quiet);

  console.log('\n' + '='.repeat(50));

  // Summary
  const ok = results.filter(r => r.status === 'ok').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const critical = results.filter(r => r.status === 'critical').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`\nSummary: ${results.length} services checked`);
  console.log(`  ✅ OK: ${ok}`);
  console.log(`  ⚠️  Warning: ${warnings}`);
  console.log(`  🚨 Critical: ${critical}`);
  console.log(`  ❌ Error: ${errors}`);

  if (alerts.length > 0) {
    console.log(`\n⚠️  ${alerts.length} service(s) need attention!`);
    if (!quiet) {
      console.log('Alert email sent to configured recipients.');
    }
    process.exit(1); // Exit with error for CI/cron to detect
  } else {
    console.log('\n✅ All services have sufficient credits.');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
