import { NextResponse } from 'next/server'

export interface CreditStatus {
  service: string
  status: 'ok' | 'warning' | 'critical' | 'unknown' | 'error'
  remaining?: number
  limit?: number
  unit: string
  percentUsed?: number
  message: string
}

async function checkDeepSeek(): Promise<CreditStatus> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { service: 'DeepSeek', status: 'unknown', unit: 'USD', message: 'No API key configured' }

  try {
    const response = await fetch('https://api.deepseek.com/user/balance', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    })
    if (!response.ok) throw new Error(`API error: ${response.status}`)

    const data = await response.json() as { balance_infos?: Array<{ total_balance: string }> }
    const balance = data.balance_infos?.[0] ? parseFloat(data.balance_infos[0].total_balance) : 0

    return {
      service: 'DeepSeek',
      status: balance > 5 ? 'ok' : balance > 1 ? 'warning' : 'critical',
      remaining: balance,
      unit: 'USD',
      message: `$${balance.toFixed(2)} remaining`,
    }
  } catch (error) {
    return { service: 'DeepSeek', status: 'error', unit: 'USD', message: `Error: ${error}` }
  }
}

async function checkElevenLabs(): Promise<CreditStatus> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return { service: 'ElevenLabs', status: 'unknown', unit: 'characters', message: 'No API key configured' }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': apiKey, 'Accept': 'application/json' },
    })
    if (!response.ok) throw new Error(`API error: ${response.status}`)

    const data = await response.json() as { character_count: number; character_limit: number }
    const remaining = data.character_limit - data.character_count
    const percentUsed = (data.character_count / data.character_limit) * 100

    return {
      service: 'ElevenLabs',
      status: percentUsed >= 95 ? 'critical' : percentUsed >= 80 ? 'warning' : 'ok',
      remaining,
      limit: data.character_limit,
      unit: 'characters',
      percentUsed,
      message: `${remaining.toLocaleString()} / ${data.character_limit.toLocaleString()} chars`,
    }
  } catch (error) {
    return { service: 'ElevenLabs', status: 'error', unit: 'characters', message: `Error: ${error}` }
  }
}

async function checkCartesia(): Promise<CreditStatus> {
  const apiKey = process.env.CARTESIA_API_KEY
  if (!apiKey) return { service: 'Cartesia', status: 'unknown', unit: 'credits', message: 'No API key configured' }

  try {
    const response = await fetch('https://api.cartesia.ai/billing/usage', {
      headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-06-10', 'Accept': 'application/json' },
    })

    if (!response.ok) {
      // Try account endpoint
      const altResponse = await fetch('https://api.cartesia.ai/account', {
        headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-06-10', 'Accept': 'application/json' },
      })
      if (!altResponse.ok) throw new Error(`API error: ${response.status}`)

      const altData = await altResponse.json() as { credits_remaining?: number }
      return {
        service: 'Cartesia',
        status: (altData.credits_remaining ?? 0) > 100 ? 'ok' : 'warning',
        remaining: altData.credits_remaining,
        unit: 'credits',
        message: `${altData.credits_remaining ?? 'unknown'} credits`,
      }
    }

    const data = await response.json() as { used: number; limit: number }
    const remaining = data.limit - data.used
    const percentUsed = (data.used / data.limit) * 100

    return {
      service: 'Cartesia',
      status: percentUsed >= 95 ? 'critical' : percentUsed >= 80 ? 'warning' : 'ok',
      remaining,
      limit: data.limit,
      unit: 'characters',
      percentUsed,
      message: `${remaining.toLocaleString()} / ${data.limit.toLocaleString()} remaining`,
    }
  } catch (error) {
    return { service: 'Cartesia', status: 'unknown', unit: 'credits', message: `Could not check` }
  }
}

async function checkOpenAI(): Promise<CreditStatus> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { service: 'OpenAI', status: 'unknown', unit: 'API', message: 'No API key configured' }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (response.status === 401) {
      return { service: 'OpenAI', status: 'critical', unit: 'API', message: 'Invalid API key' }
    }
    if (response.status === 429) {
      return { service: 'OpenAI', status: 'critical', unit: 'API', message: 'Rate limited / out of credits' }
    }

    return { service: 'OpenAI', status: 'ok', unit: 'API', message: 'API key valid' }
  } catch (error) {
    return { service: 'OpenAI', status: 'error', unit: 'API', message: `Error: ${error}` }
  }
}

async function checkGoogleAI(): Promise<CreditStatus> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY
  if (!apiKey) return { service: 'Google AI', status: 'unknown', unit: 'API', message: 'No API key configured' }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)

    if (response.status === 400 || response.status === 403) {
      return { service: 'Google AI', status: 'critical', unit: 'API', message: 'Invalid or expired API key' }
    }
    if (response.status === 429) {
      return { service: 'Google AI', status: 'warning', unit: 'API', message: 'Rate limited' }
    }

    return { service: 'Google AI', status: 'ok', unit: 'API', message: 'API key valid' }
  } catch (error) {
    return { service: 'Google AI', status: 'error', unit: 'API', message: `Error: ${error}` }
  }
}

async function checkSmallestAI(): Promise<CreditStatus> {
  const apiKey = process.env.SMALLEST_API_KEY
  if (!apiKey) return { service: 'Smallest AI', status: 'unknown', unit: 'API', message: 'No API key configured' }

  // Smallest AI doesn't have a public balance endpoint, just validate key exists
  return { service: 'Smallest AI', status: 'ok', unit: 'API', message: 'API key configured' }
}

async function checkMusicAI(): Promise<CreditStatus> {
  const apiKey = process.env.MUSIC_AI_API_KEY
  if (!apiKey) return { service: 'MusicAPI.ai', status: 'unknown', unit: 'credits', message: 'No API key configured' }

  try {
    const response = await fetch('https://api.musicapi.ai/api/v1/get-credits', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!response.ok) throw new Error(`API error: ${response.status}`)

    const data = await response.json() as { credits: number; extra_credits: number }
    const totalCredits = data.credits + data.extra_credits

    // 15 credits = 2 songs, so 500 credits = ~66 songs
    // Warning at 100 credits (~13 songs), critical at 30 credits (~4 songs)
    return {
      service: 'MusicAPI.ai',
      status: totalCredits > 100 ? 'ok' : totalCredits > 30 ? 'warning' : 'critical',
      remaining: totalCredits,
      unit: 'credits',
      message: `${totalCredits} credits (${data.credits} monthly + ${data.extra_credits} extra)`,
    }
  } catch (error) {
    return { service: 'MusicAPI.ai', status: 'error', unit: 'credits', message: `Error: ${error}` }
  }
}

export async function GET() {
  const results = await Promise.all([
    checkDeepSeek(),
    checkElevenLabs(),
    checkCartesia(),
    checkOpenAI(),
    checkGoogleAI(),
    checkSmallestAI(),
    checkMusicAI(),
  ])

  return NextResponse.json(results)
}
