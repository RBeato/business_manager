/**
 * Register (or remove) the Telegram webhook for the Edge Function.
 *
 * Usage:
 *   npm run telegram:set-webhook          # Register webhook
 *   npm run telegram:set-webhook -- --delete  # Remove webhook (revert to polling)
 */

import 'dotenv/config';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

const isDelete = process.argv.includes('--delete');

async function main() {
  if (isDelete) {
    // Remove webhook (reverts bot to polling mode)
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
    );
    const data = await res.json();
    console.log('Delete webhook:', data.ok ? 'Success' : data.description);
    return;
  }

  if (!SUPABASE_URL) {
    console.error('Missing SUPABASE_URL in .env');
    process.exit(1);
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

  const params: Record<string, string> = { url: webhookUrl };
  if (WEBHOOK_SECRET) {
    params.secret_token = WEBHOOK_SECRET;
  }

  const queryString = new URLSearchParams(params).toString();
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?${queryString}`,
  );
  const data = await res.json();

  if (data.ok) {
    console.log(`Webhook registered: ${webhookUrl}`);
    if (WEBHOOK_SECRET) {
      console.log('Secret token: configured');
    } else {
      console.log('Secret token: not set (add TELEGRAM_WEBHOOK_SECRET to .env for extra security)');
    }
  } else {
    console.error('Failed to set webhook:', data.description);
    process.exit(1);
  }

  // Show current webhook info
  const infoRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
  );
  const info = await infoRes.json();
  console.log('\nWebhook info:');
  console.log(`  URL: ${info.result?.url || 'none'}`);
  console.log(`  Pending updates: ${info.result?.pending_update_count || 0}`);
  if (info.result?.last_error_message) {
    console.log(`  Last error: ${info.result.last_error_message}`);
  }
}

main().catch(console.error);
