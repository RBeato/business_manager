import { formatDate } from '../config/index.js';
import {
  getActiveApps,
  getActiveProviders,
  getDailyMetricsForDate,
  getMetricsForDateRange,
} from '../db/client.js';
import {
  calculateAppMetrics,
  calculateCosts,
  type AppDailyMetrics,
  type CostMetrics,
} from './calculator.js';
import type {
  MetricsSnapshot,
  AppMetricsSnapshot,
  ProviderMetricsSnapshot,
  App,
} from '../types/index.js';

// ============================================
// PORTFOLIO AGGREGATION
// ============================================

export interface PortfolioMetrics {
  date: string;
  totalRevenue: number;
  totalMrr: number;
  totalDau: number;
  totalInstalls: number;
  totalCosts: number;
  netProfit: number;
  costPerUser: number;
  apps: AppDailyMetrics[];
  costs: CostMetrics;
}

export async function aggregatePortfolioMetrics(
  date: Date
): Promise<PortfolioMetrics> {
  const apps = await getActiveApps();
  const dateStr = formatDate(date);

  // Calculate metrics for each app
  const appMetrics = await Promise.all(
    apps.map((app) => calculateAppMetrics(app, date))
  );

  // Calculate portfolio-wide costs
  const costs = await calculateCosts(null, date);

  // Aggregate totals
  const totalRevenue = appMetrics.reduce(
    (sum, m) => sum + m.revenue.netRevenue,
    0
  );
  const totalMrr = appMetrics.reduce((sum, m) => sum + m.mrr.mrr, 0);
  const totalDau = appMetrics.reduce(
    (sum, m) => sum + (m.growth.installs > 0 ? m.growth.installs : 0),
    0
  ); // Rough estimate
  const totalInstalls = appMetrics.reduce(
    (sum, m) => sum + m.growth.installs,
    0
  );

  return {
    date: dateStr,
    totalRevenue,
    totalMrr,
    totalDau,
    totalInstalls,
    totalCosts: costs.totalCosts,
    netProfit: totalRevenue - costs.totalCosts,
    costPerUser: costs.costPerUser,
    apps: appMetrics,
    costs,
  };
}

// ============================================
// METRICS SNAPSHOT (for reports)
// ============================================

export async function generateMetricsSnapshot(
  date: Date
): Promise<MetricsSnapshot> {
  const apps = await getActiveApps();
  const providers = await getActiveProviders();
  const dateStr = formatDate(date);

  // Get previous day for comparisons
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);

  // Get metrics for both days
  const [currentMetrics, prevMetrics] = await Promise.all([
    getDailyMetricsForDate(dateStr),
    getDailyMetricsForDate(formatDate(prevDate)),
  ]);

  // Calculate totals
  const totalRevenue = currentMetrics.revenue.reduce(
    (sum, r) => sum + (r.net_revenue || 0),
    0
  );
  const prevRevenue = prevMetrics.revenue.reduce(
    (sum, r) => sum + (r.net_revenue || 0),
    0
  );

  const totalMrr = currentMetrics.subscriptions.reduce(
    (sum, s) => sum + (s.mrr || 0),
    0
  );

  const totalDau = currentMetrics.activeUsers
    .filter((u) => u.platform === 'all')
    .reduce((sum, u) => sum + (u.dau || 0), 0);
  const prevDau = prevMetrics.activeUsers
    .filter((u) => u.platform === 'all')
    .reduce((sum, u) => sum + (u.dau || 0), 0);

  const totalInstalls = currentMetrics.installs.reduce(
    (sum, i) => sum + (i.installs || 0),
    0
  );

  const totalCosts = currentMetrics.providerCosts.reduce(
    (sum, c) => sum + (c.cost || 0),
    0
  );
  const prevCosts = prevMetrics.providerCosts.reduce(
    (sum, c) => sum + (c.cost || 0),
    0
  );

  // Build app snapshots
  const appSnapshots: AppMetricsSnapshot[] = apps.map((app) => {
    const appRevenue = currentMetrics.revenue
      .filter((r) => r.app_id === app.id)
      .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
    const prevAppRevenue = prevMetrics.revenue
      .filter((r) => r.app_id === app.id)
      .reduce((sum, r) => sum + (r.net_revenue || 0), 0);

    const appMrr = currentMetrics.subscriptions
      .filter((s) => s.app_id === app.id)
      .reduce((sum, s) => sum + (s.mrr || 0), 0);

    const appDau =
      currentMetrics.activeUsers.find(
        (u) => u.app_id === app.id && u.platform === 'all'
      )?.dau || 0;
    const prevAppDau =
      prevMetrics.activeUsers.find(
        (u) => u.app_id === app.id && u.platform === 'all'
      )?.dau || 0;

    const appInstalls = currentMetrics.installs
      .filter((i) => i.app_id === app.id)
      .reduce((sum, i) => sum + (i.installs || 0), 0);

    return {
      app_id: app.id,
      app_slug: app.slug,
      app_name: app.name,
      revenue: appRevenue,
      mrr: appMrr,
      dau: appDau,
      installs: appInstalls,
      revenue_change_pct:
        prevAppRevenue > 0
          ? ((appRevenue - prevAppRevenue) / prevAppRevenue) * 100
          : 0,
      dau_change_pct:
        prevAppDau > 0 ? ((appDau - prevAppDau) / prevAppDau) * 100 : 0,
    };
  });

  // Build provider snapshots
  const providerSnapshots: ProviderMetricsSnapshot[] = providers.map(
    (provider) => {
      const providerCost = currentMetrics.providerCosts
        .filter((c) => c.provider_id === provider.id)
        .reduce((sum, c) => sum + (c.cost || 0), 0);
      const prevProviderCost = prevMetrics.providerCosts
        .filter((c) => c.provider_id === provider.id)
        .reduce((sum, c) => sum + (c.cost || 0), 0);

      const usageData = currentMetrics.providerCosts.find(
        (c) => c.provider_id === provider.id
      );

      return {
        provider_id: provider.id,
        provider_slug: provider.slug,
        provider_name: provider.name,
        cost: providerCost,
        usage_quantity: usageData?.usage_quantity,
        usage_unit: usageData?.usage_unit,
        cost_change_pct:
          prevProviderCost > 0
            ? ((providerCost - prevProviderCost) / prevProviderCost) * 100
            : 0,
      };
    }
  );

  return {
    total_revenue: totalRevenue,
    total_mrr: totalMrr,
    revenue_change_pct:
      prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0,
    total_dau: totalDau,
    total_installs: totalInstalls,
    dau_change_pct: prevDau > 0 ? ((totalDau - prevDau) / prevDau) * 100 : 0,
    total_costs: totalCosts,
    cost_per_user: totalDau > 0 ? totalCosts / totalDau : 0,
    costs_change_pct:
      prevCosts > 0 ? ((totalCosts - prevCosts) / prevCosts) * 100 : 0,
    apps: appSnapshots,
    providers: providerSnapshots,
  };
}

// ============================================
// TRENDS
// ============================================

export interface TrendData {
  date: string;
  revenue: number;
  dau: number;
  installs: number;
  costs: number;
}

export async function getTrends(days: number = 30): Promise<TrendData[]> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Yesterday

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);

  const metrics = await getMetricsForDateRange(
    formatDate(startDate),
    formatDate(endDate)
  );

  // Group by date
  const byDate = new Map<string, TrendData>();

  // Initialize all dates
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    byDate.set(dateStr, {
      date: dateStr,
      revenue: 0,
      dau: 0,
      installs: 0,
      costs: 0,
    });
  }

  // Aggregate revenue
  for (const r of metrics.revenue) {
    const entry = byDate.get(r.date);
    if (entry) {
      entry.revenue += r.net_revenue || 0;
    }
  }

  // Aggregate DAU
  for (const u of metrics.activeUsers) {
    if (u.platform === 'all') {
      const entry = byDate.get(u.date);
      if (entry) {
        entry.dau += u.dau || 0;
      }
    }
  }

  // Aggregate installs
  for (const i of metrics.installs) {
    const entry = byDate.get(i.date);
    if (entry) {
      entry.installs += i.installs || 0;
    }
  }

  // Sort by date and return
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// ============================================
// TOP PERFORMERS
// ============================================

export interface TopPerformer {
  app: App;
  metric: string;
  value: number;
  change: number;
}

export async function getTopPerformers(
  date: Date,
  metric: 'revenue' | 'dau' | 'installs' | 'growth',
  limit: number = 5
): Promise<TopPerformer[]> {
  const apps = await getActiveApps();
  const dateStr = formatDate(date);
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = formatDate(prevDate);

  const [currentMetrics, prevMetrics] = await Promise.all([
    getDailyMetricsForDate(dateStr),
    getDailyMetricsForDate(prevDateStr),
  ]);

  const performers: TopPerformer[] = [];

  for (const app of apps) {
    let value = 0;
    let prevValue = 0;

    switch (metric) {
      case 'revenue':
        value = currentMetrics.revenue
          .filter((r) => r.app_id === app.id)
          .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
        prevValue = prevMetrics.revenue
          .filter((r) => r.app_id === app.id)
          .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
        break;
      case 'dau':
        value =
          currentMetrics.activeUsers.find(
            (u) => u.app_id === app.id && u.platform === 'all'
          )?.dau || 0;
        prevValue =
          prevMetrics.activeUsers.find(
            (u) => u.app_id === app.id && u.platform === 'all'
          )?.dau || 0;
        break;
      case 'installs':
        value = currentMetrics.installs
          .filter((i) => i.app_id === app.id)
          .reduce((sum, i) => sum + (i.installs || 0), 0);
        prevValue = prevMetrics.installs
          .filter((i) => i.app_id === app.id)
          .reduce((sum, i) => sum + (i.installs || 0), 0);
        break;
      case 'growth':
        const currentRev = currentMetrics.revenue
          .filter((r) => r.app_id === app.id)
          .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
        const prevRev = prevMetrics.revenue
          .filter((r) => r.app_id === app.id)
          .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
        value = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0;
        prevValue = 0; // Growth is already a change metric
        break;
    }

    performers.push({
      app,
      metric,
      value,
      change: prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0,
    });
  }

  // Sort by value descending
  performers.sort((a, b) => b.value - a.value);

  return performers.slice(0, limit);
}
