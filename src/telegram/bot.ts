/**
 * Telegram Bot
 *
 * Initializes the bot with polling for development use.
 * Registers command handlers and callback query routing.
 */

import TelegramBot from 'node-telegram-bot-api';
import { getConfig } from '../config/index.js';
import { setBotInstance } from '../delivery/telegram.js';
import { handleCallbackQuery } from './actions.js';

/**
 * Initialize the Telegram bot with polling
 */
export function initBot(): TelegramBot {
  const config = getConfig();
  if (!config.telegram) {
    throw new Error('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
  }

  const bot = new TelegramBot(config.telegram.botToken, { polling: true });

  // Share the bot instance with the delivery module
  setBotInstance(bot);

  // Register command handlers
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, [
      '\ud83d\ude80 *Business Manager Bot*',
      '',
      'I help you manage your business portfolio:',
      '\u2022 Review & approve blog posts',
      '\u2022 Receive daily business reports',
      '\u2022 Get credit & API alerts',
      '\u2022 Monitor app store activity',
      '',
      '*Commands:*',
      '/status — Current system status',
      '/help — Show this help message',
      '',
      `Your chat ID: \`${msg.chat.id}\``,
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, [
      '*Business Manager Commands*',
      '',
      '/start — Welcome message & chat ID',
      '/status — System status & recent activity',
      '/help — Show this help message',
      '',
      '*How it works:*',
      '1\\. Blog posts are generated on schedule',
      '2\\. You receive a review with Approve/Reject buttons',
      '3\\. Approved posts become GitHub PRs automatically',
      '4\\. Daily reports arrive each morning',
      '5\\. Credit alerts fire when services are low',
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/status/, async (msg) => {
    try {
      const { getSupabaseClient } = await import('../db/client.js');
      const supabase = getSupabaseClient();

      const [pendingPosts, recentNotifications] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id', { count: 'exact' })
          .eq('status', 'pending_review'),
        supabase
          .from('telegram_notifications')
          .select('notification_type, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const pendingCount = pendingPosts.count || 0;

      const lines: string[] = [];
      lines.push('\ud83d\udcca *System Status*');
      lines.push('');
      lines.push(`Pending blog reviews: ${pendingCount}`);
      lines.push('');

      if (recentNotifications.data && recentNotifications.data.length > 0) {
        lines.push('*Recent notifications:*');
        for (const n of recentNotifications.data) {
          const time = new Date(n.created_at).toLocaleString();
          lines.push(`  \u2022 ${n.notification_type} — ${time}`);
        }
      } else {
        lines.push('_No recent notifications_');
      }

      bot.sendMessage(msg.chat.id, lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (error) {
      bot.sendMessage(msg.chat.id, '\u274c Failed to fetch status. Check logs.');
    }
  });

  // Handle inline keyboard callbacks
  bot.on('callback_query', (callbackQuery) => {
    handleCallbackQuery(callbackQuery, bot).catch((error) => {
      console.error('Callback query error:', error);
    });
  });

  console.log('Telegram bot started (polling mode)');
  return bot;
}

/**
 * Gracefully stop the bot
 */
export function stopBot(bot: TelegramBot): void {
  bot.stopPolling();
  console.log('Telegram bot stopped');
}
