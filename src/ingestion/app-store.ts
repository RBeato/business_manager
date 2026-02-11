import jwt from 'jsonwebtoken';
import { getConfig, formatDate } from '../config/index.js';
import {
  getActiveApps,
  upsertDailyInstalls,
  upsertDailyRevenue,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext, App } from '../types/index.js';

const APP_STORE_CONNECT_API = 'https://api.appstoreconnect.apple.com/v1';

interface AppStoreConnectToken {
  token: string;
  expiresAt: number;
}

let cachedToken: AppStoreConnectToken | null = null;

function generateToken(): string {
  const config = getConfig();
  if (!config.appStoreConnect) {
    throw new Error('App Store Connect not configured');
  }

  const now = Math.floor(Date.now() / 1000);

  // Check cached token
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const { keyId, issuerId, privateKey } = config.appStoreConnect;

  // Token expires in 20 minutes (max allowed by Apple)
  const expiresAt = now + 20 * 60;

  const token = jwt.sign(
    {
      iss: issuerId,
      iat: now,
      exp: expiresAt,
      aud: 'appstoreconnect-v1',
    },
    privateKey.replace(/\\n/g, '\n'),
    {
      algorithm: 'ES256',
      keyid: keyId,
    }
  );

  cachedToken = { token, expiresAt };
  return token;
}

async function fetchWithAuth(url: string): Promise<Response> {
  const token = generateToken();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`App Store Connect API error: ${response.status} - ${error}`);
  }

  return response;
}

interface SalesReportRow {
  provider: string;
  providerCountry: string;
  sku: string;
  developer: string;
  title: string;
  version: string;
  productTypeIdentifier: string;
  units: number;
  developerProceeds: number;
  beginDate: string;
  endDate: string;
  customerCurrency: string;
  countryCode: string;
  currencyOfProceeds: string;
  appleIdentifier: string;
  customerPrice: number;
  promoCode: string;
  parentIdentifier: string;
  subscription: string;
  period: string;
  category: string;
  cmb: string;
  device: string;
  supportedPlatforms: string;
  proceedsReason: string;
  preservedPricing: string;
  client: string;
  orderType: string;
}

async function downloadSalesReport(date: Date): Promise<SalesReportRow[]> {
  // App Store Connect Sales Reports
  const reportDate = formatDate(date);
  const vendorNumber = process.env.APP_STORE_CONNECT_VENDOR_NUMBER;

  if (!vendorNumber) {
    throw new Error('APP_STORE_CONNECT_VENDOR_NUMBER not configured');
  }

  const url = `${APP_STORE_CONNECT_API}/salesReports?filter[reportType]=SALES&filter[reportSubType]=SUMMARY&filter[frequency]=DAILY&filter[reportDate]=${reportDate}&filter[vendorNumber]=${vendorNumber}`;

  try {
    const response = await fetchWithAuth(url);
    const data = await response.text();

    // Parse TSV response
    const lines = data.split('\n').filter((line) => line.trim());
    if (lines.length <= 1) return [];

    const headers = lines[0]!.split('\t');
    const rows: SalesReportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split('\t');
      const row: Record<string, string | number> = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        // Convert numeric fields
        if (['units', 'developerProceeds', 'customerPrice'].includes(header)) {
          row[header] = parseFloat(value) || 0;
        } else {
          row[header] = value;
        }
      });

      rows.push(row as unknown as SalesReportRow);
    }

    return rows;
  } catch (error) {
    // Sales reports have ~1-day delay, so today's date will always 404
    const msg = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn(`  No sales data for ${reportDate} (${msg})`);
    return [];
  }
}

// NOTE: App Store Connect Analytics Reports API requires a multi-step flow:
// 1. POST /v1/analyticsReportRequests (one-time setup per app, takes 1-2 days)
// 2. GET /v1/analyticsReportRequests/{id}/reports (filter by category)
// 3. GET /v1/analyticsReports/{id}/instances (filter by date)
// 4. GET /v1/analyticsReportInstances/{id}/segments (get download URLs)
// 5. Download gzipped TSV data
// For now, install counts are derived from sales report data.
// TODO: Implement full Analytics Reports API for impressions, page views, uninstalls.

export async function ingestAppStoreData(
  context: IngestionContext
): Promise<IngestionResult> {
  const config = getConfig();
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  if (!config.appStoreConnect) {
    return {
      success: true,
      source: 'app-store',
      date: dateStr,
      records_processed: 0,
      error: 'App Store Connect not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'app-store',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Get iOS apps
    const iosApps = context.apps.filter((app) =>
      app.platforms.includes('ios')
    );

    // Fetch sales report
    const salesReport = await downloadSalesReport(context.date);

    // Group sales by app and country
    const salesByApp = new Map<string, Map<string, SalesReportRow[]>>();
    for (const row of salesReport) {
      const appKey = row.appleIdentifier;
      if (!salesByApp.has(appKey)) {
        salesByApp.set(appKey, new Map());
      }
      const countryMap = salesByApp.get(appKey)!;
      const country = row.countryCode;
      if (!countryMap.has(country)) {
        countryMap.set(country, []);
      }
      countryMap.get(country)!.push(row);
    }

    // Process each iOS app
    for (const app of iosApps) {
      if (!app.apple_app_id) continue;

      // Process sales data (revenue + install counts derived from units)
      const appSales = salesByApp.get(app.apple_app_id);
      if (appSales) {
        let totalInstalls = 0;
        let totalUpdates = 0;

        for (const [country, rows] of appSales) {
          const grossRevenue = rows.reduce(
            (sum, row) => sum + (row.units * row.customerPrice),
            0
          );
          const netRevenue = rows.reduce(
            (sum, row) => sum + row.developerProceeds,
            0
          );
          const transactions = rows.reduce((sum, row) => sum + row.units, 0);

          // Separate subscription vs IAP revenue
          const subRevenue = rows
            .filter((r) => r.subscription === 'Yes')
            .reduce((sum, row) => sum + row.developerProceeds, 0);
          const iapRevenue = rows
            .filter((r) => r.subscription !== 'Yes')
            .reduce((sum, row) => sum + row.developerProceeds, 0);

          // Count installs vs updates from product type
          // ProductTypeIdentifier: 1 = free, 1F = free universal, 7 = update, 7F = update universal
          const installs = rows
            .filter((r) => !r.productTypeIdentifier.startsWith('7'))
            .reduce((sum, row) => sum + Math.abs(row.units), 0);
          const updates = rows
            .filter((r) => r.productTypeIdentifier.startsWith('7'))
            .reduce((sum, row) => sum + Math.abs(row.units), 0);

          totalInstalls += installs;
          totalUpdates += updates;

          await upsertDailyRevenue({
            app_id: app.id,
            date: dateStr,
            platform: 'ios',
            country,
            currency: 'USD',
            gross_revenue: grossRevenue,
            net_revenue: netRevenue,
            refunds: 0,
            iap_revenue: iapRevenue,
            subscription_revenue: subRevenue,
            transaction_count: transactions,
            raw_data: { rows } as unknown as Record<string, unknown>,
          });
          recordsProcessed++;
        }

        // Upsert aggregate installs from sales data
        if (totalInstalls > 0 || totalUpdates > 0) {
          await upsertDailyInstalls({
            app_id: app.id,
            date: dateStr,
            platform: 'ios',
            country: '', // Aggregate — non-null for UNIQUE constraint upsert
            installs: totalInstalls,
            uninstalls: 0, // Not available from sales reports
            updates: totalUpdates,
            product_page_views: 0, // Requires Analytics Reports API
            impressions: 0, // Requires Analytics Reports API
            raw_data: { source: 'sales_report' } as unknown as Record<string, unknown>,
          });
          recordsProcessed++;
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'app-store',
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
      source: 'app-store',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
