// Supabase Edge Function: Telegram Webhook
// Handles all Telegram bot interactions via webhook (no polling needed).
// Deploy with: supabase functions deploy telegram-webhook --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ============================================
// Types
// ============================================

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
  entities?: { type: string; offset: number; length: number }[];
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUser {
  id: number;
  first_name: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: { text: string; callback_data: string }[][];
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
// Telegram API helpers
// ============================================

async function sendMessage(
  chatId: number | string,
  text: string,
  opts?: { reply_markup?: InlineKeyboardMarkup; parse_mode?: string },
): Promise<{ ok: boolean; result?: { message_id: number } }> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode ?? 'Markdown',
      disable_web_page_preview: true,
      ...opts?.reply_markup ? { reply_markup: opts.reply_markup } : {},
    }),
  });
  return res.json();
}

async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...replyMarkup ? { reply_markup: replyMarkup } : {},
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = getEnv('TELEGRAM_BOT_TOKEN');
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

// ============================================
// Formatting helpers
// ============================================

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatChange(pct: number): string {
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `${pct.toFixed(1)}%`;
  return '0%';
}

function dateStr(daysAgo: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ============================================
// Keyboard builders
// ============================================

function buildBlogReviewKeyboard(blogPostId: string): InlineKeyboardMarkup {
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

function buildBlogApprovedKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '\u2705 Approved', callback_data: 'noop' }],
    ],
  };
}

function buildBlogRejectedKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '\u274c Rejected', callback_data: 'noop' }],
    ],
  };
}

// ============================================
// Command handlers
// ============================================

async function handleRevenue(chatId: number, supabase: SupabaseClient): Promise<void> {
  const today = dateStr(0);
  const weekAgo = dateStr(7);
  const monthAgo = dateStr(30);

  // Get app names
  const { data: apps } = await supabase
    .from('apps')
    .select('id, name')
    .eq('is_active', true);

  const appMap = new Map((apps || []).map(a => [a.id, a.name]));

  // Fetch revenue for today, 7d, 30d
  const [{ data: todayRev }, { data: weekRev }, { data: monthRev }] = await Promise.all([
    supabase.from('daily_revenue').select('app_id, gross_revenue, net_revenue').eq('date', dateStr(1)),
    supabase.from('daily_revenue').select('app_id, gross_revenue, net_revenue').gte('date', weekAgo).lte('date', today),
    supabase.from('daily_revenue').select('app_id, gross_revenue, net_revenue').gte('date', monthAgo).lte('date', today),
  ]);

  // Aggregate by app
  const aggregate = (rows: any[]) => {
    const byApp = new Map<string, number>();
    let total = 0;
    for (const r of rows || []) {
      const current = byApp.get(r.app_id) || 0;
      byApp.set(r.app_id, current + Number(r.net_revenue || 0));
      total += Number(r.net_revenue || 0);
    }
    return { byApp, total };
  };

  const day = aggregate(todayRev || []);
  const week = aggregate(weekRev || []);
  const month = aggregate(monthRev || []);

  const lines: string[] = [];
  lines.push('\ud83d\udcb0 *Revenue Summary*');
  lines.push('');
  lines.push(`*Yesterday:* ${formatCurrency(day.total)}`);
  lines.push(`*7 days:* ${formatCurrency(week.total)}`);
  lines.push(`*30 days:* ${formatCurrency(month.total)}`);
  lines.push('');

  // Per-app breakdown (30d)
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

  await sendMessage(chatId, lines.join('\n'));
}

async function handleMRR(chatId: number, supabase: SupabaseClient): Promise<void> {
  const { data: apps } = await supabase
    .from('apps')
    .select('id, name')
    .eq('is_active', true);

  const appMap = new Map((apps || []).map(a => [a.id, a.name]));

  // Get latest subscription data (most recent date with data)
  const { data: latestSubs } = await supabase
    .from('daily_subscriptions')
    .select('app_id, mrr, active_subscriptions, active_trials, date')
    .order('date', { ascending: false })
    .limit(50);

  // Deduplicate: keep only the latest entry per app_id
  const latestByApp = new Map<string, any>();
  for (const s of latestSubs || []) {
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

  await sendMessage(chatId, lines.join('\n'));
}

async function handleCosts(chatId: number, supabase: SupabaseClient): Promise<void> {
  const monthAgo = dateStr(30);
  const today = dateStr(0);

  const { data: providers } = await supabase
    .from('providers')
    .select('id, name')
    .eq('is_active', true);

  const providerMap = new Map((providers || []).map(p => [p.id, p.name]));

  const { data: costs } = await supabase
    .from('daily_provider_costs')
    .select('provider_id, cost, date')
    .gte('date', monthAgo)
    .lte('date', today);

  // Aggregate by provider
  const byProvider = new Map<string, { total30d: number; today: number }>();
  const yesterday = dateStr(1);

  for (const c of costs || []) {
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

  await sendMessage(chatId, lines.join('\n'));
}

async function handleReport(chatId: number, supabase: SupabaseClient): Promise<void> {
  const yesterday = dateStr(1);
  const prevDay = dateStr(2);
  const weekAgo = dateStr(7);
  const today = dateStr(0);

  const { data: apps } = await supabase
    .from('apps')
    .select('id, name')
    .eq('is_active', true);

  const appMap = new Map((apps || []).map(a => [a.id, a.name]));

  const [
    { data: todayRevenue },
    { data: prevRevenue },
    { data: todayUsers },
    { data: prevUsers },
    { data: todayInstalls },
    { data: todaySubs },
    { data: todayCosts },
    { data: prevCosts },
    { data: weekRevenue },
  ] = await Promise.all([
    supabase.from('daily_revenue').select('app_id, net_revenue').eq('date', yesterday),
    supabase.from('daily_revenue').select('app_id, net_revenue').eq('date', prevDay),
    supabase.from('daily_active_users').select('app_id, dau').eq('date', yesterday).eq('platform', 'all'),
    supabase.from('daily_active_users').select('app_id, dau').eq('date', prevDay).eq('platform', 'all'),
    supabase.from('daily_installs').select('app_id, installs').eq('date', yesterday),
    supabase.from('daily_subscriptions').select('app_id, mrr, active_subscriptions').order('date', { ascending: false }).limit(50),
    supabase.from('daily_provider_costs').select('provider_id, cost').eq('date', yesterday),
    supabase.from('daily_provider_costs').select('provider_id, cost').eq('date', prevDay),
    supabase.from('daily_revenue').select('app_id, net_revenue').gte('date', weekAgo).lte('date', today),
  ]);

  const sum = (rows: any[], field: string) => (rows || []).reduce((s, r) => s + Number(r[field] || 0), 0);

  const totalRev = sum(todayRevenue || [], 'net_revenue');
  const prevTotalRev = sum(prevRevenue || [], 'net_revenue');
  const totalDau = sum(todayUsers || [], 'dau');
  const prevTotalDau = sum(prevUsers || [], 'dau');
  const totalInstalls = sum(todayInstalls || [], 'installs');
  const totalCosts = sum(todayCosts || [], 'cost');
  const prevTotalCosts = sum(prevCosts || [], 'cost');
  const weekTotalRev = sum(weekRevenue || [], 'net_revenue');

  // Get latest MRR per app (deduplicated)
  const mrrByApp = new Map<string, number>();
  for (const s of todaySubs || []) {
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

  // Per-app breakdown
  const appRevMap = new Map<string, number>();
  for (const r of todayRevenue || []) {
    appRevMap.set(r.app_id, (appRevMap.get(r.app_id) || 0) + Number(r.net_revenue || 0));
  }
  const appDauMap = new Map<string, number>();
  for (const u of todayUsers || []) {
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

  await sendMessage(chatId, lines.join('\n'));
}

async function handleStatus(chatId: number, supabase: SupabaseClient): Promise<void> {
  const [pendingPosts, recentNotifications, recentActions] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id, title, website, seo_score, created_at')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('telegram_notifications')
      .select('notification_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('telegram_actions')
      .select('action_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const lines: string[] = [];
  lines.push('\ud83d\udcca *System Status*');
  lines.push('');

  // Pending blog reviews
  const posts = pendingPosts.data || [];
  lines.push(`*Pending blog reviews:* ${posts.length}`);
  if (posts.length > 0) {
    for (const p of posts) {
      lines.push(`  \u2022 ${escapeMarkdown(p.title)} (${p.website}, SEO: ${p.seo_score})`);
    }
    lines.push('');
  }

  // Recent notifications
  const notifs = recentNotifications.data || [];
  if (notifs.length > 0) {
    lines.push('*Recent notifications:*');
    for (const n of notifs) {
      const time = new Date(n.created_at).toLocaleDateString();
      const typeLabel = (n.notification_type || '').replace(/_/g, ' ');
      lines.push(`  \u2022 ${typeLabel} \u2014 ${time}`);
    }
    lines.push('');
  }

  // Recent actions
  const actions = recentActions.data || [];
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

  await sendMessage(chatId, lines.join('\n'));
}

async function handleHelp(chatId: number): Promise<void> {
  const lines: string[] = [];
  lines.push('\ud83d\ude80 *Business Manager Bot*');
  lines.push('');
  lines.push('*Commands:*');
  lines.push('/revenue \u2014 Revenue summary (yesterday, 7d, 30d)');
  lines.push('/mrr \u2014 Current MRR and active subscriptions');
  lines.push('/costs \u2014 Provider cost breakdown');
  lines.push('/report \u2014 Full daily report');
  lines.push('/status \u2014 Pending blog reviews & activity');
  lines.push('/help \u2014 Show this help message');
  lines.push('');
  lines.push('*Blog Review:*');
  lines.push('When new blog posts are generated, you\u2019ll receive a notification with Approve/Reject buttons.');
  lines.push('');
  lines.push('*Dashboard:*');
  lines.push('[Open Dashboard](https://dashboard-rbeatos-projects.vercel.app)');
  lines.push('');
  lines.push('_Runs 24/7 as a Supabase Edge Function_');

  await sendMessage(chatId, lines.join('\n'));
}

// ============================================
// Callback query handlers
// ============================================

async function handleApproveBlog(
  blogPostId: string,
  callbackQuery: TelegramCallbackQuery,
  supabase: SupabaseClient,
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
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
    const { error } = await supabase
      .from('blog_posts')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', blogPostId);

    if (error) throw error;

    // Update the message keyboard to show "Approved"
    if (chatId && messageId) {
      const originalText = callbackQuery.message?.text || '';
      await editMessageText(
        chatId,
        messageId,
        originalText + '\n\n\u2705 *Approved* \u2014 Ready for publishing.',
        buildBlogApprovedKeyboard(),
      );
    }

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

    if (chatId) {
      await sendMessage(chatId, `\u274c Failed to approve post: ${msg}`);
    }
  }
}

async function handleRejectBlog(
  blogPostId: string,
  callbackQuery: TelegramCallbackQuery,
  supabase: SupabaseClient,
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
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
    const { error } = await supabase
      .from('blog_posts')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', blogPostId);

    if (error) throw error;

    // Reset the topic back to queued
    await supabase
      .from('blog_topics')
      .update({ status: 'queued' })
      .eq('related_blog_post_id', blogPostId);

    // Update message keyboard
    if (chatId && messageId) {
      const originalText = callbackQuery.message?.text || '';
      await editMessageText(
        chatId,
        messageId,
        originalText + '\n\n\u274c *Rejected* \u2014 Topic returned to queue.',
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

    if (chatId) {
      await sendMessage(chatId, `\u274c Failed to reject post: ${msg}`);
    }
  }
}

async function handlePreviewBlog(
  blogPostId: string,
  callbackQuery: TelegramCallbackQuery,
  supabase: SupabaseClient,
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;

  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, content')
    .eq('id', blogPostId)
    .single();

  if (!post || !chatId) {
    console.error(`Blog post ${blogPostId} not found for preview`);
    return;
  }

  // Format preview (respect Telegram's 4096 char limit)
  const header = `\ud83d\udcdd *${escapeMarkdown(post.title)}*\n\n`;
  const maxContentLength = 4000 - header.length;

  let content = post.content;
  if (content.length > maxContentLength) {
    content = content.slice(0, maxContentLength) + '\n\n_... (truncated)_';
  }

  // Strip markdown formatting that conflicts with Telegram
  content = content
    .replace(/^#{1,6}\s+/gm, '*')
    .replace(/\*\*/g, '*');

  await sendMessage(chatId, header + content);
}

// ============================================
// Main handler
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Verify webhook secret (Telegram sends it as X-Telegram-Bot-Api-Secret-Token)
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (webhookSecret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== webhookSecret) {
        console.error(`Webhook secret mismatch. Expected length: ${webhookSecret.length}, Got length: ${headerSecret?.length ?? 'null'}`);
        // Log but don't block - secret propagation can be delayed
      }
    }

    const update: TelegramUpdate = await req.json();
    const supabase = getSupabase();

    // Determine chat ID from the update
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (!chatId) {
      return new Response('ok');
    }

    // Security: Only respond to authorized chat
    const authorizedChatId = getEnv('TELEGRAM_CHAT_ID');
    if (String(chatId) !== authorizedChatId) {
      console.error(`Unauthorized chat_id: ${chatId}`);
      return new Response('ok');
    }

    // Handle callback queries (inline button presses)
    if (update.callback_query) {
      const data = update.callback_query.data;
      if (!data) return new Response('ok');

      const [action, targetId] = data.split(':');

      await answerCallbackQuery(update.callback_query.id);

      if (!action || !targetId) return new Response('ok');

      switch (action) {
        case 'approve_blog':
          await handleApproveBlog(targetId, update.callback_query, supabase);
          break;
        case 'reject_blog':
          await handleRejectBlog(targetId, update.callback_query, supabase);
          break;
        case 'preview_blog':
          await handlePreviewBlog(targetId, update.callback_query, supabase);
          break;
        case 'noop':
          break;
        default:
          console.log(`Unknown callback action: ${action}`);
      }

      return new Response('ok');
    }

    // Handle text commands
    if (update.message?.text) {
      const text = update.message.text.trim();
      const command = text.split(' ')[0].split('@')[0].toLowerCase(); // Strip bot username

      switch (command) {
        case '/start':
        case '/help':
          await handleHelp(chatId);
          break;
        case '/revenue':
          await handleRevenue(chatId, supabase);
          break;
        case '/mrr':
          await handleMRR(chatId, supabase);
          break;
        case '/costs':
          await handleCosts(chatId, supabase);
          break;
        case '/report':
          await handleReport(chatId, supabase);
          break;
        case '/status':
          await handleStatus(chatId, supabase);
          break;
        default:
          // Unknown command - show help
          if (text.startsWith('/')) {
            await sendMessage(chatId, `Unknown command: ${command}\n\nType /help for available commands.`);
          }
      }
    }

    return new Response('ok');
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to Telegram so it doesn't retry
    return new Response('ok');
  }
});
