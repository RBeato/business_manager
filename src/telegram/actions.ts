/**
 * Telegram Callback Action Handlers
 *
 * Handles inline keyboard button presses.
 * Each action checks the telegram_actions table for idempotency.
 */

import type TelegramBot from 'node-telegram-bot-api';
import { getSupabaseClient } from '../db/client.js';
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
  const supabase = getSupabaseClient();
  const chatId = callbackQuery.message?.chat.id?.toString();
  const messageId = callbackQuery.message?.message_id;

  // Idempotency check
  const { data: existing } = await supabase
    .from('telegram_actions')
    .select('id')
    .eq('callback_id', callbackQuery.id)
    .single();

  if (existing) return;

  // Log the action
  await supabase.from('telegram_actions').insert({
    callback_id: callbackQuery.id,
    action_type: 'approve_blog',
    target_id: blogPostId,
    user_id: callbackQuery.from.id,
    status: 'pending',
  });

  try {
    // Update blog post status to approved
    const { error } = await supabase
      .from('blog_posts')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', blogPostId);

    if (error) throw error;

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
    await supabase
      .from('telegram_actions')
      .update({ status: 'completed' })
      .eq('callback_id', callbackQuery.id);

    console.log(`Blog post ${blogPostId} approved via Telegram`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to approve blog post ${blogPostId}:`, msg);

    await supabase
      .from('telegram_actions')
      .update({ status: 'failed', error_message: msg })
      .eq('callback_id', callbackQuery.id);
  }
}

/**
 * Reject a blog post
 */
async function handleRejectBlog(
  blogPostId: string,
  callbackQuery: TelegramBot.CallbackQuery,
): Promise<void> {
  const supabase = getSupabaseClient();
  const chatId = callbackQuery.message?.chat.id?.toString();
  const messageId = callbackQuery.message?.message_id;

  // Idempotency check
  const { data: existing } = await supabase
    .from('telegram_actions')
    .select('id')
    .eq('callback_id', callbackQuery.id)
    .single();

  if (existing) return;

  await supabase.from('telegram_actions').insert({
    callback_id: callbackQuery.id,
    action_type: 'reject_blog',
    target_id: blogPostId,
    user_id: callbackQuery.from.id,
    status: 'pending',
  });

  try {
    // Get the blog post to find its topic
    const { data: post } = await supabase
      .from('blog_posts')
      .select('id, website')
      .eq('id', blogPostId)
      .single();

    // Update blog post status to rejected
    const { error } = await supabase
      .from('blog_posts')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', blogPostId);

    if (error) throw error;

    // Reset the topic back to queued so it can be regenerated
    if (post) {
      await supabase
        .from('blog_topics')
        .update({ status: 'queued' })
        .eq('related_blog_post_id', blogPostId);
    }

    // Update message keyboard
    if (chatId && messageId) {
      await editTelegramMessage(
        messageId,
        callbackQuery.message?.text + '\n\n\u274c *Rejected* — Topic returned to queue.',
        chatId,
        buildBlogRejectedKeyboard(),
      );
    }

    await supabase
      .from('telegram_actions')
      .update({ status: 'completed' })
      .eq('callback_id', callbackQuery.id);

    console.log(`Blog post ${blogPostId} rejected via Telegram`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to reject blog post ${blogPostId}:`, msg);

    await supabase
      .from('telegram_actions')
      .update({ status: 'failed', error_message: msg })
      .eq('callback_id', callbackQuery.id);
  }
}

/**
 * Send full blog post preview as a new message
 */
async function handlePreviewBlog(
  blogPostId: string,
  callbackQuery: TelegramBot.CallbackQuery,
): Promise<void> {
  const supabase = getSupabaseClient();
  const chatId = callbackQuery.message?.chat.id?.toString();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, content')
    .eq('id', blogPostId)
    .single();

  if (!post || !chatId) {
    console.error(`Blog post ${blogPostId} not found for preview`);
    return;
  }

  await sendTelegramMessage(
    { text: formatBlogFullPreview(post), parseMode: 'Markdown' },
    chatId,
  );
}
