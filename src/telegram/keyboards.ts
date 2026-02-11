/**
 * Telegram Inline Keyboard Builders
 *
 * Builds inline keyboard markups for Telegram messages.
 * Callback data format: "action:targetId"
 */

import type TelegramBot from 'node-telegram-bot-api';

export function buildBlogReviewKeyboard(
  blogPostId: string,
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '\u2705 Approve', callback_data: `approve_blog:${blogPostId}` },
        { text: '\u274c Reject', callback_data: `reject_blog:${blogPostId}` },
      ],
      [
        { text: '\ud83d\udc41 Preview Full', callback_data: `preview_blog:${blogPostId}` },
      ],
    ],
  };
}

export function buildBlogApprovedKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '\u2705 Approved', callback_data: 'noop' }],
    ],
  };
}

export function buildBlogRejectedKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '\u274c Rejected', callback_data: 'noop' }],
    ],
  };
}
