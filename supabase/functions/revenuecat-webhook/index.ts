// Supabase Edge Function: RevenueCat Webhook
// Receives real-time purchase/subscription events and sends Telegram notifications.
// Deploy with: supabase functions deploy revenuecat-webhook --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ============================================
// Types
// ============================================

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

interface RevenueCatEvent {
  type: string;
  id: string;
  app_id: string;
  app_user_id: string;
  product_id: string;
  price: number;
  currency: string;
  price_in_purchased_currency: number;
  country_code: string;
  store: string;
  event_timestamp_ms: number;
  original_transaction_id: string;
  environment: string;
  commission_percentage: number;
  takehome_percentage: number;
  entitlement_ids?: string[];
  period_type?: string;
  expiration_at_ms?: number;
  is_family_share?: boolean;
  offered_price?: number;
  tax_percentage?: number;
}

// ============================================
// Config
// ============================================

function getEnv(key: string): string {
  const val = Deno.env.get(key);
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

function getSupabase(): SupabaseClient {
  return createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
}

// ============================================
// App name mapping
// ============================================

// Maps RevenueCat app_id to friendly names.
// TODO: Replace placeholder keys with actual RevenueCat app_ids from
// the dashboard or from the first webhook test payload.
// The app_id appears in every webhook event under event.app_id.
const APP_NAMES: Record<string, string> = {
  // These will be populated after receiving the first webhook events.
  // Format: 'app1234abc': 'App Name'
};

function getAppName(appId: string): string {
  if (APP_NAMES[appId]) return APP_NAMES[appId];
  // Fallback: try to make a readable name from the ID
  return appId;
}

// ============================================
// Event configuration
// ============================================

const EVENT_CONFIG: Record<string, { emoji: string; label: string }> = {
  'INITIAL_PURCHASE':        { emoji: '\u{1F4B0}', label: 'New Purchase' },
  'NON_RENEWING_PURCHASE':   { emoji: '\u{1F4B0}', label: 'One-Time Purchase' },
  'RENEWAL':                 { emoji: '\u{1F504}', label: 'Subscription Renewed' },
  'CANCELLATION':            { emoji: '\u{274C}', label: 'Subscription Cancelled' },
  'UNCANCELLATION':          { emoji: '\u{2705}', label: 'Cancellation Reversed' },
  'BILLING_ISSUE':           { emoji: '\u{26A0}\u{FE0F}', label: 'Billing Issue' },
  'EXPIRATION':              { emoji: '\u{1F4C5}', label: 'Subscription Expired' },
  'TRANSFER':                { emoji: '\u{27A1}\u{FE0F}', label: 'Subscription Transferred' },
  'PRODUCT_CHANGE':          { emoji: '\u{1F500}', label: 'Plan Changed' },
  'SUBSCRIPTION_PAUSED':     { emoji: '\u{23F8}\u{FE0F}', label: 'Subscription Paused' },
  'TRIAL_STARTED':           { emoji: '\u{1F195}', label: 'Trial Started' },
  'TRIAL_CONVERTED':         { emoji: '\u{1F389}', label: 'Trial Converted' },
  'TRIAL_CANCELLED':         { emoji: '\u{274C}', label: 'Trial Cancelled' },
};

// Events that warrant a Telegram notification
const NOTIFY_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRIAL_STARTED',
  'TRIAL_CONVERTED',
]);

// ============================================
// Telegram helper
// ============================================

async function sendTelegramMessage(text: string): Promise<boolean> {
  try {
    const token = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = getEnv('TELEGRAM_CHAT_ID');
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return false;
  }
}

// ============================================
// Notification formatting
// ============================================

function formatNotification(event: RevenueCatEvent): string {
  const config = EVENT_CONFIG[event.type] || { emoji: '\u{1F4E8}', label: event.type.replace(/_/g, ' ') };
  const appName = getAppName(event.app_id);
  const storeName = event.store === 'APP_STORE' ? 'App Store'
    : event.store === 'PLAY_STORE' ? 'Play Store'
    : event.store || 'Unknown';

  const lines: string[] = [];
  lines.push(`${config.emoji} *${config.label}*`);
  lines.push('');
  lines.push(`*App:* ${appName}`);
  lines.push(`*Product:* \`${event.product_id || 'N/A'}\``);

  if (event.price > 0) {
    const currency = event.currency || 'USD';
    lines.push(`*Price:* ${currency} ${event.price.toFixed(2)}`);
    const takehome = event.price * (event.takehome_percentage || 0.85);
    lines.push(`*Net Revenue:* ${currency} ${takehome.toFixed(2)}`);
  }

  lines.push(`*Store:* ${storeName}`);

  if (event.country_code) {
    lines.push(`*Country:* ${event.country_code}`);
  }

  if (event.period_type) {
    lines.push(`*Period:* ${event.period_type}`);
  }

  return lines.join('\n');
}

// ============================================
// Main handler
// ============================================

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  try {
    // 1. Validate authorization header
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (webhookSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        console.error('Invalid authorization header');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // 2. Parse payload
    const payload: RevenueCatWebhookPayload = await req.json();
    const event = payload.event;

    if (!event?.id || !event?.type) {
      console.error('Invalid event payload: missing id or type');
      return new Response('ok', { status: 200 });
    }

    console.log(`Received event: ${event.type} (${event.id}) for app ${event.app_id}`);

    // 3. Store event in database (idempotent via UNIQUE event_id)
    const supabase = getSupabase();
    const { error: insertError } = await supabase
      .from('revenuecat_events')
      .insert({
        event_id: event.id,
        event_type: event.type,
        app_id: event.app_id || '',
        app_user_id: event.app_user_id || '',
        product_id: event.product_id || '',
        price: event.price || 0,
        currency: event.currency || 'USD',
        price_in_purchased_currency: event.price_in_purchased_currency || 0,
        country_code: event.country_code || '',
        store: event.store || '',
        environment: event.environment || 'PRODUCTION',
        transaction_id: event.original_transaction_id || '',
        commission_percentage: event.commission_percentage || null,
        takehome_percentage: event.takehome_percentage || null,
        entitlement_ids: event.entitlement_ids || [],
        event_timestamp: event.event_timestamp_ms
          ? new Date(event.event_timestamp_ms).toISOString()
          : null,
        webhook_payload: payload,
        notified: false,
      });

    // 4. Handle duplicate events (UNIQUE constraint violation)
    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`Duplicate event ${event.id}, skipping`);
        return new Response('ok', { status: 200 });
      }
      console.error('DB insert error:', insertError.message);
      // Continue to try sending notification even if DB insert failed
    }

    // 5. Skip notifications for sandbox events
    if (event.environment !== 'PRODUCTION') {
      console.log(`Sandbox event ${event.type}, stored but not notified`);
      return new Response('ok', { status: 200 });
    }

    // 6. Send Telegram notification for relevant events
    if (NOTIFY_EVENTS.has(event.type)) {
      const message = formatNotification(event);
      const sent = await sendTelegramMessage(message);

      // Update notified status
      if (!insertError && sent) {
        await supabase
          .from('revenuecat_events')
          .update({ notified: true })
          .eq('event_id', event.id);
      }

      // Log notification
      const chatId = Deno.env.get('TELEGRAM_CHAT_ID') || '';
      await supabase.from('telegram_notifications').insert({
        notification_type: `revenuecat_${event.type.toLowerCase()}`,
        target_id: event.id,
        chat_id: chatId,
        status: sent ? 'sent' : 'failed',
        metadata: {
          app_id: event.app_id,
          product_id: event.product_id,
          price: event.price,
          currency: event.currency,
          store: event.store,
        },
      });

      console.log(`Notification ${sent ? 'sent' : 'failed'} for ${event.type}`);
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('ok', { status: 200 });
  }
});
