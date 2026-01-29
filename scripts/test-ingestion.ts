/**
 * Test script for individual ingestion sources
 *
 * Usage:
 *   npm run test:ingestion                    # Test all sources
 *   npm run test:ingestion -- app-store       # Test specific source
 *   npm run test:ingestion -- --dry-run       # Dry run mode
 */

import { config as dotenvConfig } from 'dotenv';
import { parseArgs } from 'node:util';
import { getYesterday, formatDate } from '../src/config/index.js';
import {
  runIngestion,
  runSourceIngestion,
  getAvailableSources,
} from '../src/ingestion/index.js';

dotenvConfig();

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'dry-run': {
        type: 'boolean',
        default: false,
      },
      date: {
        type: 'string',
        short: 'd',
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  const date = values.date
    ? new Date(values.date + 'T00:00:00Z')
    : getYesterday();

  console.log('\nIngestion Test\n');
  console.log(`Date: ${formatDate(date)}`);
  console.log(`Dry run: ${values['dry-run']}`);
  console.log('='.repeat(40) + '\n');

  const source = positionals[0];

  if (source) {
    // Test specific source
    const availableSources = getAvailableSources();
    if (!availableSources.includes(source)) {
      console.error(`Unknown source: ${source}`);
      console.log(`\nAvailable sources: ${availableSources.join(', ')}\n`);
      process.exit(1);
    }

    console.log(`Testing source: ${source}\n`);

    const result = await runSourceIngestion(source, {
      date,
      dryRun: values['dry-run'],
    });

    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      process.exit(1);
    }
  } else {
    // Test all sources
    console.log('Testing all sources...\n');

    const summary = await runIngestion({
      date,
      dryRun: values['dry-run'],
    });

    console.log('\n' + '='.repeat(40));
    console.log('\nResults Summary:');
    console.log(JSON.stringify(summary, null, 2));

    if (summary.failed_sources > 0) {
      console.log(`\nWarning: ${summary.failed_sources} sources failed.\n`);
    }
  }
}

function printHelp() {
  console.log(`
Ingestion Test Script

Usage:
  npm run test:ingestion [source] [options]

Arguments:
  source            Specific ingestion source to test (optional)

Options:
  -d, --date        Target date (YYYY-MM-DD), defaults to yesterday
  --dry-run         Run without making database changes
  -h, --help        Show this help message

Available sources:
  ${getAvailableSources().join('\n  ')}

Examples:
  npm run test:ingestion                    # Test all sources
  npm run test:ingestion app-store          # Test App Store ingestion
  npm run test:ingestion firebase --dry-run # Dry run Firebase
  npm run test:ingestion --date 2024-01-15  # Test for specific date
`);
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
