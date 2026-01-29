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
const ANALYTICS_API = 'https://api.appstoreconnect.apple.com/v1/analyticsReports';

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
  const url = `${APP_STORE_CONNECT_API}/salesReports?filter[reportType]=SALES&filter[reportSubType]=SUMMARY&filter[frequency]=DAILY&filter[reportDate]=${reportDate}&filter[vendorNumber]=YOUR_VENDOR_NUMBER`;

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
    // Sales reports may not be available for recent dates
    console.warn(`Could not fetch sales report for ${reportDate}:`, error);
    return [];
  }
}

interface AnalyticsMetrics {
  installs: number;
  uninstalls: number;
  updates: number;
  productPageViews: number;
  impressions: number;
}

async function fetchAnalyticsForApp(
  app: App,
  date: Date
): Promise<AnalyticsMetrics | null> {
  if (!app.apple_app_id) return null;

  const dateStr = formatDate(date);

  try {
    // Fetch app analytics (requires Analytics Reports API access)
    // This is a simplified version - actual implementation depends on report availability
    const url = `${ANALYTICS_API}?filter[app]=${app.apple_app_id}&filter[date]=${dateStr}`;
    const response = await fetchWithAuth(url);
    const data = await response.json() as { data?: { installs?: number; uninstalls?: number; updates?: number; productPageViews?: number; impressions?: number } };

    // Parse analytics data (structure varies by report type)
    return {
      installs: data.data?.installs ?? 0,
      uninstalls: data.data?.uninstalls ?? 0,
      updates: data.data?.updates ?? 0,
      productPageViews: data.data?.productPageViews ?? 0,
      impressions: data.data?.impressions ?? 0,
    };
  } catch (error) {
    console.warn(`Could not fetch analytics for ${app.slug}:`, error);
    return null;
  }
}

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

      // Fetch analytics
      const analytics = await fetchAnalyticsForApp(app, context.date);

      if (analytics) {
        // Upsert installs (aggregate for iOS platform)
        await upsertDailyInstalls({
          app_id: app.id,
          date: dateStr,
          platform: 'ios',
          country: undefined,
          installs: analytics.installs,
          uninstalls: analytics.uninstalls,
          updates: analytics.updates,
          product_page_views: analytics.productPageViews,
          impressions: analytics.impressions,
          raw_data: analytics as unknown as Record<string, unknown>,
        });
        recordsProcessed++;
      }

      // Process sales data
      const appSales = salesByApp.get(app.apple_app_id);
      if (appSales) {
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
