/**
 * Telegram Delivery
 *
 * Low-level Telegram Bot API wrapper for sending messages and notifications.
 * Parallel to email.ts — handles message sending, editing, and notification logging.
 */

import TelegramBot from 'node-telegram-bot-api';
import { getConfig } from '../config/index.js';
import { getSupabaseClient } from '../db/client.js';
import type { SendTelegramResult } from '../types/index.js';

interface TelegramMessageOptions {
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  replyMarkup?: TelegramBot.InlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}

let botInstance: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!botInstance) {
    const config = getConfig();
    if (!config.telegram) {
      throw new Error('Telegram not configured');
    }
    botInstance = new TelegramBot(config.telegram.botToken);
  }
  return botInstance;
}

function getChatId(): string {
  const config = getConfig();
  if (!config.telegram) {
    throw new Error('Telegram not configured');
  }
  return config.telegram.chatId;
}

/**
 * Send a Telegram message
 */
export async function sendTelegramMessage(
  options: TelegramMessageOptions,
  chatId?: string,
): Promise<SendTelegramResult> {
  const config = getConfig();
  if (!config.telegram) {
    return { success: false, error: 'Telegram not configured' };
  }

  const targetChatId = chatId || getChatId();

  try {
    const bot = getBot();
    const msg = await bot.sendMessage(targetChatId, options.text, {
      parse_mode: options.parseMode || 'Markdown',
      reply_markup: options.replyMarkup,
      disable_web_page_preview: options.disableWebPagePreview ?? true,
    });

    return { success: true, messageId: msg.message_id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Edit an existing Telegram message
 */
export async function editTelegramMessage(
  messageId: number,
  text: string,
  chatId?: string,
  replyMarkup?: TelegramBot.InlineKeyboardMarkup,
): Promise<SendTelegramResult> {
  const config = getConfig();
  if (!config.telegram) {
    return { success: false, error: 'Telegram not configured' };
  }

  const targetChatId = chatId || getChatId();

  try {
    const bot = getBot();
    await bot.editMessageText(text, {
      chat_id: targetChatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });

    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Log a Telegram notification to the database
 */
export async function logTelegramNotification(
  type: string,
  chatId: string,
  messageId?: number,
  targetId?: string,
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('telegram_notifications').insert({
      notification_type: type,
      chat_id: chatId,
      message_id: messageId,
      target_id: targetId,
      status: messageId ? 'sent' : 'failed',
    });
  } catch (error) {
    console.error('Failed to log Telegram notification:', error);
  }
}

/**
 * Send a message and log it as a notification
 */
export async function sendAndLogNotification(
  type: string,
  options: TelegramMessageOptions,
  targetId?: string,
): Promise<SendTelegramResult> {
  const chatId = getChatId();
  const result = await sendTelegramMessage(options, chatId);
  await logTelegramNotification(type, chatId, result.messageId, targetId);
  return result;
}

/**
 * Set the shared bot instance (used by bot.ts when polling)
 */
export function setBotInstance(bot: TelegramBot): void {
  botInstance = bot;
}
