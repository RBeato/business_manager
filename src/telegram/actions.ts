/**
 * Telegram Callback Action Handlers
 *
 * Handles inline keyboard button presses.
 * Each action checks the telegram_actions table for idempotency.
 */

import type TelegramBot from 'node-telegram-bot-api';
import { getDb, newId } from '../db/sqlite-client.js';
import { editTelegramMessage, sendTelegramMessage } from '../delivery/telegram.js';
import { buildBlogApprovedKeyboard, buildBlogRejectedKeyboard } from './keyboards.js';
import { formatBlogFullPreview } from './messages.js';

/**
 * Route callback queries to the appropriate handler
 */
export async function handleCallbackQuery(
  callbackQuery: TelegramBot.CallbackQuery,
  bot: TelegramBot,
): Promise<void> {
  const data = callbackQuery.data;
  if (!data) return;

  const [action, targetId] = data.split(':');

  // Answer the callback to remove loading indicator
  await bot.answerCallbackQuery(callbackQuery.id);

  if (!action || !targetId) return;

  switch (action) {
    case 'approve_blog':
      await handleApproveBlog(targetId, callbackQuery);
      break;
    case 'reject_blog':
      await handleRejectBlog(targetId, callbackQuery);
      break;
    case 'preview_blog':
      await handlePreviewBlog(targetId, callbackQuery);
      break;
    case 'noop':
      break;
    default:
      console.log(`Unknown callback action: ${action}`);
  }
}

/**
 * Approve a blog post
 */
async function handleApproveBlog(
  blogPostId: string,
  callbackQuery: TelegramBot.CallbackQuery,
): Promise<void> {
  const db = getDb();
  const chatId = callbackQuery.message?.chat.id?.toString();
  const messageId = callbackQuery.message?.message_id;

  // Idempotency check
  const existing = db.prepare('SELECT id FROM telegram_actions WHERE callback_id = ?').get(callbackQuery.id);
  if (existing) return;

  // Log the action
  db.prepare(
    'INSERT INTO telegram_actions (id, callback_id, action_type, target_id, user_id, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(newId(), callbackQuery.id, 'approve_blog', blogPostId, callbackQuery.from.id, 'pending');

  try {
    // Update blog post status to approved
    db.prepare('UPDATE blog_posts SET status = ?, reviewed_at = ? WHERE id = ?')
      .run('approved', new Date().toISOString(), blogPostId);

    // Update the message keyboard to show "Approved"
    if (chatId && messageId) {
      await editTelegramMessage(
        messageId,
        callbackQuery.message?.text + '\n\n\u2705 *Approved* — Ready for publishing.',
        chatId,
        buildBlogApprovedKeyboard(),
      );
    }

    // Mark action as completed
    db.prepare('UPDATE telegram_actions SET status = ? WHERE callback_id = ?')
      .run('completed', callbackQuery.id);

    console.log(`Blog post ${blogPostId} approved via Telegram`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to approve blog post ${blogPostId}:`, msg);

    db.prepare('UPDATE telegram_actions SET status = ?, error_message = ? WHERE callback_id = ?')
      .run('failed', msg, callbackQuery.id);
  }
}

/**
 * Reject a blog post
 */
async function handleRejectBlog(
  blogPostId: string,
  callbackQuery: TelegramBot.CallbackQuery,
): Promise<void> {
  const db = getDb();
  const chatId = callbackQuery.message?.chat.id?.toString();
  const messageId = callbackQuery.message?.message_id;

  // Idempotency check
  const existing = db.prepare('SELECT id FROM telegram_actions WHERE callback_id = ?').get(callbackQuery.id);
  if (existing) return;

  db.prepare(
    'INSERT INTO telegram_actions (id, callback_id, action_type, target_id, user_id, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(newId(), callbackQuery.id, 'reject_blog', blogPostId, callbackQuery.from.id, 'pending');

  try {
    // Update blog post status to rejected
    db.prepare('UPDATE blog_posts SET status = ?, reviewed_at = ? WHERE id = ?')
      .run('rejected', new Date().toISOString(), blogPostId);

    // Reset the topic back to queued so it can be regenerated
    db.prepare("UPDATE blog_topics SET status = 'queued' WHERE related_blog_post_id = ?")
      .run(blogPostId);

    // Update message keyboard
    if (chatId && messageId) {
      await editTelegramMessage(
        messageId,
        callbackQuery.message?.text + '\n\n\u274c *Rejected* — Topic returned to queue.',
        chatId,
        buildBlogRejectedKeyboard(),
      );
    }

    db.prepare('UPDATE telegram_actions SET status = ? WHERE callback_id = ?')
      .run('completed', callbackQuery.id);

    console.log(`Blog post ${blogPostId} rejected via Telegram`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to reject blog post ${blogPostId}:`, msg);

    db.prepare('UPDATE telegram_actions SET status = ?, error_message = ? WHERE callback_id = ?')
      .run('failed', msg, callbackQuery.id);
  }
}

/**
 * Send full blog post preview as a new message
 */
async function handlePreviewBlog(
  blogPostId: string,
  callbackQuery: TelegramBot.CallbackQuery,
): Promise<void> {
  const db = getDb();
  const chatId = callbackQuery.message?.chat.id?.toString();

  const post = db.prepare('SELECT title, content FROM blog_posts WHERE id = ?').get(blogPostId) as { title: string; content: string } | undefined;

  if (!post || !chatId) {
    console.error(`Blog post ${blogPostId} not found for preview`);
    return;
  }

  await sendTelegramMessage(
    { text: formatBlogFullPreview(post), parseMode: 'Markdown' },
    chatId,
  );
}
