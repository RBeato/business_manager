/**
 * Telegram Message Formatters
 *
 * All functions return Markdown-formatted strings for Telegram messages.
 */

import type { MetricsSnapshot, ReportInsight } from '../types/index.js';
import type { CreditStatus } from '../monitoring/credits.js';

/**
 * Format daily business report for Telegram
 */
export function formatDailyReport(
  date: string,
  metrics: MetricsSnapshot,
  insights: ReportInsight[],
): string {
  const lines: string[] = [];

  lines.push(`\ud83d\udcca *Daily Report — ${date}*`);
  lines.push('');

  // Revenue
  lines.push('*Revenue & MRR*');
  lines.push(`  Total Revenue: $${metrics.total_revenue.toFixed(2)} (${formatChange(metrics.revenue_change_pct)})`);
  lines.push(`  MRR: $${metrics.total_mrr.toFixed(2)}`);
  lines.push('');

  // Users
  lines.push('*Users*');
  lines.push(`  DAU: ${metrics.total_dau.toLocaleString()} (${formatChange(metrics.dau_change_pct)})`);
  lines.push(`  Installs: ${metrics.total_installs.toLocaleString()}`);
  lines.push('');

  // Costs
  lines.push('*Costs*');
  lines.push(`  Total: $${metrics.total_costs.toFixed(2)} (${formatChange(metrics.costs_change_pct)})`);
  lines.push(`  Cost/User: $${metrics.cost_per_user.toFixed(4)}`);
  lines.push('');

  // Top apps
  if (metrics.apps.length > 0) {
    lines.push('*By App*');
    for (const app of metrics.apps) {
      if (app.revenue > 0 || app.dau > 0) {
        lines.push(`  ${app.app_name}: $${app.revenue.toFixed(2)} rev, ${app.dau} DAU`);
      }
    }
    lines.push('');
  }

  // AI Insights
  if (insights.length > 0) {
    lines.push('*Insights*');
    for (const insight of insights.slice(0, 5)) {
      const icon = insight.type === 'positive' ? '\u2705' :
                   insight.type === 'negative' ? '\ud83d\udfe5' :
                   insight.type === 'alert' ? '\u26a0\ufe0f' : '\u2139\ufe0f';
      lines.push(`${icon} ${insight.title}`);
      lines.push(`   ${insight.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format blog post for review in Telegram
 */
export function formatBlogReview(blogPost: {
  id: string;
  title: string;
  website: string;
  seo_score: number;
  word_count: number;
  meta_description: string;
  target_keyword: string;
  content: string;
}): string {
  const lines: string[] = [];

  lines.push(`\ud83d\udcdd *New Blog Post for Review*`);
  lines.push('');
  lines.push(`*Title:* ${escapeMarkdown(blogPost.title)}`);
  lines.push(`*Website:* ${blogPost.website}`);
  lines.push(`*Keyword:* ${escapeMarkdown(blogPost.target_keyword)}`);
  lines.push(`*SEO Score:* ${blogPost.seo_score}/100`);
  lines.push(`*Words:* ${blogPost.word_count}`);
  lines.push('');
  lines.push(`*Meta:* ${escapeMarkdown(blogPost.meta_description)}`);
  lines.push('');

  // Show first ~500 chars of content as preview
  const preview = blogPost.content.slice(0, 500).replace(/[#*_`\[\]]/g, '');
  lines.push(`*Preview:*`);
  lines.push(preview + '...');

  return lines.join('\n');
}

/**
 * Format full blog post preview (truncated for Telegram's 4096 char limit)
 */
export function formatBlogFullPreview(blogPost: {
  title: string;
  content: string;
}): string {
  const header = `\ud83d\udcdd *${escapeMarkdown(blogPost.title)}*\n\n`;
  const maxContentLength = 4000 - header.length;

  let content = blogPost.content;
  if (content.length > maxContentLength) {
    content = content.slice(0, maxContentLength) + '\n\n_... (truncated)_';
  }

  // Strip markdown formatting that conflicts with Telegram
  content = content
    .replace(/^#{1,6}\s+/gm, '*')
    .replace(/\*\*/g, '*');

  return header + content;
}

/**
 * Format credit alert for Telegram
 */
export function formatCreditAlert(alerts: CreditStatus[]): string {
  const lines: string[] = [];

  lines.push('\ud83d\udea8 *API Credit Alert*');
  lines.push('');

  for (const alert of alerts) {
    const icon = alert.status === 'critical' ? '\ud83d\udfe5' : '\ud83d\udfe1';
    lines.push(`${icon} *${alert.service}* — ${alert.status.toUpperCase()}`);
    lines.push(`   ${alert.message}`);
    lines.push('');
  }

  lines.push('_Check service dashboards to add credits._');

  return lines.join('\n');
}

function formatChange(pct: number): string {
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `${pct.toFixed(1)}%`;
  return '0%';
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
