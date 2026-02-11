#!/usr/bin/env tsx
/**
 * Test Telegram bot by sending a simple message and a mock blog review
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { sendTelegramMessage } from '../src/delivery/telegram.js';
import { formatBlogReview } from '../src/telegram/messages.js';
import { buildBlogReviewKeyboard } from '../src/telegram/keyboards.js';
import { getConfig } from '../src/config/index.js';

async function main() {
  const config = getConfig();

  if (!config.telegram) {
    console.error('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
    process.exit(1);
  }

  console.log('Testing Telegram bot...\n');

  // Test 1: Simple message
  console.log('1. Sending simple message...');
  const simpleResult = await sendTelegramMessage({
    text: '\ud83e\uddea *Telegram Bot Test*\n\nIf you see this, the bot is working!',
    parseMode: 'Markdown',
  });

  if (simpleResult.success) {
    console.log(`   Sent! Message ID: ${simpleResult.messageId}`);
  } else {
    console.error(`   Failed: ${simpleResult.error}`);
    process.exit(1);
  }

  // Test 2: Mock blog review with buttons
  console.log('2. Sending mock blog review...');
  const mockPost = {
    id: 'test-post-id',
    title: '10 Best Meditation Techniques for Beginners in 2025',
    website: 'meditnation',
    seo_score: 85,
    word_count: 1850,
    meta_description: 'Discover the best meditation techniques for beginners. From mindfulness to body scan, learn how to start meditating today.',
    target_keyword: 'meditation techniques for beginners',
    content: 'Meditation is one of the most powerful tools for reducing stress and improving mental clarity. In this comprehensive guide, we explore the top meditation techniques that are perfect for beginners...',
  };

  const reviewText = formatBlogReview(mockPost);
  const reviewResult = await sendTelegramMessage({
    text: reviewText,
    parseMode: 'Markdown',
    replyMarkup: buildBlogReviewKeyboard(mockPost.id),
  });

  if (reviewResult.success) {
    console.log(`   Sent! Message ID: ${reviewResult.messageId}`);
    console.log('\n   Try tapping Approve/Reject/Preview buttons in Telegram!');
    console.log('   (Note: buttons won\'t work unless the bot is running with polling)');
  } else {
    console.error(`   Failed: ${reviewResult.error}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
