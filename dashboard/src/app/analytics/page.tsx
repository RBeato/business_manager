'use client'

import { useEffect, useState } from 'react'
import { supabase, App, DailySearchConsole, DailyWebsiteTraffic, DailyUmamiStats } from '@/lib/supabase'
import { format, subDays } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

type TimePeriod = '7d' | '14d' | '30d'

const PERIOD_DAYS: Record<TimePeriod, number> = { '7d': 7, '14d': 14, '30d': 30 }

const WEBSITE_COLORS: Record<string, string> = {
  healthopenpage_website: '#10b981',
  meditnation_website: '#8b5cf6',
  riffroutine_website: '#f59e0b',
}

const WEBSITE_LABELS: Record<string, string> = {
  healthopenpage_website: 'Health Open Page',
  meditnation_website: 'MeditNation',
  riffroutine_website: 'RiffRoutine',
}

function formatNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function formatPos(n: number): string {
  return n.toFixed(1)
}

export default function AnalyticsPage() {
  const [apps, setApps] = useState<App[]>([])
  const [gscData, setGscData] = useState<DailySearchConsole[]>([])
  const [trafficData, setTrafficData] = useState<DailyWebsiteTraffic[]>([])
  const [umamiData, setUmamiData] = useState<DailyUmamiStats[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<TimePeriod>('7d')
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [isDark, setIsDark] = useState(false)

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
      const startDate = format(subDays(new Date(), PERIOD_DAYS[period]), 'yyyy-MM-dd')

      const [appsRes, gscRes, trafficRes, umamiRes] = await Promise.all([
        supabase.from('apps').select('*').eq('is_active', true),
        supabase.from('daily_search_console').select('*').gte('date', startDate).order('date'),
        supabase.from('daily_website_traffic').select('*').gte('date', startDate).order('date'),
        supabase.from('daily_umami_stats').select('*').gte('date', startDate).order('date'),
      ])

      if (appsRes.data) setApps(appsRes.data)
      if (gscRes.data) setGscData(gscRes.data)
      if (trafficRes.data) setTrafficData(trafficRes.data)
      if (umamiRes.data) setUmamiData(umamiRes.data)
      setLoading(false)
    }
    fetchData()
  }, [period])

  const webApps = apps.filter(a => a.type === 'web')
  const filteredApps = selectedSite === 'all' ? webApps : webApps.filter(a => a.slug === selectedSite)
  const filteredAppIds = new Set(filteredApps.map(a => a.id))

  // --- GSC aggregates (query=null, page=null rows) ---
  const gscAggregates = gscData.filter(r => r.query === null && r.page === null && filteredAppIds.has(r.app_id))
  const totalImpressions = gscAggregates.reduce((s, r) => s + Number(r.impressions || 0), 0)
  const totalClicks = gscAggregates.reduce((s, r) => s + Number(r.clicks || 0), 0)
  const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const avgPosition = gscAggregates.length > 0
    ? gscAggregates.reduce((s, r) => s + Number(r.position || 0), 0) / gscAggregates.length
    : 0

  // --- GSC top queries ---
  const topQueries = gscData
    .filter(r => r.query !== null && r.page === null && filteredAppIds.has(r.app_id))
    .reduce((acc, r) => {
      const key = r.query!
      const existing = acc.get(key)
      if (existing) {
        existing.impressions += Number(r.impressions || 0)
        existing.clicks += Number(r.clicks || 0)
        existing.posSum += Number(r.position || 0)
        existing.count++
      } else {
        acc.set(key, {
          query: key,
          impressions: Number(r.impressions || 0),
          clicks: Number(r.clicks || 0),
          posSum: Number(r.position || 0),
          count: 1,
        })
      }
      return acc
    }, new Map<string, { query: string; impressions: number; clicks: number; posSum: number; count: number }>())

  const topQueriesSorted = [...topQueries.values()]
    .map(q => ({ ...q, ctr: q.impressions > 0 ? q.clicks / q.impressions : 0, position: q.posSum / q.count }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)

  // --- GSC top pages ---
  const topPages = gscData
    .filter(r => r.page !== null && r.query === null && filteredAppIds.has(r.app_id))
    .reduce((acc, r) => {
      const key = r.page!
      const existing = acc.get(key)
      if (existing) {
        existing.impressions += Number(r.impressions || 0)
        existing.clicks += Number(r.clicks || 0)
        existing.posSum += Number(r.position || 0)
        existing.count++
      } else {
        acc.set(key, {
          page: key,
          impressions: Number(r.impressions || 0),
          clicks: Number(r.clicks || 0),
          posSum: Number(r.position || 0),
          count: 1,
        })
      }
      return acc
    }, new Map<string, { page: string; impressions: number; clicks: number; posSum: number; count: number }>())

  const topPagesSorted = [...topPages.values()]
    .map(p => ({ ...p, ctr: p.impressions > 0 ? p.clicks / p.impressions : 0, position: p.posSum / p.count }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)

  // --- GSC trend chart data (clicks + impressions by date) ---
  const gscByDate = gscAggregates.reduce((acc, r) => {
    const existing = acc.find(a => a.date === r.date)
    if (existing) {
      existing.clicks += Number(r.clicks || 0)
      existing.impressions += Number(r.impressions || 0)
    } else {
      acc.push({ date: r.date, clicks: Number(r.clicks || 0), impressions: Number(r.impressions || 0) })
    }
    return acc
  }, [] as { date: string; clicks: number; impressions: number }[]).sort((a, b) => a.date.localeCompare(b.date))

  // --- GA4 website traffic aggregates ---
  const filteredTraffic = trafficData.filter(r => filteredAppIds.has(r.app_id) && r.source === null)
  const totalSessions = filteredTraffic.reduce((s, r) => s + Number(r.sessions || 0), 0)
  const totalPageviews = filteredTraffic.reduce((s, r) => s + Number(r.pageviews || 0), 0)
  const totalUsers = filteredTraffic.reduce((s, r) => s + Number(r.users || 0), 0)
  const avgBounceRate = filteredTraffic.length > 0
    ? filteredTraffic.reduce((s, r) => s + Number(r.bounce_rate || 0), 0) / filteredTraffic.length
    : 0

  // --- GA4 traffic by date ---
  const trafficByDate = filteredTraffic.reduce((acc, r) => {
    const existing = acc.find(a => a.date === r.date)
    if (existing) {
      existing.sessions += Number(r.sessions || 0)
      existing.pageviews += Number(r.pageviews || 0)
      existing.users += Number(r.users || 0)
    } else {
      acc.push({
        date: r.date,
        sessions: Number(r.sessions || 0),
        pageviews: Number(r.pageviews || 0),
        users: Number(r.users || 0),
      })
    }
    return acc
  }, [] as { date: string; sessions: number; pageviews: number; users: number }[]).sort((a, b) => a.date.localeCompare(b.date))

  // --- GA4 traffic by source ---
  const trafficBySource = trafficData
    .filter(r => filteredAppIds.has(r.app_id) && r.source !== null)
    .reduce((acc, r) => {
      const key = `${r.source} / ${r.medium || '(none)'}`
      const existing = acc.get(key)
      if (existing) {
        existing.sessions += Number(r.sessions || 0)
        existing.users += Number(r.users || 0)
      } else {
        acc.set(key, {
          source: key,
          sessions: Number(r.sessions || 0),
          users: Number(r.users || 0),
        })
      }
      return acc
    }, new Map<string, { source: string; sessions: number; users: number }>())

  const topSourcesSorted = [...trafficBySource.values()]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10)

  // --- Umami data ---
  const filteredUmami = umamiData.filter(r => filteredAppIds.has(r.app_id))
  const totalUmamiVisitors = filteredUmami.reduce((s, r) => s + Number(r.visitors || 0), 0)
  const totalUmamiPageviews = filteredUmami.reduce((s, r) => s + Number(r.pageviews || 0), 0)
  const totalUmamiVisits = filteredUmami.reduce((s, r) => s + Number(r.visits || 0), 0)
  const avgUmamiBounce = filteredUmami.length > 0
    ? filteredUmami.reduce((s, r) => s + Number(r.bounce_rate || 0), 0) / filteredUmami.length
    : 0

  // Umami top pages (merge across days)
  const umamiTopPages = filteredUmami.reduce((acc, r) => {
    if (!r.top_pages) return acc
    for (const [page, count] of Object.entries(r.top_pages)) {
      acc.set(page, (acc.get(page) || 0) + count)
    }
    return acc
  }, new Map<string, number>())
  const umamiTopPagesSorted = [...umamiTopPages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Umami top referrers
  const umamiTopRefs = filteredUmami.reduce((acc, r) => {
    if (!r.top_referrers) return acc
    for (const [ref, count] of Object.entries(r.top_referrers)) {
      acc.set(ref, (acc.get(ref) || 0) + count)
    }
    return acc
  }, new Map<string, number>())
  const umamiTopRefsSorted = [...umamiTopRefs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const chartGridColor = isDark ? '#374151' : '#f0f0f0'
  const chartTickColor = isDark ? '#9ca3af' : '#666'
  const chartTooltipBg = isDark ? '#1f2937' : '#fff'
  const chartTooltipBorder = isDark ? '#374151' : '#e5e7eb'

  const hasGSCData = gscData.length > 0
  const hasTrafficData = trafficData.length > 0
  const hasUmamiData = umamiData.length > 0
  const hasAnyData = hasGSCData || hasTrafficData || hasUmamiData

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Website Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Search Console, GA4 Traffic & Umami</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Site filter */}
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Websites</option>
                {webApps.map(app => (
                  <option key={app.slug} value={app.slug}>
                    {WEBSITE_LABELS[app.slug] || app.name}
                  </option>
                ))}
              </select>
              {/* Period selector */}
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!hasAnyData && (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No analytics data yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Run <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">npm run ingest -- --sources=search-console --date=YYYY-MM-DD</code> with a date 3-5 days ago to pull Search Console data.
            </p>
          </div>
        )}

        {/* ==== SEARCH CONSOLE ==== */}
        {hasGSCData && (
          <>
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Google Search Console</h2>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-6 rounded-xl border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Impressions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalImpressions)}</p>
                </div>
                <div className="p-6 rounded-xl border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Clicks</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalClicks)}</p>
                </div>
                <div className="p-6 rounded-xl border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg CTR</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatPct(avgCTR)}</p>
                </div>
                <div className="p-6 rounded-xl border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Position</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatPos(avgPosition)}</p>
                </div>
              </div>

              {/* GSC trend chart */}
              {gscByDate.length > 0 && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-6">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Clicks & Impressions</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={gscByDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: chartTickColor }} tickFormatter={v => format(new Date(v), 'MMM d')} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: chartTickColor }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: chartTickColor }} />
                      <Tooltip
                        labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
                        contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px' }}
                        labelStyle={{ color: isDark ? '#e5e7eb' : '#111827' }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} name="Clicks" />
                      <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Impressions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* GSC tables: top queries + top pages */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Top Queries */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Queries</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Query</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clicks</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impr.</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CTR</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {topQueriesSorted.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No query data</td></tr>
                        ) : topQueriesSorted.map(q => (
                          <tr key={q.query} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-[200px] truncate">{q.query}</td>
                            <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatNum(q.clicks)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatNum(q.impressions)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatPct(q.ctr)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatPos(q.position)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Pages */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Pages</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Page</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clicks</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impr.</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CTR</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {topPagesSorted.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No page data</td></tr>
                        ) : topPagesSorted.map(p => (
                          <tr key={p.page} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={p.page}>{p.page}</td>
                            <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatNum(p.clicks)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatNum(p.impressions)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatPct(p.ctr)}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{formatPos(p.position)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ==== GA4 WEBSITE TRAFFIC ==== */}
        {hasTrafficData && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Website Traffic (GA4)</h2>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-6 rounded-xl border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalSessions)}</p>
              </div>
              <div className="p-6 rounded-xl border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalUsers)}</p>
              </div>
              <div className="p-6 rounded-xl border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pageviews</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalPageviews)}</p>
              </div>
              <div className="p-6 rounded-xl border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Bounce Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{avgBounceRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* Traffic trend */}
            {trafficByDate.length > 0 && (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Sessions & Users</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trafficByDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: chartTickColor }} tickFormatter={v => format(new Date(v), 'MMM d')} />
                    <YAxis tick={{ fontSize: 12, fill: chartTickColor }} />
                    <Tooltip
                      labelFormatter={l => format(new Date(l), 'MMM d, yyyy')}
                      contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: '8px' }}
                      labelStyle={{ color: isDark ? '#e5e7eb' : '#111827' }}
                    />
                    <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sessions" />
                    <Line type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} dot={false} name="Users" />
                    <Line type="monotone" dataKey="pageviews" stroke="#f59e0b" strokeWidth={2} dot={false} name="Pageviews" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Traffic sources table */}
            {topSourcesSorted.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Traffic Sources</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source / Medium</th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sessions</th>
                        <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Users</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {topSourcesSorted.map(s => (
                        <tr key={s.source} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{s.source}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{formatNum(s.sessions)}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{formatNum(s.users)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ==== UMAMI ==== */}
        {hasUmamiData && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Umami Analytics</h2>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-6 rounded-xl border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Visitors</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalUmamiVisitors)}</p>
              </div>
              <div className="p-6 rounded-xl border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pageviews</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalUmamiPageviews)}</p>
              </div>
              <div className="p-6 rounded-xl border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Visits</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatNum(totalUmamiVisits)}</p>
              </div>
              <div className="p-6 rounded-xl border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Bounce Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{avgUmamiBounce.toFixed(1)}%</p>
              </div>
            </div>

            {/* Umami breakdown tables */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Pages */}
              {umamiTopPagesSorted.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Pages</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Page</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Views</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {umamiTopPagesSorted.map(([page, count]) => (
                        <tr key={page} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 truncate max-w-[250px]">{page}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatNum(count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Top Referrers */}
              {umamiTopRefsSorted.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Referrers</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Referrer</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {umamiTopRefsSorted.map(([ref, count]) => (
                        <tr key={ref} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 truncate max-w-[250px]">{ref}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatNum(count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
