import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import OpenAI from 'openai'

export async function GET() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
  }

  const db = getDb()

  const token = db.prepare('SELECT channel_id, channel_title FROM youtube_oauth_tokens LIMIT 1').get() as
    | { channel_id: string; channel_title: string }
    | undefined

  if (!token) {
    return NextResponse.json({ error: 'No YouTube channel connected' }, { status: 400 })
  }

  // Fetch last 30 days of daily metrics
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startDate = thirtyDaysAgo.toISOString().split('T')[0]

  const dailyMetrics = db.prepare(
    'SELECT date, views, estimated_minutes_watched, subscribers_gained, subscribers_lost, net_subscribers, likes, comments, shares, average_view_duration_seconds, average_view_percentage FROM daily_youtube_metrics WHERE channel_id = ? AND date >= ? ORDER BY date'
  ).all(token.channel_id, startDate) as Record<string, number>[]

  // Fetch all videos sorted by views
  const videos = db.prepare(
    'SELECT video_id, title, published_at, duration_seconds, is_short, views, likes, comments, estimated_minutes_watched, average_view_duration_seconds, average_view_percentage FROM youtube_videos WHERE channel_id = ? ORDER BY views DESC LIMIT 30'
  ).all(token.channel_id) as Record<string, unknown>[]

  // Compute summary stats for the prompt
  const totalViews = dailyMetrics.reduce((s, d) => s + (d.views || 0), 0)
  const totalWatchMins = dailyMetrics.reduce((s, d) => s + (d.estimated_minutes_watched || 0), 0)
  const totalSubsGained = dailyMetrics.reduce((s, d) => s + (d.subscribers_gained || 0), 0)
  const totalSubsLost = dailyMetrics.reduce((s, d) => s + (d.subscribers_lost || 0), 0)
  const totalLikes = dailyMetrics.reduce((s, d) => s + (d.likes || 0), 0)
  const totalComments = dailyMetrics.reduce((s, d) => s + (d.comments || 0), 0)
  const totalShares = dailyMetrics.reduce((s, d) => s + (d.shares || 0), 0)
  const avgViewDuration = dailyMetrics.length > 0
    ? dailyMetrics.reduce((s, d) => s + (d.average_view_duration_seconds || 0), 0) / dailyMetrics.length
    : 0

  const shorts = videos.filter(v => Boolean(v.is_short))
  const longForm = videos.filter(v => !Boolean(v.is_short))

  const topShorts = shorts.slice(0, 5).map(v => `"${v.title}" (${v.views} views, ${v.likes} likes)`).join('\n  ')
  const topLong = longForm.slice(0, 5).map(v => `"${v.title}" (${v.views} views, ${v.likes} likes, avg view ${Math.round((v.average_view_percentage as number) || 0)}%)`).join('\n  ')

  // Detect trends (compare first half vs second half of the period)
  const mid = Math.floor(dailyMetrics.length / 2)
  const firstHalf = dailyMetrics.slice(0, mid)
  const secondHalf = dailyMetrics.slice(mid)
  const avgViewsFirst = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.views, 0) / firstHalf.length : 0
  const avgViewsSecond = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.views, 0) / secondHalf.length : 0
  const viewsTrend = avgViewsFirst > 0 ? ((avgViewsSecond - avgViewsFirst) / avgViewsFirst * 100).toFixed(1) : '0'

  const prompt = `You are a YouTube growth strategist for a guitar education channel called "Romeu Beato" that is linked to riffroutine.com — an AI-powered guitar practice app ecosystem.

STRATEGIC CONTEXT:
- The main business goal is growing the YouTube channel to drive traffic to www.riffroutine.com for app subscriptions
- RiffRoutine is positioned as a "Practice OS" — adaptive AI routines, not static lessons
- Connected apps: RiffRoutine (practice routines), SM Guitar (scales/modes), Guitar Progression Generator (chord progressions), Ear N Play (ear training)
- Competitors: JustinGuitar (free lessons), GPR/Levi Clay (static content library + masterclasses), Patreon creators
- RiffRoutine's edge: AI-adaptive routines, cross-app intelligence, no teacher dependency, niche genre support (fado, world guitar)

CONTENT STRATEGY FRAMEWORK:
- YouTube Shorts = Discovery engine (scale reveals, chord tricks, interval challenges — "reveal, don't explain")
- YouTube Long-form = SEO + Trust (practice problem-solving, "why your solos sound the same", structured practice guides)
- Every long-form CTA should point to RiffRoutine.com for free AI routine generation
- Blog posts on riffroutine.com are SEO traffic magnets that convert to app subscriptions

CHANNEL DATA (Last 30 days, ${dailyMetrics.length} days of data):
- Total views: ${totalViews}
- Total watch time: ${Math.round(totalWatchMins / 60 * 10) / 10} hours
- Subscribers gained: ${totalSubsGained}, lost: ${totalSubsLost}, net: ${totalSubsGained - totalSubsLost}
- Total likes: ${totalLikes}, comments: ${totalComments}, shares: ${totalShares}
- Avg view duration: ${Math.round(avgViewDuration)}s
- Views trend (first half vs second half): ${viewsTrend}%

VIDEO CATALOG:
- Total Shorts: ${shorts.length}, Total Long-form: ${longForm.length}
- Shorts total views: ${shorts.reduce((s, v) => s + ((v.views as number) || 0), 0)}, avg: ${shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + ((v.views as number) || 0), 0) / shorts.length) : 0}
- Long-form total views: ${longForm.reduce((s, v) => s + ((v.views as number) || 0), 0)}, avg: ${longForm.length > 0 ? Math.round(longForm.reduce((s, v) => s + ((v.views as number) || 0), 0) / longForm.length) : 0}

TOP SHORTS:
  ${topShorts || 'None'}

TOP LONG-FORM:
  ${topLong || 'None'}

Based on this data, provide strategic direction. Respond in this exact JSON format:
{
  "headline": "One-line strategic direction (max 15 words, action-oriented)",
  "analysis": "2-3 sentence analysis of what the data shows — trends, what's working, what's underperforming",
  "actions": [
    {
      "priority": "high" | "medium",
      "action": "Specific, actionable recommendation (1 sentence)",
      "rationale": "Why this matters for the YouTube → RiffRoutine funnel (1 sentence)"
    }
  ],
  "nextVideo": {
    "type": "short" | "long-form",
    "title": "Suggested video title",
    "hook": "Opening hook or concept in 1 sentence",
    "cta": "How this video drives traffic to RiffRoutine"
  },
  "nextBlogPost": {
    "title": "Complementary blog post title for riffroutine.com",
    "keyword": "Target SEO keyword",
    "connection": "How this blog post connects to the suggested video"
  }
}

Return ONLY valid JSON, no markdown, no code blocks. Keep actions to 3-4 items max. Be specific to THIS channel's data, not generic YouTube advice.`

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    })

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''

    // Strip markdown code blocks if present
    const cleaned = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')

    const insights = JSON.parse(cleaned)

    return NextResponse.json({
      insights,
      generatedAt: new Date().toISOString(),
      dataPoints: dailyMetrics.length,
    })
  } catch (error) {
    console.error('Failed to generate insights:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
