'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'

type TimePeriod = '7d' | '14d' | '30d'

interface InsightAction {
  priority: 'high' | 'medium'
  action: string
  rationale: string
}

interface Insights {
  headline: string
  analysis: string
  actions: InsightAction[]
  nextVideo: {
    type: 'short' | 'long-form'
    title: string
    hook: string
    cta: string
  }
  nextBlogPost: {
    title: string
    keyword: string
    connection: string
  }
}

interface InsightsResponse {
  insights: Insights
  generatedAt: string
}

interface DailyMetric {
  date: string
  views: number
  estimated_minutes_watched: number
  subscribers_gained: number
  subscribers_lost: number
  net_subscribers: number
  likes: number
  comments: number
  shares: number
  average_view_duration_seconds: number
  impressions: number
  impressions_ctr: number
}

interface Video {
  video_id: string
  title: string
  published_at: string
  duration_seconds: number
  is_short: boolean
  views: number
  likes: number
  comments: number
  estimated_minutes_watched: number
  impressions: number
  impressions_ctr: number
  thumbnail_url: string
}

interface YouTubeData {
  connected: boolean
  channelId?: string
  channelTitle?: string
  dailyMetrics: DailyMetric[]
  videos: Video[]
  summary: {
    totalViews: number
    totalWatchHours: number
    netSubscribers: number
    avgCtr: number
  }
  shortsBreakdown: { count: number; totalViews: number; avgViews: number }
  longFormBreakdown: { count: number; totalViews: number; avgViews: number }
}

function formatNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export default function YouTubePage() {
  const [data, setData] = useState<YouTubeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<TimePeriod>('30d')
  const [isDark, setIsDark] = useState(false)
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsExpanded, setInsightsExpanded] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/youtube/data?period=${period}`)
        const json = await res.json()
        setData(json)
      } catch (error) {
        console.error('Failed to fetch YouTube data:', error)
      }
      setLoading(false)
    }
    fetchData()
  }, [period])

  async function fetchInsights() {
    setInsightsLoading(true)
    try {
      const res = await fetch('/api/youtube/insights')
      if (res.ok) {
        const json = await res.json()
        setInsights(json)
        setInsightsExpanded(true)
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    }
    setInsightsLoading(false)
  }

  const chartGridColor = isDark ? '#374151' : '#f0f0f0'
  const chartTickColor = isDark ? '#9ca3af' : '#666'
  const chartTooltipBg = isDark ? '#1f2937' : '#fff'
  const chartTooltipBorder = isDark ? '#374151' : '#e5e7eb'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading YouTube data...</p>
        </div>
      </div>
    )
  }

  if (!data?.connected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">YouTube Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect your YouTube channel to view metrics</p>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-white dark:bg-gray-900 p-12 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect YouTube</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Link your YouTube channel to track views, subscribers, watch time, CTR, and video performance.
            </p>
            <a
              href="/api/youtube/auth"
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              Connect YouTube Channel
            </a>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              Requires YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env.local
            </p>
          </div>
        </main>
      </div>
    )
  }

  const { dailyMetrics, videos, summary, shortsBreakdown, longFormBreakdown } = data
  const hasMetrics = dailyMetrics.length > 0
  const hasVideos = videos.length > 0

  // Chart data
  const chartData = dailyMetrics.map(d => ({
    date: d.date,
    views: d.views,
    watchHours: Math.round(d.estimated_minutes_watched / 60 * 10) / 10,
    ctr: Math.round(d.impressions_ctr * 100) / 100,
    netSubs: d.net_subscribers,
    impressions: d.impressions,
  }))

  // Shorts vs Long bar chart data
  const breakdownData = [
    { type: 'Shorts', count: shortsBreakdown.count, views: shortsBreakdown.totalViews, avgViews: shortsBreakdown.avgViews },
    { type: 'Long-form', count: longFormBreakdown.count, views: longFormBreakdown.totalViews, avgViews: longFormBreakdown.avgViews },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">YouTube Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{data.channelTitle}</p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-1">
              {(['7d', '14d', '30d'] as TimePeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    period === p
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 rounded-xl border bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/10 border-red-200 dark:border-red-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Views</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNum(summary.totalViews)}</p>
          </div>
          <div className="p-6 rounded-xl border bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/10 border-blue-200 dark:border-blue-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Watch Hours</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNum(summary.totalWatchHours)}</p>
          </div>
          <div className="p-6 rounded-xl border bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/10 border-emerald-200 dark:border-emerald-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Subscribers</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.netSubscribers >= 0 ? '+' : ''}{formatNum(summary.netSubscribers)}
            </p>
          </div>
          <div className="p-6 rounded-xl border bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/10 border-violet-200 dark:border-violet-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg CTR</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.avgCtr}%</p>
          </div>
        </div>

        {/* AI Strategic Insights */}
        {(hasMetrics || hasVideos) && (
          <section className="mb-8">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Strategic Direction</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">AI analysis of your channel data → RiffRoutine growth</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {insights && (
                    <button
                      onClick={() => setInsightsExpanded(!insightsExpanded)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className={`w-5 h-5 transition-transform ${insightsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={fetchInsights}
                    disabled={insightsLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {insightsLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Analyzing...
                      </>
                    ) : insights ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                        </svg>
                        Refresh
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                        </svg>
                        Generate Insights
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Insights content */}
              {insights && insightsExpanded && (
                <div className="px-6 pb-6 space-y-5">
                  {/* Headline + Analysis */}
                  <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{insights.insights.headline}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{insights.insights.analysis}</p>
                  </div>

                  {/* Action items */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Action Items</h4>
                    <div className="space-y-2">
                      {insights.insights.actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3">
                          <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            a.priority === 'high'
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          }`}>
                            {a.priority}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.action}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.rationale}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next content suggestions */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Next Video */}
                    <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                          <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
                        </svg>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Next Video</h4>
                        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          insights.insights.nextVideo.type === 'short'
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        }`}>
                          {insights.insights.nextVideo.type === 'short' ? 'Short' : 'Long-form'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">&ldquo;{insights.insights.nextVideo.title}&rdquo;</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2"><span className="font-medium">Hook:</span> {insights.insights.nextVideo.hook}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-medium">CTA:</span> {insights.insights.nextVideo.cta}</p>
                    </div>

                    {/* Next Blog Post */}
                    <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z" />
                        </svg>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Blog Post for RiffRoutine</h4>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">&ldquo;{insights.insights.nextBlogPost.title}&rdquo;</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2"><span className="font-medium">Target keyword:</span> {insights.insights.nextBlogPost.keyword}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-medium">Connection:</span> {insights.insights.nextBlogPost.connection}</p>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
                    Generated {format(new Date(insights.generatedAt), 'MMM d, yyyy h:mm a')} via DeepSeek
                  </p>
                </div>
              )}

              {/* Collapsed state with headline */}
              {insights && !insightsExpanded && (
                <div className="px-6 pb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{insights.insights.headline}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Charts */}
        {hasMetrics && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Views chart */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Views</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartTickColor }} tickFormatter={v => format(new Date(v), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} />
                  <Tooltip
                    labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
                    contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: isDark ? '#e5e7eb' : '#111827', fontWeight: 600 }}
                    itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#ef4444" strokeWidth={2.5} fill="url(#viewsGradient)" name="Views" dot={false} activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2, fill: isDark ? '#1f2937' : '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Watch hours chart */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Watch Hours</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="watchGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartTickColor }} tickFormatter={v => format(new Date(v), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} />
                  <Tooltip
                    labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
                    contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: isDark ? '#e5e7eb' : '#111827', fontWeight: 600 }}
                    itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                  />
                  <Area type="monotone" dataKey="watchHours" stroke="#3b82f6" strokeWidth={2.5} fill="url(#watchGradient)" name="Hours" dot={false} activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: isDark ? '#1f2937' : '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* CTR chart */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Impressions CTR (%)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartTickColor }} tickFormatter={v => format(new Date(v), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} />
                  <Tooltip
                    labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
                    contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: isDark ? '#e5e7eb' : '#111827', fontWeight: 600 }}
                    itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                    formatter={(value: unknown) => [`${value}%`, 'CTR']}
                  />
                  <Area type="monotone" dataKey="ctr" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#ctrGradient)" name="CTR %" dot={false} activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2, fill: isDark ? '#1f2937' : '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Net subscribers chart */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Net Subscribers</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartTickColor }} tickFormatter={v => format(new Date(v), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} />
                  <Tooltip
                    labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
                    contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: isDark ? '#e5e7eb' : '#111827', fontWeight: 600 }}
                    itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                  />
                  <Bar dataKey="netSubs" name="Net Subscribers" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`subs-${index}`} fill={entry.netSubs >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Shorts vs Long-form breakdown */}
        {hasVideos && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Shorts vs Long-form</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 p-6 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-200 dark:bg-orange-800/50 text-orange-800 dark:text-orange-200">
                    Shorts
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{shortsBreakdown.count} videos</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Views</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNum(shortsBreakdown.totalViews)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Views</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNum(shortsBreakdown.avgViews)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 p-6 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-200 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200">
                    Long-form
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{longFormBreakdown.count} videos</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Views</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNum(longFormBreakdown.totalViews)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Views</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNum(longFormBreakdown.avgViews)}</p>
                  </div>
                </div>
              </div>

              {/* Comparison bar chart */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-center">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Views Comparison</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={breakdownData} layout="vertical" barSize={28}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: chartTickColor }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 12, fill: chartTickColor, fontWeight: 500 }} width={70} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelStyle={{ color: isDark ? '#e5e7eb' : '#111827', fontWeight: 600 }}
                      itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                      formatter={(value: unknown) => [formatNum(value as number), 'Views']}
                    />
                    <Bar dataKey="views" name="Total Views" radius={[0, 6, 6, 0]}>
                      {breakdownData.map((_entry, index) => (
                        <Cell key={`breakdown-${index}`} fill={index === 0 ? '#f97316' : '#6366f1'} fillOpacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* Top Videos table */}
        {hasVideos && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Videos</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Video</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Views</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Watch Time</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Likes</th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {videos.slice(0, 25).map((v, i) => (
                      <tr key={v.video_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-5 text-right flex-shrink-0">{i + 1}</span>
                            {v.thumbnail_url && (
                              <a href={`https://youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                <img
                                  src={v.thumbnail_url}
                                  alt=""
                                  className="w-20 h-11 rounded-md object-cover shadow-sm hover:shadow-md hover:scale-105 transition-all"
                                />
                              </a>
                            )}
                            <div className="min-w-0">
                              <a
                                href={`https://youtube.com/watch?v=${v.video_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[300px] block hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              >
                                {v.title}
                              </a>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {v.published_at ? format(new Date(v.published_at), 'MMM d, yyyy') : ''} &middot; {formatDuration(v.duration_seconds)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{formatNum(v.views)}</td>
                        <td className="px-5 py-3.5 text-sm text-right text-gray-500 dark:text-gray-400 tabular-nums">
                          {v.estimated_minutes_watched > 0 ? `${Math.round(v.estimated_minutes_watched / 60 * 10) / 10}h` : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right text-gray-500 dark:text-gray-400 tabular-nums">{formatNum(v.likes)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            v.is_short
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {v.is_short ? 'Short' : 'Long'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {!hasMetrics && !hasVideos && (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-xl border border-gray-200 dark:border-gray-800 text-center mt-8">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No data yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Run <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">npx tsx scripts/test-ingestion.ts youtube</code> to fetch YouTube data.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
