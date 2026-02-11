#!/usr/bin/env tsx
/**
 * Start the Telegram bot in polling mode (development)
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { initBot, stopBot } from '../src/telegram/bot.js';

const bot = initBot();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stopBot(bot);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  stopBot(bot);
  process.exit(0);
});

console.log('Bot is running. Press Ctrl+C to stop.');
