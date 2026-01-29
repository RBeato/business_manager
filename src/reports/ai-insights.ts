import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config/index.js';
import type { MetricsSnapshot, ReportInsight } from '../types/index.js';
import type { TrendData } from '../metrics/index.js';

const SYSTEM_PROMPT = `You are a business intelligence analyst for a portfolio of mobile and web applications. Your role is to analyze daily metrics and provide actionable insights.

When analyzing metrics, focus on:
1. Significant changes (positive or negative) in revenue, users, or costs
2. Patterns or trends that warrant attention
3. Opportunities for growth or optimization
4. Potential issues that need addressing
5. Comparisons between apps in the portfolio

Keep insights concise, specific, and actionable. Each insight should be 1-2 sentences max.

Respond with a JSON array of insight objects with this structure:
{
  "type": "positive" | "negative" | "neutral" | "alert",
  "category": "revenue" | "users" | "engagement" | "costs" | "retention" | "general",
  "title": "Short title (5 words max)",
  "description": "Brief description of the insight",
  "metric_change": number (optional, for percentage changes),
  "metric_unit": "%" (optional)
}

Return only valid JSON, no markdown formatting.`;

function buildUserPrompt(
  metrics: MetricsSnapshot,
  trends: TrendData[]
): string {
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
  const formatPercent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  let prompt = `Analyze these business metrics and provide 5-8 key insights:\n\n`;

  // Portfolio summary
  prompt += `## Portfolio Summary\n`;
  prompt += `- Total Revenue: ${formatCurrency(metrics.total_revenue)} (${formatPercent(metrics.revenue_change_pct)} vs yesterday)\n`;
  prompt += `- Total MRR: ${formatCurrency(metrics.total_mrr)}\n`;
  prompt += `- Total DAU: ${metrics.total_dau.toLocaleString()} (${formatPercent(metrics.dau_change_pct)} vs yesterday)\n`;
  prompt += `- Total Installs: ${metrics.total_installs.toLocaleString()}\n`;
  prompt += `- Total Costs: ${formatCurrency(metrics.total_costs)} (${formatPercent(metrics.costs_change_pct)} vs yesterday)\n`;
  prompt += `- Net Profit: ${formatCurrency(metrics.total_revenue - metrics.total_costs)}\n`;
  prompt += `- Cost per User: ${formatCurrency(metrics.cost_per_user)}\n\n`;

  // App breakdown
  prompt += `## App Performance\n`;
  for (const app of metrics.apps) {
    prompt += `\n### ${app.app_name}\n`;
    prompt += `- Revenue: ${formatCurrency(app.revenue)} (${formatPercent(app.revenue_change_pct)})\n`;
    prompt += `- MRR: ${formatCurrency(app.mrr)}\n`;
    prompt += `- DAU: ${app.dau.toLocaleString()} (${formatPercent(app.dau_change_pct)})\n`;
    prompt += `- Installs: ${app.installs.toLocaleString()}\n`;
  }

  // Provider costs
  prompt += `\n## Infrastructure Costs by Provider\n`;
  for (const provider of metrics.providers) {
    if (provider.cost > 0) {
      prompt += `- ${provider.provider_name}: ${formatCurrency(provider.cost)}`;
      if (provider.usage_quantity && provider.usage_unit) {
        prompt += ` (${provider.usage_quantity.toLocaleString()} ${provider.usage_unit})`;
      }
      prompt += ` (${formatPercent(provider.cost_change_pct)})\n`;
    }
  }

  // Trends
  if (trends.length > 0) {
    prompt += `\n## 7-Day Trends\n`;
    prompt += `| Date | Revenue | DAU | Installs | Costs |\n`;
    prompt += `|------|---------|-----|----------|-------|\n`;
    for (const day of trends) {
      prompt += `| ${day.date} | ${formatCurrency(day.revenue)} | ${day.dau.toLocaleString()} | ${day.installs.toLocaleString()} | ${formatCurrency(day.costs)} |\n`;
    }
  }

  return prompt;
}

// Use DeepSeek API (OpenAI-compatible)
async function generateInsightsWithDeepSeek(
  userPrompt: string,
  apiKey: string
): Promise<ReportInsight[]> {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from DeepSeek');
  }

  // Parse JSON response (handle potential markdown code blocks)
  let jsonText = content.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const insights: ReportInsight[] = JSON.parse(jsonText);
  return insights.filter(
    (insight) =>
      insight.type &&
      insight.category &&
      insight.title &&
      insight.description
  );
}

// Use Anthropic API (fallback)
async function generateInsightsWithAnthropic(
  userPrompt: string,
  apiKey: string
): Promise<ReportInsight[]> {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const jsonText = textContent.text.trim();
  const insights: ReportInsight[] = JSON.parse(jsonText);

  return insights.filter(
    (insight) =>
      insight.type &&
      insight.category &&
      insight.title &&
      insight.description
  );
}

export async function generateInsights(
  metrics: MetricsSnapshot,
  trends: TrendData[]
): Promise<ReportInsight[]> {
  const config = getConfig();
  const userPrompt = buildUserPrompt(metrics, trends);

  // Prefer DeepSeek, fallback to Anthropic
  if (config.deepseek) {
    console.log('Using DeepSeek for AI insights...');
    try {
      return await generateInsightsWithDeepSeek(userPrompt, config.deepseek.apiKey);
    } catch (error) {
      console.error('DeepSeek error:', error);
      // Fall through to Anthropic if available
      if (!config.anthropic) {
        throw error;
      }
      console.log('Falling back to Anthropic...');
    }
  }

  if (config.anthropic) {
    console.log('Using Anthropic for AI insights...');
    return await generateInsightsWithAnthropic(userPrompt, config.anthropic.apiKey);
  }

  console.warn('No AI provider configured, skipping AI insights');
  return [];
}

// Generate insights for a specific topic
export async function generateTopicInsights(
  topic: string,
  data: Record<string, unknown>
): Promise<string> {
  const config = getConfig();
  const prompt = `Analyze this ${topic} data and provide a brief insight (2-3 sentences):\n\n${JSON.stringify(data, null, 2)}`;

  // Prefer DeepSeek
  if (config.deepseek) {
    try {
      const client = new OpenAI({
        apiKey: config.deepseek.apiKey,
        baseURL: 'https://api.deepseek.com',
      });

      const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
      });

      return response.choices[0]?.message?.content?.trim() || 'Unable to generate insight.';
    } catch (error) {
      console.error('DeepSeek topic insight error:', error);
      if (!config.anthropic) {
        return 'Error generating insight.';
      }
    }
  }

  // Fallback to Anthropic
  if (config.anthropic) {
    try {
      const anthropic = new Anthropic({
        apiKey: config.anthropic.apiKey,
      });

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return 'Unable to generate insight.';
      }

      return textContent.text.trim();
    } catch (error) {
      console.error('Anthropic topic insight error:', error);
      return 'Error generating insight.';
    }
  }

  return 'AI insights not available - no AI provider configured.';
}
