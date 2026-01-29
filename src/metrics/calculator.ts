import { formatDate } from '../config/index.js';
import { getSupabaseClient } from '../db/client.js';
import type {
  App,
  DailyRevenue,
  DailySubscriptions,
  DailyActiveUsers,
  DailyInstalls,
} from '../types/index.js';

// ============================================
// MRR CALCULATIONS
// ============================================

export interface MRRMetrics {
  mrr: number;
  mrrChange: number;
  mrrChangePercent: number;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
  contractionMrr: number;
}

export async function calculateMRR(
  appId: string,
  date: Date
): Promise<MRRMetrics> {
  const supabase = getSupabaseClient();
  const dateStr = formatDate(date);

  // Get previous day for comparison
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = formatDate(prevDate);

  // Get current day subscriptions
  const { data: current } = await supabase
    .from('daily_subscriptions')
    .select('*')
    .eq('app_id', appId)
    .eq('date', dateStr);

  // Get previous day subscriptions
  const { data: previous } = await supabase
    .from('daily_subscriptions')
    .select('*')
    .eq('app_id', appId)
    .eq('date', prevDateStr);

  const currentMrr = (current || []).reduce(
    (sum, s) => sum + (s.mrr || 0),
    0
  );
  const previousMrr = (previous || []).reduce(
    (sum, s) => sum + (s.mrr || 0),
    0
  );

  // Calculate MRR components
  const newSubs = (current || []).reduce(
    (sum, s) => sum + (s.new_subscriptions || 0),
    0
  );
  const churnedSubs = (current || []).reduce(
    (sum, s) => sum + (s.cancellations || 0) + (s.expirations || 0),
    0
  );

  // Estimate MRR per subscriber for calculations
  const avgMrrPerSub =
    currentMrr > 0 && (current?.[0]?.active_subscriptions || 0) > 0
      ? currentMrr / (current?.[0]?.active_subscriptions || 1)
      : 0;

  return {
    mrr: currentMrr,
    mrrChange: currentMrr - previousMrr,
    mrrChangePercent:
      previousMrr > 0
        ? ((currentMrr - previousMrr) / previousMrr) * 100
        : 0,
    newMrr: newSubs * avgMrrPerSub,
    churnedMrr: churnedSubs * avgMrrPerSub,
    expansionMrr: 0, // Would need subscription tier tracking
    contractionMrr: 0,
  };
}

// ============================================
// CHURN CALCULATIONS
// ============================================

export interface ChurnMetrics {
  dailyChurnRate: number;
  monthlyChurnRate: number;
  annualChurnRate: number;
  churnedSubscriptions: number;
  totalCancellations: number;
  totalExpirations: number;
}

export async function calculateChurn(
  appId: string,
  date: Date
): Promise<ChurnMetrics> {
  const supabase = getSupabaseClient();
  const dateStr = formatDate(date);

  // Get current day subscriptions
  const { data: current } = await supabase
    .from('daily_subscriptions')
    .select('*')
    .eq('app_id', appId)
    .eq('date', dateStr);

  const activeSubscriptions = (current || []).reduce(
    (sum, s) => sum + (s.active_subscriptions || 0),
    0
  );
  const cancellations = (current || []).reduce(
    (sum, s) => sum + (s.cancellations || 0),
    0
  );
  const expirations = (current || []).reduce(
    (sum, s) => sum + (s.expirations || 0),
    0
  );
  const churned = cancellations + expirations;

  const totalAtRisk = activeSubscriptions + churned;
  const dailyChurnRate =
    totalAtRisk > 0 ? (churned / totalAtRisk) * 100 : 0;

  // Extrapolate to monthly/annual (compound)
  const monthlyChurnRate = (1 - Math.pow(1 - dailyChurnRate / 100, 30)) * 100;
  const annualChurnRate = (1 - Math.pow(1 - dailyChurnRate / 100, 365)) * 100;

  return {
    dailyChurnRate,
    monthlyChurnRate,
    annualChurnRate,
    churnedSubscriptions: churned,
    totalCancellations: cancellations,
    totalExpirations: expirations,
  };
}

// ============================================
// RETENTION CALCULATIONS
// ============================================

export interface RetentionMetrics {
  d1Retention: number | null;
  d7Retention: number | null;
  d30Retention: number | null;
  trialConversionRate: number | null;
}

export async function calculateRetention(
  appId: string,
  date: Date
): Promise<RetentionMetrics> {
  const supabase = getSupabaseClient();
  const dateStr = formatDate(date);

  // Get active users data (which includes retention)
  const { data: activeUsers } = await supabase
    .from('daily_active_users')
    .select('*')
    .eq('app_id', appId)
    .eq('date', dateStr)
    .eq('platform', 'all')
    .single();

  // Get subscription data for trial conversion
  const { data: subscriptions } = await supabase
    .from('daily_subscriptions')
    .select('*')
    .eq('app_id', appId)
    .eq('date', dateStr);

  const trials = (subscriptions || []).reduce(
    (sum, s) => sum + (s.active_trials || 0),
    0
  );
  const conversions = (subscriptions || []).reduce(
    (sum, s) => sum + (s.trial_conversions || 0),
    0
  );

  // Get trials from 7 days ago to calculate conversion rate
  const trialDate = new Date(date);
  trialDate.setDate(trialDate.getDate() - 7);
  const trialDateStr = formatDate(trialDate);

  const { data: pastTrials } = await supabase
    .from('daily_subscriptions')
    .select('new_trials')
    .eq('app_id', appId)
    .eq('date', trialDateStr);

  const pastTrialCount = (pastTrials || []).reduce(
    (sum, s) => sum + (s.new_trials || 0),
    0
  );

  return {
    d1Retention: activeUsers?.d1_retention ?? null,
    d7Retention: activeUsers?.d7_retention ?? null,
    d30Retention: activeUsers?.d30_retention ?? null,
    trialConversionRate:
      pastTrialCount > 0 ? (conversions / pastTrialCount) * 100 : null,
  };
}

// ============================================
// COST METRICS
// ============================================

export interface CostMetrics {
  totalCosts: number;
  costPerUser: number;
  costPerActiveUser: number;
  costPerPaidUser: number;
  providerBreakdown: Record<string, number>;
}

export async function calculateCosts(
  appId: string | null, // null for portfolio-wide
  date: Date
): Promise<CostMetrics> {
  const supabase = getSupabaseClient();
  const dateStr = formatDate(date);

  // Get provider costs
  let costsQuery = supabase
    .from('daily_provider_costs')
    .select('*, providers(slug, name)')
    .eq('date', dateStr);

  if (appId) {
    costsQuery = costsQuery.eq('app_id', appId);
  }

  const { data: costs } = await costsQuery;

  const totalCosts = (costs || []).reduce((sum, c) => sum + (c.cost || 0), 0);

  // Build provider breakdown
  const providerBreakdown: Record<string, number> = {};
  for (const cost of costs || []) {
    const providerName = (cost.providers as { slug: string })?.slug || 'unknown';
    providerBreakdown[providerName] =
      (providerBreakdown[providerName] || 0) + (cost.cost || 0);
  }

  // Get user counts
  let usersQuery = supabase
    .from('daily_active_users')
    .select('*')
    .eq('date', dateStr)
    .eq('platform', 'all');

  if (appId) {
    usersQuery = usersQuery.eq('app_id', appId);
  }

  const { data: users } = await usersQuery;

  const totalDau = (users || []).reduce((sum, u) => sum + (u.dau || 0), 0);
  const totalMau = (users || []).reduce((sum, u) => sum + (u.mau || 0), 0);

  // Get paid users
  let revenueQuery = supabase
    .from('daily_revenue')
    .select('paying_users')
    .eq('date', dateStr);

  if (appId) {
    revenueQuery = revenueQuery.eq('app_id', appId);
  }

  const { data: revenue } = await revenueQuery;
  const paidUsers = (revenue || []).reduce(
    (sum, r) => sum + (r.paying_users || 0),
    0
  );

  return {
    totalCosts,
    costPerUser: totalMau > 0 ? totalCosts / totalMau : 0,
    costPerActiveUser: totalDau > 0 ? totalCosts / totalDau : 0,
    costPerPaidUser: paidUsers > 0 ? totalCosts / paidUsers : 0,
    providerBreakdown,
  };
}

// ============================================
// REVENUE METRICS
// ============================================

export interface RevenueMetrics {
  grossRevenue: number;
  netRevenue: number;
  refunds: number;
  arpu: number; // Average revenue per user
  arppu: number; // Average revenue per paying user
  revenueByPlatform: Record<string, number>;
  revenueByType: {
    subscription: number;
    iap: number;
    ad: number;
  };
}

export async function calculateRevenue(
  appId: string,
  date: Date
): Promise<RevenueMetrics> {
  const supabase = getSupabaseClient();
  const dateStr = formatDate(date);

  // Get revenue data
  const { data: revenue } = await supabase
    .from('daily_revenue')
    .select('*')
    .eq('app_id', appId)
    .eq('date', dateStr);

  const grossRevenue = (revenue || []).reduce(
    (sum, r) => sum + (r.gross_revenue || 0),
    0
  );
  const netRevenue = (revenue || []).reduce(
    (sum, r) => sum + (r.net_revenue || 0),
    0
  );
  const refunds = (revenue || []).reduce(
    (sum, r) => sum + (r.refunds || 0),
    0
  );
  const payingUsers = (revenue || []).reduce(
    (sum, r) => sum + (r.paying_users || 0),
    0
  );

  // Revenue by platform
  const revenueByPlatform: Record<string, number> = {};
  for (const r of revenue || []) {
    revenueByPlatform[r.platform] =
      (revenueByPlatform[r.platform] || 0) + (r.net_revenue || 0);
  }

  // Revenue by type
  const subscriptionRevenue = (revenue || []).reduce(
    (sum, r) => sum + (r.subscription_revenue || 0),
    0
  );
  const iapRevenue = (revenue || []).reduce(
    (sum, r) => sum + (r.iap_revenue || 0),
    0
  );
  const adRevenue = (revenue || []).reduce(
    (sum, r) => sum + (r.ad_revenue || 0),
    0
  );

  // Get DAU for ARPU
  const { data: users } = await supabase
    .from('daily_active_users')
    .select('dau')
    .eq('app_id', appId)
    .eq('date', dateStr)
    .eq('platform', 'all')
    .single();

  const dau = users?.dau || 0;

  return {
    grossRevenue,
    netRevenue,
    refunds,
    arpu: dau > 0 ? netRevenue / dau : 0,
    arppu: payingUsers > 0 ? netRevenue / payingUsers : 0,
    revenueByPlatform,
    revenueByType: {
      subscription: subscriptionRevenue,
      iap: iapRevenue,
      ad: adRevenue,
    },
  };
}

// ============================================
// GROWTH METRICS
// ============================================

export interface GrowthMetrics {
  installs: number;
  installsChange: number;
  installsChangePercent: number;
  dauGrowth: number;
  dauGrowthPercent: number;
  revenueGrowth: number;
  revenueGrowthPercent: number;
}

export async function calculateGrowth(
  appId: string,
  date: Date
): Promise<GrowthMetrics> {
  const supabase = getSupabaseClient();
  const dateStr = formatDate(date);

  // Get previous day
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = formatDate(prevDate);

  // Current day data
  const [{ data: currentInstalls }, { data: currentUsers }, { data: currentRevenue }] =
    await Promise.all([
      supabase
        .from('daily_installs')
        .select('installs')
        .eq('app_id', appId)
        .eq('date', dateStr),
      supabase
        .from('daily_active_users')
        .select('dau')
        .eq('app_id', appId)
        .eq('date', dateStr)
        .eq('platform', 'all'),
      supabase
        .from('daily_revenue')
        .select('net_revenue')
        .eq('app_id', appId)
        .eq('date', dateStr),
    ]);

  // Previous day data
  const [{ data: prevInstalls }, { data: prevUsers }, { data: prevRevenue }] =
    await Promise.all([
      supabase
        .from('daily_installs')
        .select('installs')
        .eq('app_id', appId)
        .eq('date', prevDateStr),
      supabase
        .from('daily_active_users')
        .select('dau')
        .eq('app_id', appId)
        .eq('date', prevDateStr)
        .eq('platform', 'all'),
      supabase
        .from('daily_revenue')
        .select('net_revenue')
        .eq('app_id', appId)
        .eq('date', prevDateStr),
    ]);

  const installs = (currentInstalls || []).reduce(
    (sum, i) => sum + (i.installs || 0),
    0
  );
  const prevInstallsTotal = (prevInstalls || []).reduce(
    (sum, i) => sum + (i.installs || 0),
    0
  );

  const dau = currentUsers?.[0]?.dau || 0;
  const prevDau = prevUsers?.[0]?.dau || 0;

  const revenue = (currentRevenue || []).reduce(
    (sum, r) => sum + (r.net_revenue || 0),
    0
  );
  const prevRevenueTotal = (prevRevenue || []).reduce(
    (sum, r) => sum + (r.net_revenue || 0),
    0
  );

  return {
    installs,
    installsChange: installs - prevInstallsTotal,
    installsChangePercent:
      prevInstallsTotal > 0
        ? ((installs - prevInstallsTotal) / prevInstallsTotal) * 100
        : 0,
    dauGrowth: dau - prevDau,
    dauGrowthPercent: prevDau > 0 ? ((dau - prevDau) / prevDau) * 100 : 0,
    revenueGrowth: revenue - prevRevenueTotal,
    revenueGrowthPercent:
      prevRevenueTotal > 0
        ? ((revenue - prevRevenueTotal) / prevRevenueTotal) * 100
        : 0,
  };
}

// ============================================
// COMBINED APP METRICS
// ============================================

export interface AppDailyMetrics {
  app: App;
  date: string;
  mrr: MRRMetrics;
  churn: ChurnMetrics;
  retention: RetentionMetrics;
  revenue: RevenueMetrics;
  growth: GrowthMetrics;
}

export async function calculateAppMetrics(
  app: App,
  date: Date
): Promise<AppDailyMetrics> {
  const [mrr, churn, retention, revenue, growth] = await Promise.all([
    calculateMRR(app.id, date),
    calculateChurn(app.id, date),
    calculateRetention(app.id, date),
    calculateRevenue(app.id, date),
    calculateGrowth(app.id, date),
  ]);

  return {
    app,
    date: formatDate(date),
    mrr,
    churn,
    retention,
    revenue,
    growth,
  };
}
