/**
 * Setup GA4 Property IDs in the apps table
 *
 * Reads GA4 property IDs from .env and updates matching app rows in Supabase.
 *
 * Usage: npx tsx scripts/setup-ga4.ts
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { getSupabaseClient } from '../src/db/client.js';

// Mapping of env var names to app slugs
const GA4_ENV_MAPPINGS: Record<string, string> = {
  APP_HEALTHOPENPAGE_GA4_PROPERTY_ID: 'healthopenpage_website',
  APP_MEDITNATION_WEB_GA4_PROPERTY_ID: 'meditnation_website',
  APP_RIFFROUTINE_GA4_PROPERTY_ID: 'riffroutine_website',
};

async function main() {
  const supabase = getSupabaseClient();
  let updated = 0;

  for (const [envVar, appSlug] of Object.entries(GA4_ENV_MAPPINGS)) {
    const propertyId = process.env[envVar];
    if (!propertyId) {
      console.log(`  Skip ${appSlug}: ${envVar} not set`);
      continue;
    }

    const { error } = await supabase
      .from('apps')
      .update({ ga4_property_id: propertyId })
      .eq('slug', appSlug);

    if (error) {
      console.error(`  Error updating ${appSlug}: ${error.message}`);
    } else {
      console.log(`  ✓ ${appSlug}: ga4_property_id = ${propertyId}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} app(s).`);

  if (updated === 0) {
    console.log('\nTo configure GA4 property IDs, add them to .env:');
    for (const envVar of Object.keys(GA4_ENV_MAPPINGS)) {
      console.log(`  ${envVar}=<your-property-id>`);
    }
    console.log('\nFind property IDs at: analytics.google.com → Admin → Property Settings');
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
