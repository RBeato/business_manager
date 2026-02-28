/**
 * Telegram Bot
 *
 * Initializes the bot with polling for local use.
 * Registers command handlers and callback query routing.
 */

import TelegramBot from 'node-telegram-bot-api';
import { getConfig } from '../config/index.js';
import { setBotInstance } from '../delivery/telegram.js';
import { handleCallbackQuery } from './actions.js';
import { getDb } from '../db/sqlite-client.js';

// ============================================
// Helpers
// ============================================

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0]!;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatChange(pct: number): string {
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `${pct.toFixed(1)}%`;
  return '0%';
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// ============================================
// Command Handlers
// ============================================

function handleRevenue(chatId: number, bot: TelegramBot): void {
  const db = getDb();
  const yesterday = dateStr(1);
  const weekAgo = dateStr(7);
  const monthAgo = dateStr(30);
  const today = dateStr(0);

  const apps = db.prepare('SELECT id, name FROM apps WHERE is_active = 1').all() as { id: string; name: string }[];
  const appMap = new Map(apps.map(a => [a.id, a.name]));

  const todayRev = db.prepare('SELECT app_id, gross_revenue, net_revenue FROM daily_revenue WHERE date = ?').all(yesterday) as any[];
  const weekRev = db.prepare('SELECT app_id, gross_revenue, net_revenue FROM daily_revenue WHERE date >= ? AND date <= ?').all(weekAgo, today) as any[];
  const monthRev = db.prepare('SELECT app_id, gross_revenue, net_revenue FROM daily_revenue WHERE date >= ? AND date <= ?').all(monthAgo, today) as any[];

  const aggregate = (rows: any[]) => {
    const byApp = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const current = byApp.get(r.app_id) || 0;
      byApp.set(r.app_id, current + Number(r.net_revenue || 0));
      total += Number(r.net_revenue || 0);
    }
    return { byApp, total };
  };

  const day = aggregate(todayRev);
  const week = aggregate(weekRev);
  const month = aggregate(monthRev);

  const lines: string[] = [];
  lines.push('\ud83d\udcb0 *Revenue Summary*');
  lines.push('');
  lines.push(`*Yesterday:* ${formatCurrency(day.total)}`);
  lines.push(`*7 days:* ${formatCurrency(week.total)}`);
  lines.push(`*30 days:* ${formatCurrency(month.total)}`);
  lines.push('');

  if (month.byApp.size > 0) {
    lines.push('*By App (30d):*');
    const sorted = [...month.byApp.entries()].sort((a, b) => b[1] - a[1]);
    for (const [appId, rev] of sorted) {
      const name = appMap.get(appId) || 'Unknown';
      if (rev > 0) {
        lines.push(`  ${name}: ${formatCurrency(rev)}`);
      }
    }
  } else {
    lines.push('_No revenue data found_');
  }

  bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

function handleMRR(chatId: number, bot: TelegramBot): void {
  const db = getDb();

  const apps = db.prepare('SELECT id, name FROM apps WHERE is_active = 1').all() as { id: string; name: string }[];
  const appMap = new Map(apps.map(a => [a.id, a.name]));

  const latestSubs = db.prepare(
    'SELECT app_id, mrr, active_subscriptions, active_trials, date FROM daily_subscriptions ORDER BY date DESC LIMIT 50'
  ).all() as any[];

  const latestByApp = new Map<string, any>();
  for (const s of latestSubs) {
    if (!latestByApp.has(s.app_id)) {
      latestByApp.set(s.app_id, s);
    }
  }

  let totalMRR = 0;
  let totalSubs = 0;
  let totalTrials = 0;

  const lines: string[] = [];
  lines.push('\ud83d\udcc8 *MRR & Subscriptions*');
  lines.push('');

  if (latestByApp.size > 0) {
    for (const [appId, s] of latestByApp) {
      const name = appMap.get(appId) || 'Unknown';
      const mrr = Number(s.mrr || 0);
      const subs = Number(s.active_subscriptions || 0);
      const trials = Number(s.active_trials || 0);

      totalMRR += mrr;
      totalSubs += subs;
      totalTrials += trials;

      if (mrr > 0 || subs > 0) {
        lines.push(`*${name}*`);
        lines.push(`  MRR: ${formatCurrency(mrr)}`);
        lines.push(`  Active subs: ${subs}`);
        if (trials > 0) lines.push(`  Active trials: ${trials}`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`*Total MRR:* ${formatCurrency(totalMRR)}`);
    lines.push(`*Total subs:* ${totalSubs}`);
    if (totalTrials > 0) lines.push(`*Total trials:* ${totalTrials}`);
  } else {
    lines.push('_No subscription data found_');
  }

  bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

function handleCosts(chatId: number, bot: TelegramBot): void {
  const db = getDb();
  const monthAgo = dateStr(30);
  const today = dateStr(0);
  const yesterday = dateStr(1);

  const providers = db.prepare('SELECT id, name FROM providers WHERE is_active = 1').all() as { id: string; name: string }[];
  const providerMap = new Map(providers.map(p => [p.id, p.name]));

  const costs = db.prepare(
    'SELECT provider_id, cost, date FROM daily_provider_costs WHERE date >= ? AND date <= ?'
  ).all(monthAgo, today) as any[];

  const byProvider = new Map<string, { total30d: number; today: number }>();
  for (const c of costs) {
    const entry = byProvider.get(c.provider_id) || { total30d: 0, today: 0 };
    entry.total30d += Number(c.cost || 0);
    if (c.date === yesterday) {
      entry.today += Number(c.cost || 0);
    }
    byProvider.set(c.provider_id, entry);
  }

  let total30d = 0;
  let totalToday = 0;

  const lines: string[] = [];
  lines.push('\ud83d\udcb8 *Cost Breakdown*');
  lines.push('');

  if (byProvider.size > 0) {
    const sorted = [...byProvider.entries()].sort((a, b) => b[1].total30d - a[1].total30d);
    for (const [providerId, entry] of sorted) {
      const name = providerMap.get(providerId) || 'Unknown';
      total30d += entry.total30d;
      totalToday += entry.today;
      lines.push(`*${name}*`);
      lines.push(`  Yesterday: ${formatCurrency(entry.today)}`);
      lines.push(`  30d total: ${formatCurrency(entry.total30d)}`);
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Total yesterday:* ${formatCurrency(totalToday)}`);
    lines.push(`*Total 30d:* ${formatCurrency(total30d)}`);
  } else {
    lines.push('_No cost data found_');
  }

  bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

function handleReport(chatId: number, bot: TelegramBot): void {
  const db = getDb();
  const yesterday = dateStr(1);
  const prevDay = dateStr(2);
  const weekAgo = dateStr(7);
  const today = dateStr(0);

  const apps = db.prepare('SELECT id, name FROM apps WHERE is_active = 1').all() as { id: string; name: string }[];
  const appMap = new Map(apps.map(a => [a.id, a.name]));

  const todayRevenue = db.prepare('SELECT app_id, net_revenue FROM daily_revenue WHERE date = ?').all(yesterday) as any[];
  const prevRevenue = db.prepare('SELECT app_id, net_revenue FROM daily_revenue WHERE date = ?').all(prevDay) as any[];
  const todayUsers = db.prepare("SELECT app_id, dau FROM daily_active_users WHERE date = ? AND platform = 'all'").all(yesterday) as any[];
  const prevUsers = db.prepare("SELECT app_id, dau FROM daily_active_users WHERE date = ? AND platform = 'all'").all(prevDay) as any[];
  const todayInstalls = db.prepare('SELECT app_id, installs FROM daily_installs WHERE date = ?').all(yesterday) as any[];
  const todaySubs = db.prepare('SELECT app_id, mrr, active_subscriptions FROM daily_subscriptions ORDER BY date DESC LIMIT 50').all() as any[];
  const todayCosts = db.prepare('SELECT provider_id, cost FROM daily_provider_costs WHERE date = ?').all(yesterday) as any[];
  const prevCosts = db.prepare('SELECT provider_id, cost FROM daily_provider_costs WHERE date = ?').all(prevDay) as any[];
  const weekRevenue = db.prepare('SELECT app_id, net_revenue FROM daily_revenue WHERE date >= ? AND date <= ?').all(weekAgo, today) as any[];

  const sum = (rows: any[], field: string) => rows.reduce((s, r) => s + Number(r[field] || 0), 0);

  const totalRev = sum(todayRevenue, 'net_revenue');
  const prevTotalRev = sum(prevRevenue, 'net_revenue');
  const totalDau = sum(todayUsers, 'dau');
  const prevTotalDau = sum(prevUsers, 'dau');
  const totalInstalls = sum(todayInstalls, 'installs');
  const totalCosts = sum(todayCosts, 'cost');
  const prevTotalCosts = sum(prevCosts, 'cost');
  const weekTotalRev = sum(weekRevenue, 'net_revenue');

  const mrrByApp = new Map<string, number>();
  for (const s of todaySubs) {
    if (!mrrByApp.has(s.app_id)) {
      mrrByApp.set(s.app_id, Number(s.mrr || 0));
    }
  }
  const totalMRR = [...mrrByApp.values()].reduce((s, v) => s + v, 0);

  const revChange = prevTotalRev > 0 ? ((totalRev - prevTotalRev) / prevTotalRev) * 100 : 0;
  const dauChange = prevTotalDau > 0 ? ((totalDau - prevTotalDau) / prevTotalDau) * 100 : 0;
  const costChange = prevTotalCosts > 0 ? ((totalCosts - prevTotalCosts) / prevTotalCosts) * 100 : 0;

  const lines: string[] = [];
  lines.push(`\ud83d\udcca *Daily Report \u2014 ${yesterday}*`);
  lines.push('');
  lines.push('*Revenue & MRR*');
  lines.push(`  Revenue: ${formatCurrency(totalRev)} (${formatChange(revChange)})`);
  lines.push(`  7d Revenue: ${formatCurrency(weekTotalRev)}`);
  lines.push(`  MRR: ${formatCurrency(totalMRR)}`);
  lines.push('');
  lines.push('*Users*');
  lines.push(`  DAU: ${totalDau.toLocaleString()} (${formatChange(dauChange)})`);
  lines.push(`  Installs: ${totalInstalls.toLocaleString()}`);
  lines.push('');
  lines.push('*Costs*');
  lines.push(`  Total: ${formatCurrency(totalCosts)} (${formatChange(costChange)})`);
  if (totalDau > 0) {
    lines.push(`  Cost/User: ${formatCurrency(totalCosts / totalDau)}`);
  }
  lines.push('');

  const appRevMap = new Map<string, number>();
  for (const r of todayRevenue) {
    appRevMap.set(r.app_id, (appRevMap.get(r.app_id) || 0) + Number(r.net_revenue || 0));
  }
  const appDauMap = new Map<string, number>();
  for (const u of todayUsers) {
    appDauMap.set(u.app_id, (appDauMap.get(u.app_id) || 0) + Number(u.dau || 0));
  }

  const allAppIds = new Set([...appRevMap.keys(), ...appDauMap.keys()]);
  if (allAppIds.size > 0) {
    lines.push('*By App*');
    for (const appId of allAppIds) {
      const name = appMap.get(appId) || 'Unknown';
      const rev = appRevMap.get(appId) || 0;
      const dau = appDauMap.get(appId) || 0;
      if (rev > 0 || dau > 0) {
        lines.push(`  ${name}: ${formatCurrency(rev)} rev, ${dau} DAU`);
      }
    }
  }

  bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

function handleStatus(chatId: number, bot: TelegramBot): void {
  const db = getDb();

  const posts = db.prepare(
    "SELECT id, title, website, seo_score, created_at FROM blog_posts WHERE status = 'pending_review' ORDER BY created_at DESC LIMIT 5"
  ).all() as any[];

  const notifs = db.prepare(
    'SELECT notification_type, created_at FROM telegram_notifications ORDER BY created_at DESC LIMIT 5'
  ).all() as any[];

  const actions = db.prepare(
    'SELECT action_type, status, created_at FROM telegram_actions ORDER BY created_at DESC LIMIT 5'
  ).all() as any[];

  const lines: string[] = [];
  lines.push('\ud83d\udcca *System Status*');
  lines.push('');

  lines.push(`*Pending blog reviews:* ${posts.length}`);
  if (posts.length > 0) {
    for (const p of posts) {
      lines.push(`  \u2022 ${escapeMarkdown(p.title)} (${p.website}, SEO: ${p.seo_score})`);
    }
    lines.push('');
  }

  if (notifs.length > 0) {
    lines.push('*Recent notifications:*');
    for (const n of notifs) {
      const time = new Date(n.created_at).toLocaleDateString();
      const typeLabel = (n.notification_type || '').replace(/_/g, ' ');
      lines.push(`  \u2022 ${typeLabel} \u2014 ${time}`);
    }
    lines.push('');
  }

  if (actions.length > 0) {
    lines.push('*Recent actions:*');
    for (const a of actions) {
      const time = new Date(a.created_at).toLocaleDateString();
      const icon = a.status === 'completed' ? '\u2705' : a.status === 'failed' ? '\u274c' : '\u23f3';
      const actionLabel = (a.action_type || '').replace(/_/g, ' ');
      lines.push(`  ${icon} ${actionLabel} \u2014 ${time}`);
    }
  }

  if (posts.length === 0 && notifs.length === 0 && actions.length === 0) {
    lines.push('_No recent activity_');
  }

  bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

// ============================================
// Bot initialization
// ============================================

/**
 * Initialize the Telegram bot with polling
 */
export function initBot(): TelegramBot {
  const config = getConfig();
  if (!config.telegram) {
    throw new Error('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
  }

  const bot = new TelegramBot(config.telegram.botToken, { polling: true });
  setBotInstance(bot);

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, [
      '\ud83d\ude80 *Business Manager Bot*',
      '',
      'I help you manage your business portfolio:',
      '\u2022 Review & approve blog posts',
      '\u2022 Check revenue, MRR, costs',
      '\u2022 Get daily reports',
      '\u2022 Monitor app store activity',
      '',
      '*Commands:*',
      '/revenue \u2014 Revenue summary (1d, 7d, 30d)',
      '/mrr \u2014 MRR and active subscriptions',
      '/costs \u2014 Provider cost breakdown',
      '/report \u2014 Full daily report',
      '/status \u2014 Pending reviews & activity',
      '/help \u2014 Show this help',
      '',
      `Your chat ID: \`${msg.chat.id}\``,
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, [
      '\ud83d\ude80 *Business Manager Bot*',
      '',
      '*Commands:*',
      '/revenue \u2014 Revenue summary (yesterday, 7d, 30d)',
      '/mrr \u2014 Current MRR and active subscriptions',
      '/costs \u2014 Provider cost breakdown',
      '/report \u2014 Full daily report',
      '/status \u2014 Pending blog reviews & activity',
      '/help \u2014 Show this help message',
      '',
      '*Blog Review:*',
      'When new blog posts are generated, you\u2019ll receive a notification with Approve/Reject buttons.',
    ].join('\n'), { parse_mode: 'Markdown' });
  });

  bot.onText(/\/revenue/, (msg) => {
    try {
      handleRevenue(msg.chat.id, bot);
    } catch (err) {
      console.error('Revenue command error:', err);
      bot.sendMessage(msg.chat.id, '\u274c Failed to fetch revenue data.');
    }
  });

  bot.onText(/\/mrr/, (msg) => {
    try {
      handleMRR(msg.chat.id, bot);
    } catch (err) {
      console.error('MRR command error:', err);
      bot.sendMessage(msg.chat.id, '\u274c Failed to fetch MRR data.');
    }
  });

  bot.onText(/\/costs/, (msg) => {
    try {
      handleCosts(msg.chat.id, bot);
    } catch (err) {
      console.error('Costs command error:', err);
      bot.sendMessage(msg.chat.id, '\u274c Failed to fetch cost data.');
    }
  });

  bot.onText(/\/report/, (msg) => {
    try {
      handleReport(msg.chat.id, bot);
    } catch (err) {
      console.error('Report command error:', err);
      bot.sendMessage(msg.chat.id, '\u274c Failed to generate report.');
    }
  });

  bot.onText(/\/status/, (msg) => {
    try {
      handleStatus(msg.chat.id, bot);
    } catch (err) {
      console.error('Status command error:', err);
      bot.sendMessage(msg.chat.id, '\u274c Failed to fetch status.');
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
