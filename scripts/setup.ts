/**
 * Setup script for Business Metrics Hub
 *
 * This script:
 * 1. Validates environment configuration
 * 2. Tests database connection
 * 3. Initializes database schema
 * 4. Seeds default data
 */

import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenvConfig();

async function main() {
  console.log('Business Metrics Hub - Setup\n');
  console.log('='.repeat(40) + '\n');

  // 1. Check environment variables
  console.log('1. Checking environment variables...\n');

  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const optionalVars = [
    'APP_STORE_CONNECT_KEY_ID',
    'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
    'REVENUECAT_SECRET_API_KEY',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'ANTHROPIC_API_KEY',
    'ELEVENLABS_API_KEY',
    'CARTESIA_API_KEY',
    'RESEND_API_KEY',
    'REPORT_EMAIL_TO',
    'NEON_API_KEY',
  ];

  let missingRequired = false;
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`  ✓ ${varName}`);
    } else {
      console.log(`  ✗ ${varName} (REQUIRED)`);
      missingRequired = true;
    }
  }

  console.log('\n  Optional integrations:');
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      console.log(`  ✓ ${varName}`);
    } else {
      console.log(`  - ${varName} (not configured)`);
    }
  }

  if (missingRequired) {
    console.error('\n✗ Missing required environment variables. Please check your .env file.\n');
    process.exit(1);
  }

  console.log('\n');

  // 2. Test database connection
  console.log('2. Testing database connection...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data, error } = await supabase.from('apps').select('count').limit(1);

    if (error && error.code === '42P01') {
      // Table doesn't exist - schema not initialized
      console.log('  Database connected, but schema not initialized.\n');
    } else if (error) {
      throw error;
    } else {
      console.log('  ✓ Database connected and schema exists\n');
    }
  } catch (error) {
    console.error('  ✗ Database connection failed:', error);
    process.exit(1);
  }

  // 3. Initialize schema (optional)
  console.log('3. Schema initialization...\n');
  console.log('  To initialize the database schema, run the following SQL');
  console.log('  in your Supabase SQL Editor:\n');
  console.log('  File: src/db/schema.sql\n');

  // Check if we should run schema
  const args = process.argv.slice(2);
  if (args.includes('--init-schema')) {
    console.log('  Running schema initialization...\n');

    const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split into statements and execute
    // Note: This is a simplified approach - for complex schemas,
    // use Supabase migrations or run directly in SQL Editor
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.log('  Note: Could not run schema via RPC.');
      console.log('  Please run the schema.sql file directly in Supabase SQL Editor.\n');
    } else {
      console.log('  ✓ Schema initialized\n');
    }
  }

  // 4. Verify apps table
  console.log('4. Checking apps configuration...\n');

  const { data: apps, error: appsError } = await supabase
    .from('apps')
    .select('*')
    .eq('is_active', true);

  if (appsError) {
    console.log('  Could not query apps table. Run schema first.\n');
  } else if (apps && apps.length > 0) {
    console.log(`  Found ${apps.length} active apps:\n`);
    for (const app of apps) {
      console.log(`    - ${app.name} (${app.slug})`);
    }
    console.log('');
  } else {
    console.log('  No apps found. Default apps will be created when schema runs.\n');
  }

  // 5. Verify providers table
  console.log('5. Checking providers configuration...\n');

  const { data: providers, error: providersError } = await supabase
    .from('providers')
    .select('*')
    .eq('is_active', true);

  if (providersError) {
    console.log('  Could not query providers table. Run schema first.\n');
  } else if (providers && providers.length > 0) {
    console.log(`  Found ${providers.length} active providers:\n`);
    for (const provider of providers) {
      console.log(`    - ${provider.name} (${provider.slug})`);
    }
    console.log('');
  } else {
    console.log('  No providers found. Default providers will be created when schema runs.\n');
  }

  // Summary
  console.log('='.repeat(40));
  console.log('\nSetup complete!\n');
  console.log('Next steps:');
  console.log('  1. If schema not initialized, run schema.sql in Supabase SQL Editor');
  console.log('  2. Configure any additional environment variables');
  console.log('  3. Update app store IDs in the apps table');
  console.log('  4. Run: npm run dev -- --ingest to test data ingestion');
  console.log('  5. Run: npm run dev -- --report to generate a test report\n');
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
