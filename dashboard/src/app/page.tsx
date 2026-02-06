'use client'

import { useEffect, useState } from 'react'
import { supabase, App, DailyRevenue, DailySubscription, DailyInstall, DailyProviderCost, Provider } from '@/lib/supabase'
import { format, subDays } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'

interface CreditStatus {
  service: string
  status: 'ok' | 'warning' | 'critical' | 'unknown' | 'error'
  remaining?: number
  limit?: number
  unit: string
  percentUsed?: number
  message: string
}

type Currency = 'USD' | 'EUR'
type TimePeriod = 'day' | 'week' | 'month'

const EXCHANGE_RATE_EUR = 0.92 // Approximate USD to EUR rate

const PERIOD_DAYS: Record<TimePeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  day: 'Today',
  week: '7 Days',
  month: '30 Days',
}

function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const convertedAmount = currency === 'EUR' ? amount * EXCHANGE_RATE_EUR : amount
  return new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-US', {
    style: 'currency',
    currency
  }).format(convertedAmount)
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function CreditStatusBanner({ credits }: { credits: CreditStatus[] }) {
  const alerts = credits.filter(c => c.status === 'warning' || c.status === 'critical')

  if (alerts.length === 0) return null

  return (
    <div className="mb-6">
      {alerts.map(alert => (
        <div
          key={alert.service}
          className={`mb-2 p-4 rounded-lg border flex items-center gap-3 ${
            alert.status === 'critical'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}
        >
          <span className="text-xl">{alert.status === 'critical' ? '🚨' : '⚠️'}</span>
          <div className="flex-1">
            <span className="font-semibold">{alert.service}</span>
            <span className="mx-2">—</span>
            <span>{alert.message}</span>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            alert.status === 'critical' ? 'bg-red-200' : 'bg-yellow-200'
          }`}>
            {alert.status.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  )
}

function CreditStatusCard({ credit }: { credit: CreditStatus }) {
  const statusColors: Record<string, string> = {
    ok: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
    unknown: 'bg-gray-100 text-gray-600 border-gray-200',
    error: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const statusIcons: Record<string, string> = {
    ok: '✓',
    warning: '⚠',
    critical: '✕',
    unknown: '?',
    error: '!',
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{credit.service}</span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${statusColors[credit.status]}`}>
          {statusIcons[credit.status]} {credit.status.toUpperCase()}
        </span>
      </div>
      <p className="text-sm text-gray-600">{credit.message}</p>
      {credit.percentUsed !== undefined && (
        <div className="mt-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                credit.percentUsed >= 95 ? 'bg-red-500' :
                credit.percentUsed >= 80 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(credit.percentUsed, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{credit.percentUsed.toFixed(1)}% used</p>
        </div>
      )}
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: { value: number; isPositive: boolean }
  color?: string
}

function MetricCard({ title, value, subtitle, trend, color = 'blue' }: MetricCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
  }

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]} transition-all hover:shadow-md`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      {trend && (
        <p className={`text-sm mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}% vs last period
        </p>
      )}
    </div>
  )
}

function TimePeriodSelector({ value, onChange }: { value: TimePeriod; onChange: (period: TimePeriod) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
      {(['day', 'week', 'month'] as TimePeriod[]).map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === period
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {period === 'day' ? 'Day' : period === 'week' ? 'Week' : 'Month'}
        </button>
      ))}
    </div>
  )
}

interface AppCardProps {
  app: App
  revenue: number
  installs: number
  mrr: number
  currency: Currency
  periodLabel: string
}

function AppCard({ app, revenue, installs, mrr, currency, periodLabel }: AppCardProps) {
  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {app.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{app.name}</h3>
          <div className="flex gap-2 mt-1">
            {app.platforms?.map((platform: string) => (
              <span key={platform} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500">Revenue ({periodLabel})</p>
          <p className="font-semibold text-gray-900">{formatCurrency(revenue, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Installs ({periodLabel})</p>
          <p className="font-semibold text-gray-900">{formatNumber(installs)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">MRR</p>
          <p className="font-semibold text-green-600">{formatCurrency(mrr, currency)}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([])
  const [revenue, setRevenue] = useState<DailyRevenue[]>([])
  const [subscriptions, setSubscriptions] = useState<DailySubscription[]>([])
  const [installs, setInstalls] = useState<DailyInstall[]>([])
  const [costs, setCosts] = useState<DailyProviderCost[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [credits, setCredits] = useState<CreditStatus[]>([])
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState<Currency>('EUR')
  const [period, setPeriod] = useState<TimePeriod>('week')

  // Fetch credit status
  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/credits')
        if (response.ok) {
          const data = await response.json()
          setCredits(data)
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      } finally {
        setCreditsLoading(false)
      }
    }
    fetchCredits()
  }, [])

  useEffect(() => {
    async function fetchData() {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

      const [
        appsResult,
        revenueResult,
        subscriptionsResult,
        installsResult,
        costsResult,
        providersResult,
      ] = await Promise.all([
        supabase.from('apps').select('*').eq('is_active', true),
        supabase.from('daily_revenue').select('*').gte('date', thirtyDaysAgo).order('date'),
        supabase.from('daily_subscriptions').select('*').gte('date', sevenDaysAgo).order('date'),
        supabase.from('daily_installs').select('*').gte('date', thirtyDaysAgo).order('date'),
        supabase.from('daily_provider_costs').select('*').gte('date', thirtyDaysAgo).order('date'),
        supabase.from('providers').select('*').eq('is_active', true),
      ])

      if (appsResult.data) setApps(appsResult.data)
      if (revenueResult.data) setRevenue(revenueResult.data)
      if (subscriptionsResult.data) setSubscriptions(subscriptionsResult.data)
      if (installsResult.data) setInstalls(installsResult.data)
      if (costsResult.data) setCosts(costsResult.data)
      if (providersResult.data) setProviders(providersResult.data)

      setLoading(false)
    }

    fetchData()
  }, [])

  // Calculate date cutoffs based on selected period
  const periodDays = PERIOD_DAYS[period]
  const periodCutoff = format(subDays(new Date(), periodDays), 'yyyy-MM-dd')
  const periodLabel = PERIOD_LABELS[period]

  // Calculate totals for selected period
  const totalRevenuePeriod = revenue
    .filter(r => r.date >= periodCutoff)
    .reduce((sum, r) => sum + Number(r.gross_revenue || 0), 0)

  // Keep 30d for financial summary
  const totalRevenue30d = revenue.reduce((sum, r) => sum + Number(r.gross_revenue || 0), 0)

  const currentMRR = subscriptions.length > 0
    ? subscriptions
        .filter(s => s.date === subscriptions[subscriptions.length - 1]?.date)
        .reduce((sum, s) => sum + Number(s.mrr || 0), 0)
    : 0

  const totalInstallsPeriod = installs
    .filter(i => i.date >= periodCutoff)
    .reduce((sum, i) => sum + Number(i.installs || 0), 0)

  const totalCostsPeriod = costs
    .filter(c => c.date >= periodCutoff)
    .reduce((sum, c) => sum + Number(c.cost || 0), 0)

  const totalCosts30d = costs.reduce((sum, c) => sum + Number(c.cost || 0), 0)

  const activeSubscriptions = subscriptions.length > 0
    ? subscriptions
        .filter(s => s.date === subscriptions[subscriptions.length - 1]?.date)
        .reduce((sum, s) => sum + Number(s.active_subscriptions || 0), 0)
    : 0

  const newSubscriptionsPeriod = subscriptions
    .filter(s => s.date >= periodCutoff)
    .reduce((sum, s) => sum + Number(s.new_subscriptions || 0), 0)

  const activeTrialsPeriod = subscriptions.length > 0
    ? subscriptions
        .filter(s => s.date === subscriptions[subscriptions.length - 1]?.date)
        .reduce((sum, s) => sum + Number(s.active_trials || 0), 0)
    : 0

  // Prepare chart data (filtered by selected period)
  const revenueByDate = revenue
    .filter(r => r.date >= periodCutoff)
    .reduce((acc, r) => {
      const existing = acc.find(a => a.date === r.date)
      if (existing) {
        existing.revenue += Number(r.gross_revenue || 0)
      } else {
        acc.push({ date: r.date, revenue: Number(r.gross_revenue || 0) })
      }
      return acc
    }, [] as { date: string; revenue: number }[])

  const costsByProvider = providers.map(provider => ({
    name: provider.name,
    cost: costs
      .filter(c => c.provider_id === provider.id && c.date >= periodCutoff)
      .reduce((sum, c) => sum + Number(c.cost || 0), 0)
  })).filter(p => p.cost > 0)

  // Calculate per-app metrics for selected period
  const appMetrics = apps.map(app => {
    const appRevenue = revenue
      .filter(r => r.app_id === app.id && r.date >= periodCutoff)
      .reduce((sum, r) => sum + Number(r.gross_revenue || 0), 0)

    const appInstalls = installs
      .filter(i => i.app_id === app.id && i.date >= periodCutoff)
      .reduce((sum, i) => sum + Number(i.installs || 0), 0)

    const appMRR = subscriptions
      .filter(s => s.app_id === app.id && s.date === subscriptions[subscriptions.length - 1]?.date)
      .reduce((sum, s) => sum + Number(s.mrr || 0), 0)

    return { app, revenue: appRevenue, installs: appInstalls, mrr: appMRR }
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Business Metrics Hub</h1>
              <p className="text-sm text-gray-500">Portfolio Overview</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Time Period Selector */}
              <TimePeriodSelector value={period} onChange={setPeriod} />
              {/* Currency Selector */}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
              <div className="text-sm text-gray-500">
                Last updated: {format(new Date(), 'MMM d, yyyy h:mm a')}
              </div>
            </div>
          </div>

          {/* Financial Summary Bar - Portugal <€1M Revenue */}
          {(() => {
            // Portugal tax assumptions for indie developer < €1M revenue
            const STORE_FEE = 0.15        // 15% - Apple/Google Small Business Program
            const IRS_RATE = 0.25         // ~25% effective IRS on taxable income
            const TAXABLE_PORTION = 0.75  // Regime simplificado: 75% of income taxable
            const SS_RATE = 0.214         // 21.4% Segurança Social
            const SS_BASE = 0.70          // SS applies to 70% of income

            const netRevenue = totalRevenue30d * (1 - STORE_FEE)
            const grossProfit = netRevenue - totalCosts30d
            const taxableIncome = grossProfit * TAXABLE_PORTION
            const irsAmount = Math.max(0, taxableIncome * IRS_RATE)
            const ssAmount = Math.max(0, grossProfit * SS_BASE * SS_RATE)
            const totalTax = irsAmount + ssAmount
            const effectiveTaxRate = grossProfit > 0 ? (totalTax / grossProfit * 100) : 0
            const netProfit = grossProfit - totalTax

            return (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Gross Revenue */}
                  <div className="text-center md:text-left">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Gross Revenue</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue30d, currency)}</p>
                  </div>

                  {/* Net Revenue (after store fees 15%) */}
                  <div className="text-center md:text-left">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">After Store Fees</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(netRevenue, currency)}</p>
                    <p className="text-xs text-gray-400">-15% store fee</p>
                  </div>

                  {/* Total Expenses */}
                  <div className="text-center md:text-left">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
                    <p className="text-lg font-bold text-red-600">-{formatCurrency(totalCosts30d, currency)}</p>
                    <p className="text-xs text-gray-400">AI, infra, etc.</p>
                  </div>

                  {/* Gross Profit (before tax) */}
                  <div className="text-center md:text-left">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Gross Profit</p>
                    <p className={`text-lg font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(grossProfit, currency)}
                    </p>
                    <p className="text-xs text-gray-400">before tax</p>
                  </div>

                  {/* Tax (IRS + SS) */}
                  <div className="text-center md:text-left">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Tax (IRS + SS)</p>
                    <p className="text-lg font-bold text-orange-600">
                      -{formatCurrency(totalTax, currency)}
                    </p>
                    <p className="text-xs text-gray-400">~{effectiveTaxRate.toFixed(0)}% effective</p>
                  </div>

                  {/* Net Profit After Tax */}
                  <div className="text-center md:text-left bg-gradient-to-r from-green-50 to-emerald-50 -mx-2 px-3 py-2 rounded-lg border border-green-100">
                    <p className="text-xs text-green-700 uppercase tracking-wide font-medium">Net Profit</p>
                    <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(netProfit, currency)}
                    </p>
                    <p className="text-xs text-green-600">take home</p>
                  </div>
                </div>

                {/* Tax Breakdown */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Portugal (Regime Simplificado):</span>
                  <span>Store: 15%</span>
                  <span className="text-gray-300">|</span>
                  <span>IRS: ~25% on 75%</span>
                  <span className="text-gray-300">|</span>
                  <span>SS: 21.4% on 70%</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-400">Last 30 days</span>
                </div>
              </div>
            )
          })()}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Credit Alerts Banner */}
        {!creditsLoading && <CreditStatusBanner credits={credits} />}

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics ({periodLabel})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <MetricCard title={`Revenue`} value={formatCurrency(totalRevenuePeriod, currency)} subtitle={periodLabel} color="green" />
            <MetricCard title="MRR" value={formatCurrency(currentMRR, currency)} subtitle="Monthly recurring" color="blue" />
            <MetricCard title="Active Subs" value={formatNumber(activeSubscriptions)} subtitle="Current" color="purple" />
            <MetricCard title="Active Trials" value={formatNumber(activeTrialsPeriod)} subtitle="Current" color="purple" />
            <MetricCard title="New Subs" value={formatNumber(newSubscriptionsPeriod)} subtitle={periodLabel} color="blue" />
            <MetricCard title={`Installs`} value={formatNumber(totalInstallsPeriod)} subtitle={periodLabel} color="orange" />
            <MetricCard title={`Costs`} value={formatCurrency(totalCostsPeriod, currency)} subtitle={periodLabel} color="red" />
            <MetricCard
              title="Net Margin"
              value={totalRevenuePeriod > 0 ? `${((totalRevenuePeriod - totalCostsPeriod) / totalRevenuePeriod * 100).toFixed(0)}%` : '—'}
              subtitle={periodLabel}
              color={totalRevenuePeriod > totalCostsPeriod ? 'green' : 'red'}
            />
          </div>
        </section>

        {/* Charts */}
        <section className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend ({periodLabel})</h3>
            {revenueByDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueByDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => format(new Date(v), 'MMM d')}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => currency === 'EUR' ? `€${(v * 0.92).toFixed(0)}` : `$${v}`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0, currency)}
                    labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                No revenue data available
              </div>
            )}
          </div>

          {/* Costs by Provider */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Costs by Provider ({periodLabel})</h3>
            {costsByProvider.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={costsByProvider} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(v) => currency === 'EUR' ? `€${(v * 0.92).toFixed(0)}` : `$${v}`} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0, currency)} />
                  <Bar dataKey="cost" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                No cost data available
              </div>
            )}
          </div>
        </section>

        {/* Apps */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Apps ({apps.length})</h2>
          {apps.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appMetrics.map(({ app, revenue, installs, mrr }) => (
                <AppCard key={app.id} app={app} revenue={revenue} installs={installs} mrr={mrr} currency={currency} periodLabel={periodLabel} />
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
              <p className="text-gray-500">No apps registered yet.</p>
              <p className="text-sm text-gray-400 mt-2">Run the ingestion pipeline to populate data.</p>
            </div>
          )}
        </section>

        {/* Providers */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Providers</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost ({periodLabel})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providers.map(provider => {
                  const providerCost = costs
                    .filter(c => c.provider_id === provider.id && c.date >= periodCutoff)
                    .reduce((sum, c) => sum + Number(c.cost || 0), 0)
                  return (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{provider.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                          {provider.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {providerCost > 0 ? formatCurrency(providerCost, currency) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* API Credits Status */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">API Credits & Quotas</h2>
          {creditsLoading ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-3 text-gray-500">Checking API credits...</p>
            </div>
          ) : credits.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credits.map(credit => (
                <CreditStatusCard key={credit.service} credit={credit} />
              ))}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500">
              No API services configured
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
