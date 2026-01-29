import { parseArgs } from 'node:util';
import { getYesterday, formatDate, getConfig } from './config/index.js';
import { runIngestion, getAvailableSources } from './ingestion/index.js';
import { generateDailyReport } from './reports/index.js';
import { sendDailyReport } from './delivery/email.js';
import type { ReportConfig } from './types/index.js';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ingest: {
        type: 'boolean',
        short: 'i',
        default: false,
      },
      report: {
        type: 'boolean',
        short: 'r',
        default: false,
      },
      send: {
        type: 'boolean',
        short: 's',
        default: false,
      },
      date: {
        type: 'string',
        short: 'd',
      },
      sources: {
        type: 'string',
      },
      'dry-run': {
        type: 'boolean',
        default: false,
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

  // Parse date
  const date = values.date ? new Date(values.date + 'T00:00:00Z') : getYesterday();
  console.log(`\nBusiness Metrics Hub`);
  console.log(`Date: ${formatDate(date)}`);
  console.log(`${'='.repeat(40)}\n`);

  // Default: run full pipeline if no specific flags
  const runAll = !values.ingest && !values.report && !values.send;

  // Run ingestion
  if (values.ingest || runAll) {
    console.log('--- Running Data Ingestion ---\n');

    const sources = values.sources?.split(',').map((s) => s.trim());
    const summary = await runIngestion({
      date,
      sources,
      dryRun: values['dry-run'],
    });

    console.log('\nIngestion completed.');
    if (summary.failed_sources > 0) {
      console.warn(`Warning: ${summary.failed_sources} sources failed.`);
    }
    console.log('');
  }

  // Generate report
  let report;
  if (values.report || runAll) {
    console.log('--- Generating Report ---\n');

    const config = getConfig();
    const reportConfig: ReportConfig = {
      date,
      type: 'daily',
      recipients: config.email?.recipients || [],
      includeInsights: !!config.anthropic,
    };

    report = await generateDailyReport(reportConfig);
    console.log('\nReport generated.\n');
  }

  // Send report
  if (values.send || runAll) {
    if (!report) {
      console.log('--- Loading Report ---\n');
      const config = getConfig();
      const reportConfig: ReportConfig = {
        date,
        type: 'daily',
        recipients: config.email?.recipients || [],
        includeInsights: false,
      };
      report = await generateDailyReport(reportConfig);
    }

    console.log('--- Sending Report ---\n');
    const result = await sendDailyReport(report);

    if (result.success) {
      console.log('Report sent successfully!\n');
    } else {
      console.error(`Failed to send report: ${result.error}\n`);
      process.exit(1);
    }
  }

  console.log('Done!');
}

function printHelp() {
  console.log(`
Business Metrics Hub

Usage: npm run dev [options]

Options:
  -i, --ingest      Run data ingestion only
  -r, --report      Generate report only
  -s, --send        Send report email only
  -d, --date        Target date (YYYY-MM-DD), defaults to yesterday
  --sources         Comma-separated list of ingestion sources
  --dry-run         Run without making changes
  -h, --help        Show this help message

Available ingestion sources:
  ${getAvailableSources().join(', ')}

Examples:
  npm run dev                           # Run full pipeline
  npm run dev --ingest                  # Ingest only
  npm run dev --report --send           # Generate and send report
  npm run dev --date 2024-01-15         # Run for specific date
  npm run dev --sources app-store,firebase  # Ingest specific sources
`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
