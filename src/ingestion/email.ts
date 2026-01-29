import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { getConfig, formatDate } from '../config/index.js';
import {
  upsertDailyEmailMetrics,
  createIngestionLog,
  updateIngestionLog,
} from '../db/client.js';
import type { IngestionResult, IngestionContext } from '../types/index.js';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

interface EmailStats {
  received: number;
  sent: number;
  supportTickets: number;
  avgResponseTimeMinutes: number | null;
}

function getEmailConfig(): EmailConfig | null {
  const host = process.env.EMAIL_IMAP_HOST;
  const port = process.env.EMAIL_IMAP_PORT;
  const user = process.env.EMAIL_IMAP_USER;
  const password = process.env.EMAIL_IMAP_PASSWORD;

  if (!host || !port || !user || !password) {
    return null;
  }

  return {
    host,
    port: parseInt(port, 10),
    user,
    password,
  };
}

async function fetchEmailsForDate(
  config: EmailConfig,
  date: Date,
  folder: string
): Promise<ParsedMail[]> {
  return new Promise((resolve, reject) => {
    const emails: ParsedMail[] = [];

    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        // Search for emails on the specific date
        const searchCriteria = [
          ['SINCE', startOfDay],
          ['BEFORE', new Date(endOfDay.getTime() + 86400000)],
        ];

        imap.search(searchCriteria, (searchErr, uids) => {
          if (searchErr) {
            imap.end();
            reject(searchErr);
            return;
          }

          if (uids.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          const fetch = imap.fetch(uids, { bodies: '' });

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              simpleParser(stream as any, (parseErr, mail) => {
                if (!parseErr) {
                  // Filter to exact date
                  if (
                    mail.date &&
                    mail.date >= startOfDay &&
                    mail.date <= endOfDay
                  ) {
                    emails.push(mail);
                  }
                }
              });
            });
          });

          fetch.once('error', (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });

          fetch.once('end', () => {
            imap.end();
            // Wait a bit for all parsing to complete
            setTimeout(() => resolve(emails), 1000);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

function categorizeEmail(mail: ParsedMail): 'support' | 'sales' | 'other' {
  const subject = (mail.subject || '').toLowerCase();
  const from = (mail.from?.text || '').toLowerCase();
  const to = (mail.to?.toString() || '').toLowerCase();

  // Support indicators
  if (
    subject.includes('help') ||
    subject.includes('issue') ||
    subject.includes('problem') ||
    subject.includes('bug') ||
    subject.includes('error') ||
    subject.includes('not working') ||
    to.includes('support@')
  ) {
    return 'support';
  }

  // Sales indicators
  if (
    subject.includes('pricing') ||
    subject.includes('enterprise') ||
    subject.includes('quote') ||
    subject.includes('demo') ||
    to.includes('sales@')
  ) {
    return 'sales';
  }

  return 'other';
}

function calculateResponseTimes(
  received: ParsedMail[],
  sent: ParsedMail[]
): number | null {
  const responseTimes: number[] = [];

  for (const inMail of received) {
    if (!inMail.messageId || !inMail.date) continue;

    // Find response to this email
    const response = sent.find((outMail) => {
      const refs = outMail.references || [];
      const inReplyTo = outMail.inReplyTo;
      return (
        refs.includes(inMail.messageId!) ||
        inReplyTo === inMail.messageId
      );
    });

    if (response?.date && inMail.date) {
      const responseTime =
        (response.date.getTime() - inMail.date.getTime()) / (1000 * 60);
      if (responseTime > 0 && responseTime < 7 * 24 * 60) {
        // Ignore responses > 7 days
        responseTimes.push(responseTime);
      }
    }
  }

  if (responseTimes.length === 0) return null;

  return Math.round(
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
  );
}

export async function ingestEmailData(
  context: IngestionContext
): Promise<IngestionResult> {
  const dateStr = formatDate(context.date);
  let recordsProcessed = 0;

  const emailConfig = getEmailConfig();

  if (!emailConfig) {
    return {
      success: true,
      source: 'email',
      date: dateStr,
      records_processed: 0,
      error: 'Email IMAP not configured',
    };
  }

  const logId = await createIngestionLog({
    source: 'email',
    date: dateStr,
    started_at: new Date().toISOString(),
    status: 'running',
  });

  try {
    // Fetch received emails (INBOX)
    const received = await fetchEmailsForDate(
      emailConfig,
      context.date,
      'INBOX'
    );

    // Fetch sent emails
    let sent: ParsedMail[] = [];
    try {
      sent = await fetchEmailsForDate(emailConfig, context.date, '[Gmail]/Sent Mail');
    } catch {
      // Try alternative folder name
      try {
        sent = await fetchEmailsForDate(emailConfig, context.date, 'Sent');
      } catch {
        console.warn('Could not fetch sent emails');
      }
    }

    // Categorize emails
    const supportReceived = received.filter(
      (m) => categorizeEmail(m) === 'support'
    );
    const salesReceived = received.filter(
      (m) => categorizeEmail(m) === 'sales'
    );

    // Calculate response times for support emails
    const supportResponseTime = calculateResponseTimes(supportReceived, sent);

    // Upsert support metrics
    await upsertDailyEmailMetrics({
      app_id: undefined, // Company-wide
      date: dateStr,
      email_type: 'support',
      received: supportReceived.length,
      sent: sent.filter((m) => categorizeEmail(m) === 'support').length,
      tickets_opened: supportReceived.length,
      avg_response_time_minutes: supportResponseTime ?? undefined,
      raw_data: {
        total_received: received.length,
        total_sent: sent.length,
      } as unknown as Record<string, unknown>,
    });
    recordsProcessed++;

    // Upsert sales metrics
    await upsertDailyEmailMetrics({
      app_id: undefined,
      date: dateStr,
      email_type: 'sales',
      received: salesReceived.length,
      sent: sent.filter((m) => categorizeEmail(m) === 'sales').length,
      raw_data: {} as unknown as Record<string, unknown>,
    });
    recordsProcessed++;

    // Upsert other emails
    const otherReceived = received.filter(
      (m) => categorizeEmail(m) === 'other'
    );
    await upsertDailyEmailMetrics({
      app_id: undefined,
      date: dateStr,
      email_type: 'other',
      received: otherReceived.length,
      sent: sent.filter((m) => categorizeEmail(m) === 'other').length,
      raw_data: {} as unknown as Record<string, unknown>,
    });
    recordsProcessed++;

    await updateIngestionLog(logId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
    });

    return {
      success: true,
      source: 'email',
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
      source: 'email',
      date: dateStr,
      records_processed: recordsProcessed,
      error: errorMessage,
    };
  }
}
