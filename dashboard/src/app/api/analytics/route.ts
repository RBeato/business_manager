import { NextRequest, NextResponse } from 'next/server'
import { getDb, parseJson } from '@/lib/db'
import { format, subDays } from 'date-fns'

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30 }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '7d'
  const days = PERIOD_DAYS[period] || 7

  const db = getDb()
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

  const rawApps = db.prepare("SELECT * FROM apps WHERE is_active = 1 ORDER BY slug").all() as Record<string, unknown>[]
  const apps = rawApps.map(a => ({
    ...a,
    platforms: parseJson<string[]>(a.platforms) || [],
    is_active: Boolean(a.is_active),
  }))

  const gscData = db.prepare("SELECT * FROM daily_search_console WHERE date >= ? ORDER BY date").all(startDate)
  const trafficData = db.prepare("SELECT * FROM daily_website_traffic WHERE date >= ? ORDER BY date").all(startDate)

  const rawUmami = db.prepare("SELECT * FROM daily_umami_stats WHERE date >= ? ORDER BY date").all(startDate) as Record<string, unknown>[]
  const umamiData = rawUmami.map(r => ({
    ...r,
    top_pages: parseJson<Record<string, number>>(r.top_pages),
    top_referrers: parseJson<Record<string, number>>(r.top_referrers),
    top_countries: parseJson<Record<string, number>>(r.top_countries),
    top_browsers: parseJson<Record<string, number>>(r.top_browsers),
  }))

  return NextResponse.json({ apps, gscData, trafficData, umamiData })
}
