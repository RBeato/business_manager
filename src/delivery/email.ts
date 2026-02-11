/**
 * Report Delivery via Telegram
 *
 * Sends daily reports and alerts as Telegram messages.
 * Replaced Resend email integration.
 */

import { sendTelegramMessage, sendAndLogNotification } from './telegram.js';
import { getSupabaseClient } from '../db/client.js';
import type { GeneratedReport } from '../types/index.js';

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Format a GeneratedReport into a concise Telegram message
 */
function formatReportForTelegram(report: GeneratedReport): string {
  const m = report.metrics;
  const lines: string[] = [];

  lines.push(`📊 *Daily Business Report — ${report.date}*`);
  lines.push('');

  // Revenue
  if (m.total_revenue !== undefined) {
    lines.push(`💰 Revenue: $${m.total_revenue.toFixed(2)}`);
  }
  if (m.total_mrr !== undefined && m.total_mrr > 0) {
    lines.push(`📈 MRR: $${m.total_mrr.toFixed(2)}`);
  }

  // Installs
  if (m.total_installs !== undefined && m.total_installs > 0) {
    lines.push(`📲 Installs: ${m.total_installs}`);
  }

  // DAU
  if (m.total_dau !== undefined && m.total_dau > 0) {
    lines.push(`👥 DAU: ${m.total_dau}`);
  }

  // Costs
  if (m.total_costs !== undefined && m.total_costs > 0) {
    lines.push(`💸 Costs: $${m.total_costs.toFixed(2)}`);
  }

  // Per-app breakdown
  if (m.apps && m.apps.length > 0) {
    lines.push('');
    lines.push('*Per-app:*');
    for (const app of m.apps) {
      const parts: string[] = [];
      if (app.revenue > 0) parts.push(`$${app.revenue.toFixed(2)}`);
      if (app.installs > 0) parts.push(`${app.installs} installs`);
      if (app.dau > 0) parts.push(`${app.dau} DAU`);
      if (parts.length > 0) {
        lines.push(`  • ${app.app_name}: ${parts.join(', ')}`);
      }
    }
  }

  // Insights
  if (report.insights && report.insights.length > 0) {
    lines.push('');
    lines.push('*Insights:*');
    for (const insight of report.insights) {
      lines.push(`  ${insight.type === 'positive' ? '✅' : insight.type === 'negative' ? '⚠️' : 'ℹ️'} ${insight.message}`);
    }
  }

  return lines.join('\n');
}

export async function sendDailyReport(report: GeneratedReport): Promise<SendResult> {
  const text = formatReportForTelegram(report);

  console.log('Sending report via Telegram...');

  const result = await sendAndLogNotification('daily_report', {
    text,
    parseMode: 'Markdown',
  });

  if (result.success) {
    // Update report with delivery timestamp
    const supabase = getSupabaseClient();
    await supabase
      .from('daily_reports')
      .update({
        email_sent_at: new Date().toISOString(),
        email_recipients: ['telegram'],
      })
      .eq('date', report.date)
      .eq('report_type', report.type);

    console.log(`Report sent via Telegram (message ID: ${result.messageId})`);
    return { success: true, id: String(result.messageId) };
  }

  return { success: false, error: result.error };
}

// Send a simple notification
export async function sendNotification(
  subject: string,
  message: string,
): Promise<SendResult> {
  const text = `*${subject}*\n\n${message}`;

  const result = await sendTelegramMessage({ text, parseMode: 'Markdown' });
  return {
    success: result.success,
    error: result.error,
  };
}

// Send an alert for critical issues
export async function sendAlert(
  title: string,
  details: string,
  severity: 'warning' | 'critical' = 'warning',
): Promise<SendResult> {
  const icon = severity === 'critical' ? '🚨' : '⚠️';
  // Strip HTML tags for Telegram plain text
  const cleanDetails = details.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const text = `${icon} *${title}*\n\n${cleanDetails}`;

  const result = await sendAndLogNotification('alert', {
    text,
    parseMode: 'Markdown',
  });

  return {
    success: result.success,
    error: result.error,
  };
}
