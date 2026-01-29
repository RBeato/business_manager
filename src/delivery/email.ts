import { Resend } from 'resend';
import { getConfig } from '../config/index.js';
import { updateIngestionLog, getSupabaseClient } from '../db/client.js';
import { generateTextEmail } from '../reports/templates/daily-email.js';
import type { GeneratedReport } from '../types/index.js';

interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const config = getConfig();

  if (!config.resend) {
    return {
      success: false,
      error: 'Resend not configured',
    };
  }

  const resend = new Resend(config.resend.apiKey);

  try {
    const result = await resend.emails.send({
      from: config.resend.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      id: result.data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendDailyReport(report: GeneratedReport): Promise<SendResult> {
  const config = getConfig();

  const recipients = config.email?.recipients || [];
  if (recipients.length === 0) {
    return {
      success: false,
      error: 'No email recipients configured',
    };
  }

  const subject = `Daily Business Report - ${report.date}`;

  // Generate plain text version
  const textContent = generateTextEmail({
    date: report.date,
    metrics: report.metrics,
    insights: report.insights,
    trends: [],
  });

  console.log(`Sending report to ${recipients.length} recipients...`);

  const result = await sendEmail({
    to: recipients,
    subject,
    html: report.html,
    text: textContent,
  });

  if (result.success) {
    // Update report with email sent timestamp
    const supabase = getSupabaseClient();
    await supabase
      .from('daily_reports')
      .update({
        email_sent_at: new Date().toISOString(),
        email_recipients: recipients,
      })
      .eq('date', report.date)
      .eq('report_type', report.type);

    console.log(`Report sent successfully (ID: ${result.id})`);
  } else {
    console.error(`Failed to send report: ${result.error}`);
  }

  return result;
}

// Send a simple notification email
export async function sendNotification(
  subject: string,
  message: string,
  recipients?: string[]
): Promise<SendResult> {
  const config = getConfig();

  const to = recipients || config.email?.recipients || [];
  if (to.length === 0) {
    return {
      success: false,
      error: 'No recipients',
    };
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .message { background: #f3f4f6; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="message">
    <h2>${subject}</h2>
    <p>${message}</p>
  </div>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Business Metrics Hub
  </p>
</body>
</html>
`;

  return sendEmail({
    to,
    subject,
    html,
    text: `${subject}\n\n${message}`,
  });
}

// Send an alert for critical issues
export async function sendAlert(
  title: string,
  details: string,
  severity: 'warning' | 'critical' = 'warning'
): Promise<SendResult> {
  const config = getConfig();

  const to = config.email?.recipients || [];
  if (to.length === 0) {
    return {
      success: false,
      error: 'No recipients',
    };
  }

  const backgroundColor = severity === 'critical' ? '#fef2f2' : '#fef3c7';
  const borderColor = severity === 'critical' ? '#ef4444' : '#f59e0b';
  const icon = severity === 'critical' ? '&#x1F6A8;' : '&#x26A0;';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .alert {
      background: ${backgroundColor};
      border-left: 4px solid ${borderColor};
      padding: 20px;
      border-radius: 0 8px 8px 0;
    }
    .alert-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 12px;
    }
    .alert-details {
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="alert">
    <div class="alert-title">${icon} ${title}</div>
    <div class="alert-details">${details}</div>
  </div>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
    Business Metrics Hub Alert
  </p>
</body>
</html>
`;

  return sendEmail({
    to,
    subject: `[${severity.toUpperCase()}] ${title}`,
    html,
    text: `[${severity.toUpperCase()}] ${title}\n\n${details}`,
  });
}
