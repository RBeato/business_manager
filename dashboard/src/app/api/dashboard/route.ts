import { NextResponse } from 'next/server'
import { getDb, parseJson } from '@/lib/db'
import { format, subDays } from 'date-fns'

export async function GET() {
  const db = getDb()
  const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  const rawApps = db.prepare("SELECT * FROM apps WHERE is_active = 1 ORDER BY slug").all() as Record<string, unknown>[]
  const apps = rawApps.map(a => ({
    ...a,
    platforms: parseJson<string[]>(a.platforms) || [],
    is_active: Boolean(a.is_active),
  }))

  const rawProviders = db.prepare("SELECT * FROM providers WHERE is_active = 1 ORDER BY slug").all() as Record<string, unknown>[]
  const providers = rawProviders.map(p => ({
    ...p,
    is_active: Boolean(p.is_active),
  }))

  const revenue = db.prepare("SELECT * FROM daily_revenue WHERE date >= ? ORDER BY date").all(thirtyDaysAgo)
  const subscriptions = db.prepare("SELECT * FROM daily_subscriptions WHERE date >= ? ORDER BY date").all(thirtyDaysAgo)
  const installs = db.prepare("SELECT * FROM daily_installs WHERE date >= ? ORDER BY date").all(thirtyDaysAgo)
  const costs = db.prepare("SELECT * FROM daily_provider_costs WHERE date >= ? ORDER BY date").all(thirtyDaysAgo)

  return NextResponse.json({ apps, providers, revenue, subscriptions, installs, costs })
}
