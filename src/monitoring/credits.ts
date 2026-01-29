/**
 * Credit/Quota Monitoring
 *
 * Monitors API usage and remaining credits across services.
 * Sends alerts when credits are running low.
 */

import { getConfig } from '../config/index.js';
import { sendAlert } from '../delivery/email.js';

export interface CreditStatus {
  service: string;
  status: 'ok' | 'warning' | 'critical' | 'unknown' | 'error';
  remaining?: number;
  limit?: number;
  unit: string;
  percentUsed?: number;
  message: string;
  checkTime: string;
}

export interface CreditThresholds {
  warning: number;  // percentage used (e.g., 80)
  critical: number; // percentage used (e.g., 95)
}

const DEFAULT_THRESHOLDS: CreditThresholds = {
  warning: 80,
  critical: 95,
};

// ============================================
// SERVICE CHECKERS
// ============================================

async function checkDeepSeek(apiKey: string): Promise<CreditStatus> {
  try {
    const response = await fetch('https://api.deepseek.com/user/balance', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as {
      balance_infos?: Array<{ currency: string; total_balance: string; granted_balance: string; topped_up_balance: string }>;
      is_available?: boolean;
    };

    // DeepSeek returns balance info
    const balanceInfo = data.balance_infos?.[0];
    const balance = balanceInfo ? parseFloat(balanceInfo.total_balance) : 0;

    return {
      service: 'DeepSeek',
      status: balance > 5 ? 'ok' : balance > 1 ? 'warning' : 'critical',
      remaining: balance,
      unit: 'USD',
      message: `Balance: $${balance.toFixed(2)}`,
      checkTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'DeepSeek',
      status: 'error',
      unit: 'USD',
      message: `Error checking balance: ${error}`,
      checkTime: new Date().toISOString(),
    };
  }
}

async function checkOpenAI(apiKey: string): Promise<CreditStatus> {
  try {
    // OpenAI doesn't have a direct balance API for pay-as-you-go
    // We can check if the key is valid by making a simple request
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401) {
      return {
        service: 'OpenAI',
        status: 'critical',
        unit: 'API access',
        message: 'API key invalid or expired',
        checkTime: new Date().toISOString(),
      };
    }

    if (response.status === 429) {
      return {
        service: 'OpenAI',
        status: 'critical',
        unit: 'API access',
        message: 'Rate limited - possibly out of credits',
        checkTime: new Date().toISOString(),
      };
    }

    return {
      service: 'OpenAI',
      status: 'ok',
      unit: 'API access',
      message: 'API key valid (check usage at platform.openai.com)',
      checkTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'OpenAI',
      status: 'error',
      unit: 'API access',
      message: `Error: ${error}`,
      checkTime: new Date().toISOString(),
    };
  }
}

async function checkElevenLabs(apiKey: string): Promise<CreditStatus> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as {
      character_count: number;
      character_limit: number;
      tier: string;
      next_character_count_reset_unix: number;
    };

    const used = data.character_count;
    const limit = data.character_limit;
    const remaining = limit - used;
    const percentUsed = (used / limit) * 100;

    const resetDate = new Date(data.next_character_count_reset_unix * 1000);

    let status: CreditStatus['status'] = 'ok';
    if (percentUsed >= 95) status = 'critical';
    else if (percentUsed >= 80) status = 'warning';

    return {
      service: 'ElevenLabs',
      status,
      remaining,
      limit,
      unit: 'characters',
      percentUsed,
      message: `${remaining.toLocaleString()} / ${limit.toLocaleString()} characters remaining (${(100 - percentUsed).toFixed(1)}%). Resets: ${resetDate.toLocaleDateString()}`,
      checkTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'ElevenLabs',
      status: 'error',
      unit: 'characters',
      message: `Error: ${error}`,
      checkTime: new Date().toISOString(),
    };
  }
}

async function checkCartesia(apiKey: string): Promise<CreditStatus> {
  try {
    const response = await fetch('https://api.cartesia.ai/billing/usage', {
      headers: {
        'X-API-Key': apiKey,
        'Cartesia-Version': '2024-06-10',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Try alternative endpoint
      const altResponse = await fetch('https://api.cartesia.ai/account', {
        headers: {
          'X-API-Key': apiKey,
          'Cartesia-Version': '2024-06-10',
          'Accept': 'application/json',
        },
      });

      if (!altResponse.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const altData = await altResponse.json() as { credits_remaining?: number };

      return {
        service: 'Cartesia',
        status: altData.credits_remaining && altData.credits_remaining > 100 ? 'ok' : 'warning',
        remaining: altData.credits_remaining,
        unit: 'credits',
        message: `Credits remaining: ${altData.credits_remaining || 'unknown'}`,
        checkTime: new Date().toISOString(),
      };
    }

    const data = await response.json() as {
      used: number;
      limit: number;
      period_end: string;
    };

    const remaining = data.limit - data.used;
    const percentUsed = (data.used / data.limit) * 100;

    let status: CreditStatus['status'] = 'ok';
    if (percentUsed >= 95) status = 'critical';
    else if (percentUsed >= 80) status = 'warning';

    return {
      service: 'Cartesia',
      status,
      remaining,
      limit: data.limit,
      unit: 'characters',
      percentUsed,
      message: `${remaining.toLocaleString()} / ${data.limit.toLocaleString()} remaining`,
      checkTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'Cartesia',
      status: 'unknown',
      unit: 'credits',
      message: `Could not fetch usage: ${error}`,
      checkTime: new Date().toISOString(),
    };
  }
}

async function checkResend(apiKey: string): Promise<CreditStatus> {
  try {
    // Resend doesn't have a direct quota API, but we can check domains
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401) {
      return {
        service: 'Resend',
        status: 'critical',
        unit: 'API access',
        message: 'API key invalid',
        checkTime: new Date().toISOString(),
      };
    }

    if (response.status === 429) {
      return {
        service: 'Resend',
        status: 'warning',
        unit: 'emails',
        message: 'Rate limited - approaching limits',
        checkTime: new Date().toISOString(),
      };
    }

    // Free tier: 100 emails/day, 3000/month
    // Check dashboard for actual usage
    return {
      service: 'Resend',
      status: 'ok',
      unit: 'emails',
      message: 'API key valid. Check resend.com/emails for usage.',
      checkTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'Resend',
      status: 'error',
      unit: 'emails',
      message: `Error: ${error}`,
      checkTime: new Date().toISOString(),
    };
  }
}

async function checkAnthropic(apiKey: string): Promise<CreditStatus> {
  try {
    // Anthropic doesn't expose balance via API
    // We check if the key works
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (response.status === 401) {
      return {
        service: 'Anthropic',
        status: 'critical',
        unit: 'API access',
        message: 'API key invalid',
        checkTime: new Date().toISOString(),
      };
    }

    if (response.status === 429) {
      const errorData = await response.json() as { error?: { message?: string } };
      const isOutOfCredits = errorData.error?.message?.toLowerCase().includes('credit');

      return {
        service: 'Anthropic',
        status: 'critical',
        unit: 'API access',
        message: isOutOfCredits ? 'Out of credits!' : 'Rate limited',
        checkTime: new Date().toISOString(),
      };
    }

    return {
      service: 'Anthropic',
      status: 'ok',
      unit: 'API access',
      message: 'API key valid. Check console.anthropic.com for usage.',
      checkTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'Anthropic',
      status: 'error',
      unit: 'API access',
      message: `Error: ${error}`,
      checkTime: new Date().toISOString(),
    };
  }
}

// ============================================
// MAIN MONITORING FUNCTION
// ============================================

export async function checkAllCredits(): Promise<CreditStatus[]> {
  const results: CreditStatus[] = [];
  const config = getConfig();

  console.log('Checking API credits and quotas...\n');

  // DeepSeek
  if (config.deepseek) {
    console.log('Checking DeepSeek...');
    results.push(await checkDeepSeek(config.deepseek.apiKey));
  }

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.log('Checking OpenAI...');
    results.push(await checkOpenAI(process.env.OPENAI_API_KEY));
  }

  // ElevenLabs
  if (config.elevenlabs) {
    console.log('Checking ElevenLabs...');
    results.push(await checkElevenLabs(config.elevenlabs.apiKey));
  }

  // Cartesia
  if (config.cartesia) {
    console.log('Checking Cartesia...');
    results.push(await checkCartesia(config.cartesia.apiKey));
  }

  // Resend
  if (config.resend) {
    console.log('Checking Resend...');
    results.push(await checkResend(config.resend.apiKey));
  }

  // Anthropic
  if (config.anthropic) {
    console.log('Checking Anthropic...');
    results.push(await checkAnthropic(config.anthropic.apiKey));
  }

  return results;
}

export async function monitorCredits(sendAlerts: boolean = true): Promise<{
  results: CreditStatus[];
  alerts: CreditStatus[];
}> {
  const results = await checkAllCredits();
  const alerts = results.filter(r => r.status === 'warning' || r.status === 'critical');

  console.log('\n' + '='.repeat(50));
  console.log('CREDIT STATUS SUMMARY');
  console.log('='.repeat(50) + '\n');

  for (const result of results) {
    const icon = result.status === 'ok' ? '✅' :
                 result.status === 'warning' ? '⚠️' :
                 result.status === 'critical' ? '🚨' :
                 result.status === 'error' ? '❌' : '❓';

    console.log(`${icon} ${result.service}: ${result.message}`);
  }

  if (alerts.length > 0 && sendAlerts) {
    console.log('\n⚠️  Sending alert email...');

    const alertHtml = `
      <h2>🚨 API Credit Alert</h2>
      <p>The following services need attention:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Service</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Details</th>
        </tr>
        ${alerts.map(a => `
          <tr style="background: ${a.status === 'critical' ? '#ffe0e0' : '#fff3cd'};">
            <td style="padding: 10px; border: 1px solid #ddd;">${a.service}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${a.status.toUpperCase()}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${a.message}</td>
          </tr>
        `).join('')}
      </table>
      <p style="margin-top: 20px; color: #666;">
        Check your service dashboards to add credits or upgrade your plan.
      </p>
    `;

    try {
      await sendAlert(
        `🚨 API Credit Alert: ${alerts.length} service(s) need attention`,
        alertHtml
      );
      console.log('Alert email sent!');
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  return { results, alerts };
}

// Export for CLI
export { checkDeepSeek, checkElevenLabs, checkCartesia, checkOpenAI, checkResend, checkAnthropic };
