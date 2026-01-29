#!/usr/bin/env tsx
/**
 * Apply database schema to Supabase
 * Run with: npx tsx scripts/apply-schema.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applySchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read schema file
  const schemaPath = path.join(__dirname, '../src/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Split into statements (simple split, handles most cases)
  const statements = schema
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n📋 Found ${statements.length} SQL statements to execute\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });

      if (error) {
        // Try direct query for DDL
        const { error: queryError } = await supabase.from('_exec').select().limit(0);

        // For tables that might already exist, this is fine
        if (error.message?.includes('already exists')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] Skipped (exists): ${preview}...`);
          success++;
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] Failed: ${preview}...`);
          console.error(`   Error: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`✅ [${i + 1}/${statements.length}] OK: ${preview}...`);
        success++;
      }
    } catch (err) {
      console.error(`❌ [${i + 1}/${statements.length}] Error: ${preview}...`);
      console.error(`   ${err}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    console.log('⚠️  Some statements failed. You may need to run the schema manually.');
    console.log('   Go to: https://supabase.com/dashboard/project/pvbaasxwbfqmjslqekpa/sql');
    console.log('   Copy the contents of src/db/schema.sql and run it there.\n');
  }
}

applySchema().catch(console.error);
