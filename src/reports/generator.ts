import { formatDate } from '../config/index.js';
import { upsertDailyReport } from '../db/client.js';
import { generateMetricsSnapshot, getTrends } from '../metrics/index.js';
import { generateInsights } from './ai-insights.js';
import { generateEmailHtml } from './templates/daily-email.js';
import type { GeneratedReport, ReportConfig, MetricsSnapshot, ReportInsight } from '../types/index.js';

export async function generateDailyReport(
  config: ReportConfig
): Promise<GeneratedReport> {
  const dateStr = formatDate(config.date);

  console.log(`Generating ${config.type} report for ${dateStr}...`);

  // Generate metrics snapshot
  console.log('Calculating metrics snapshot...');
  const metrics = await generateMetricsSnapshot(config.date);

  // Get trend data for charts
  console.log('Fetching trend data...');
  const trends = await getTrends(7);

  // Generate AI insights
  let insights: ReportInsight[] = [];
  if (config.includeInsights) {
    console.log('Generating AI insights...');
    try {
      insights = await generateInsights(metrics, trends);
    } catch (error) {
      console.warn('Could not generate AI insights:', error);
      insights = generateFallbackInsights(metrics);
    }
  } else {
    insights = generateFallbackInsights(metrics);
  }

  // Generate HTML email
  console.log('Generating email HTML...');
  const html = generateEmailHtml({
    date: dateStr,
    metrics,
    insights,
    trends,
  });

  // Save report to database
  console.log('Saving report to database...');
  await upsertDailyReport({
    date: dateStr,
    report_type: config.type,
    summary_text: insights.map((i) => `${i.title}: ${i.description}`).join('\n'),
    insights,
    metrics_snapshot: metrics as unknown as MetricsSnapshot,
    html_content: html,
  });

  return {
    date: dateStr,
    type: config.type,
    metrics,
    insights,
    html,
  };
}

function generateFallbackInsights(metrics: MetricsSnapshot): ReportInsight[] {
  const insights: ReportInsight[] = [];

  // Revenue insight
  if (metrics.revenue_change_pct !== 0) {
    insights.push({
      type: metrics.revenue_change_pct > 0 ? 'positive' : 'negative',
      category: 'revenue',
      title:
        metrics.revenue_change_pct > 0 ? 'Revenue Growing' : 'Revenue Declining',
      description: `Total revenue ${
        metrics.revenue_change_pct > 0 ? 'increased' : 'decreased'
      } by ${Math.abs(metrics.revenue_change_pct).toFixed(1)}% compared to yesterday.`,
      metric_change: metrics.revenue_change_pct,
      metric_unit: '%',
    });
  }

  // DAU insight
  if (metrics.dau_change_pct !== 0) {
    insights.push({
      type: metrics.dau_change_pct > 0 ? 'positive' : 'negative',
      category: 'users',
      title:
        metrics.dau_change_pct > 0
          ? 'User Engagement Up'
          : 'User Engagement Down',
      description: `Daily active users ${
        metrics.dau_change_pct > 0 ? 'grew' : 'dropped'
      } by ${Math.abs(metrics.dau_change_pct).toFixed(1)}%.`,
      metric_change: metrics.dau_change_pct,
      metric_unit: '%',
    });
  }

  // Cost insight
  if (metrics.costs_change_pct !== 0) {
    const costTrend = metrics.costs_change_pct > 0 ? 'increased' : 'decreased';
    insights.push({
      type: metrics.costs_change_pct > 10 ? 'alert' : 'neutral',
      category: 'costs',
      title: `Infrastructure Costs ${metrics.costs_change_pct > 0 ? 'Up' : 'Down'}`,
      description: `Total provider costs ${costTrend} by ${Math.abs(
        metrics.costs_change_pct
      ).toFixed(1)}%.`,
      metric_change: metrics.costs_change_pct,
      metric_unit: '%',
    });
  }

  // Top performing app
  const topApp = metrics.apps.sort((a, b) => b.revenue - a.revenue)[0];
  if (topApp && topApp.revenue > 0) {
    insights.push({
      type: 'positive',
      category: 'revenue',
      title: 'Top Revenue Driver',
      description: `${topApp.app_name} generated $${topApp.revenue.toFixed(
        2
      )} in revenue today.`,
    });
  }

  // Highest growth app
  const growingApp = metrics.apps.sort(
    (a, b) => b.revenue_change_pct - a.revenue_change_pct
  )[0];
  if (growingApp && growingApp.revenue_change_pct > 10) {
    insights.push({
      type: 'positive',
      category: 'revenue',
      title: 'Fastest Growing',
      description: `${growingApp.app_name} saw ${growingApp.revenue_change_pct.toFixed(
        1
      )}% revenue growth.`,
      metric_change: growingApp.revenue_change_pct,
      metric_unit: '%',
    });
  }

  // MRR summary
  if (metrics.total_mrr > 0) {
    insights.push({
      type: 'neutral',
      category: 'revenue',
      title: 'MRR Status',
      description: `Current MRR stands at $${metrics.total_mrr.toFixed(
        2
      )} across all apps.`,
    });
  }

  return insights;
}

export interface ReportSummary {
  date: string;
  type: 'daily' | 'weekly' | 'monthly';
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  topInsights: string[];
}

export function summarizeReport(report: GeneratedReport): ReportSummary {
  return {
    date: report.date,
    type: report.type,
    totalRevenue: report.metrics.total_revenue,
    totalCosts: report.metrics.total_costs,
    netProfit: report.metrics.total_revenue - report.metrics.total_costs,
    topInsights: report.insights.slice(0, 3).map((i) => i.title),
  };
}
