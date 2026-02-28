/**
 * RevenueCat Webhook → Telegram Notification (Cloudflare Worker)
 *
 * Receives RevenueCat webhook events and forwards purchase notifications to Telegram.
 * No database needed — events are stored locally during daily ingestion.
 *
 * Deploy: cd cloudflare/revenuecat-worker && npx wrangler deploy
 */

interface Env {
  REVENUECAT_WEBHOOK_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

interface RevenueCatEvent {
  type: string;
  id: string;
  app_id: string;
  product_id: string;
  price: number;
  currency: string;
  country_code: string;
  store: string;
  environment: string;
  takehome_percentage: number;
  period_type?: string;
}

const EVENT_CONFIG: Record<string, { emoji: string; label: string }> = {
  INITIAL_PURCHASE:      { emoji: '\ud83d\udcb0', label: 'New Purchase' },
  NON_RENEWING_PURCHASE: { emoji: '\ud83d\udcb0', label: 'One-Time Purchase' },
  RENEWAL:               { emoji: '\ud83d\udd04', label: 'Subscription Renewed' },
  CANCELLATION:          { emoji: '\u274c', label: 'Subscription Cancelled' },
  UNCANCELLATION:        { emoji: '\u2705', label: 'Cancellation Reversed' },
  BILLING_ISSUE:         { emoji: '\u26a0\ufe0f', label: 'Billing Issue' },
  EXPIRATION:            { emoji: '\ud83d\udcc5', label: 'Subscription Expired' },
  PRODUCT_CHANGE:        { emoji: '\ud83d\udd00', label: 'Plan Changed' },
  TRIAL_STARTED:         { emoji: '\ud83c\udd95', label: 'Trial Started' },
  TRIAL_CONVERTED:       { emoji: '\ud83c\udf89', label: 'Trial Converted' },
  TRIAL_CANCELLED:       { emoji: '\u274c', label: 'Trial Cancelled' },
};

const NOTIFY_EVENTS = new Set([
  'INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'CANCELLATION',
  'BILLING_ISSUE', 'EXPIRATION', 'UNCANCELLATION', 'PRODUCT_CHANGE',
  'TRIAL_STARTED', 'TRIAL_CONVERTED',
]);

function formatNotification(event: RevenueCatEvent): string {
  const config = EVENT_CONFIG[event.type] || { emoji: '\ud83d\udce8', label: event.type.replace(/_/g, ' ') };
  const storeName = event.store === 'APP_STORE' ? 'App Store'
    : event.store === 'PLAY_STORE' ? 'Play Store'
    : event.store || 'Unknown';

  const lines: string[] = [];
  lines.push(`${config.emoji} *${config.label}*`);
  lines.push('');
  lines.push(`*App:* ${event.app_id}`);
  lines.push(`*Product:* \`${event.product_id || 'N/A'}\``);

  if (event.price > 0) {
    const currency = event.currency || 'USD';
    lines.push(`*Price:* ${currency} ${event.price.toFixed(2)}`);
    const takehome = event.price * (event.takehome_percentage || 0.85);
    lines.push(`*Net Revenue:* ${currency} ${takehome.toFixed(2)}`);
  }

  lines.push(`*Store:* ${storeName}`);
  if (event.country_code) lines.push(`*Country:* ${event.country_code}`);
  if (event.period_type) lines.push(`*Period:* ${event.period_type}`);

  return lines.join('\n');
}

async function sendTelegram(env: Env, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response('ok');
    if (request.method !== 'POST') return new Response('ok');

    try {
      // Validate auth
      if (env.REVENUECAT_WEBHOOK_SECRET) {
        const auth = request.headers.get('authorization');
        if (auth !== env.REVENUECAT_WEBHOOK_SECRET && auth !== `Bearer ${env.REVENUECAT_WEBHOOK_SECRET}`) {
          return new Response('Unauthorized', { status: 401 });
        }
      }

      const payload = await request.json() as { event: RevenueCatEvent };
      const event = payload.event;
      if (!event?.type) return new Response('ok');

      // Only notify for production events
      if (event.environment === 'SANDBOX') return new Response('ok');

      // Send Telegram notification for relevant events
      if (NOTIFY_EVENTS.has(event.type)) {
        const message = formatNotification(event);
        await sendTelegram(env, message);
      }

      return new Response('ok');
    } catch {
      return new Response('ok');
    }
  },
};
