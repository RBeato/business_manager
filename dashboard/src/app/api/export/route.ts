import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

interface AppRow {
  id: string
  slug: string
  name: string
  type: string
  platforms: string[]
  is_active: boolean
}

interface ProviderRow {
  id: string
  slug: string
  name: string
  category: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // Fetch reference data and all metrics in parallel
  const [
    appsRes,
    providersRes,
    revenueRes,
    subscriptionsRes,
    installsRes,
    costsRes,
    searchConsoleRes,
    websiteTrafficRes,
    umamiRes,
    emailRes,
  ] = await Promise.all([
    supabase.from('apps').select('*'),
    supabase.from('providers').select('*'),
    supabase.from('daily_revenue').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_subscriptions').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_installs').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_provider_costs').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_search_console').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_website_traffic').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_umami_stats').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('daily_email_metrics').select('*').gte('date', startDate).lte('date', endDate).order('date'),
  ])

  // Build lookup maps
  const apps: AppRow[] = appsRes.data || []
  const providers: ProviderRow[] = providersRes.data || []
  const appMap = new Map(apps.map(a => [a.id, a.name]))
  const providerMap = new Map(providers.map(p => [p.id, p.name]))

  const revenue = revenueRes.data || []
  const subscriptions = subscriptionsRes.data || []
  const installs = installsRes.data || []
  const costs = costsRes.data || []
  const searchConsole = searchConsoleRes.data || []
  const websiteTraffic = websiteTrafficRes.data || []
  const umami = umamiRes.data || []
  const email = emailRes.data || []

  // ---- Build workbook ----
  const wb = XLSX.utils.book_new()

  // 1. Summary sheet
  const totalGrossRevenue = revenue.reduce((sum, r) => sum + Number(r.gross_revenue || 0), 0)
  const totalNetRevenue = revenue.reduce((sum, r) => sum + Number(r.net_revenue || 0), 0)
  const latestMRR = subscriptions.length > 0
    ? subscriptions
        .filter(s => s.date === subscriptions[subscriptions.length - 1].date)
        .reduce((sum, s) => sum + Number(s.mrr || 0), 0)
    : 0
  const totalCosts = costs.reduce((sum, r) => sum + Number(r.cost || 0), 0)
  const totalProfit = totalNetRevenue - totalCosts
  const totalInstalls = installs.reduce((sum, r) => sum + Number(r.installs || 0), 0)
  const totalActiveSubs = subscriptions.length > 0
    ? subscriptions
        .filter(s => s.date === subscriptions[subscriptions.length - 1].date)
        .reduce((sum, s) => sum + Number(s.active_subscriptions || 0), 0)
    : 0
  const totalImpressions = searchConsole.reduce((sum, r) => sum + Number(r.impressions || 0), 0)
  const totalClicks = searchConsole.reduce((sum, r) => sum + Number(r.clicks || 0), 0)
  const totalPageviews = websiteTraffic.reduce((sum, r) => sum + Number(r.pageviews || 0), 0)
  const totalUmamiVisitors = umami.reduce((sum, r) => sum + Number(r.visitors || 0), 0)

  const summaryData = [
    ['Business Metrics Summary'],
    ['Period', `${startDate} to ${endDate}`],
    ['Generated', new Date().toISOString()],
    [],
    ['Key Performance Indicators'],
    ['Metric', 'Value'],
    ['Total Gross Revenue', totalGrossRevenue],
    ['Total Net Revenue', totalNetRevenue],
    ['Latest MRR', latestMRR],
    ['Total Provider Costs', totalCosts],
    ['Net Profit (Revenue - Costs)', totalProfit],
    ['Total Installs', totalInstalls],
    ['Active Subscriptions (latest)', totalActiveSubs],
    [],
    ['Website Metrics'],
    ['Search Console Impressions', totalImpressions],
    ['Search Console Clicks', totalClicks],
    ['GA4 Pageviews', totalPageviews],
    ['Umami Visitors', totalUmamiVisitors],
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  // Set column widths for readability
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // 2. Revenue sheet
  const revenueRows = revenue.map(r => ({
    Date: r.date,
    App: appMap.get(r.app_id) || r.app_id,
    Platform: r.platform,
    'Gross Revenue': Number(r.gross_revenue || 0),
    'Net Revenue': Number(r.net_revenue || 0),
    'Subscription Revenue': Number(r.subscription_revenue || 0),
    Transactions: Number(r.transaction_count || 0),
  }))
  const revenueSheet = XLSX.utils.json_to_sheet(revenueRows)
  revenueSheet['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, revenueSheet, 'Revenue')

  // 3. Subscriptions sheet
  const subscriptionRows = subscriptions.map(r => ({
    Date: r.date,
    App: appMap.get(r.app_id) || r.app_id,
    Platform: r.platform,
    'Active Subscriptions': Number(r.active_subscriptions || 0),
    'Active Trials': Number(r.active_trials || 0),
    'New Trials': Number(r.new_trials || 0),
    'Trial Conversions': Number(r.trial_conversions || 0),
    'New Subscriptions': Number(r.new_subscriptions || 0),
    Cancellations: Number(r.cancellations || 0),
    MRR: Number(r.mrr || 0),
  }))
  const subscriptionSheet = XLSX.utils.json_to_sheet(subscriptionRows)
  subscriptionSheet['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 20 },
    { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, subscriptionSheet, 'Subscriptions')

  // 4. Installs sheet
  const installRows = installs.map(r => ({
    Date: r.date,
    App: appMap.get(r.app_id) || r.app_id,
    Platform: r.platform,
    Installs: Number(r.installs || 0),
    Uninstalls: Number(r.uninstalls || 0),
    'Product Page Views': Number(r.product_page_views || 0),
  }))
  const installSheet = XLSX.utils.json_to_sheet(installRows)
  installSheet['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, installSheet, 'Installs')

  // 5. Costs sheet
  const costRows = costs.map(r => ({
    Date: r.date,
    Provider: providerMap.get(r.provider_id) || r.provider_id,
    App: r.app_id ? (appMap.get(r.app_id) || r.app_id) : 'N/A',
    Cost: Number(r.cost || 0),
    'Usage Quantity': Number(r.usage_quantity || 0),
    'Usage Unit': r.usage_unit || '',
  }))
  const costSheet = XLSX.utils.json_to_sheet(costRows)
  costSheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, costSheet, 'Costs')

  // 6. Search Console sheet
  const gscRows = searchConsole.map(r => ({
    Date: r.date,
    App: appMap.get(r.app_id) || r.app_id,
    Query: r.query || '',
    Page: r.page || '',
    Impressions: Number(r.impressions || 0),
    Clicks: Number(r.clicks || 0),
    CTR: Number(r.ctr || 0),
    Position: Number(r.position || 0),
  }))
  const gscSheet = XLSX.utils.json_to_sheet(gscRows)
  gscSheet['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 40 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, gscSheet, 'Search Console')

  // 7. Website Traffic sheet
  const trafficRows = websiteTraffic.map(r => ({
    Date: r.date,
    App: appMap.get(r.app_id) || r.app_id,
    Source: r.source || '',
    Medium: r.medium || '',
    Sessions: Number(r.sessions || 0),
    Users: Number(r.users || 0),
    'New Users': Number(r.new_users || 0),
    Pageviews: Number(r.pageviews || 0),
    'Avg Session Duration (s)': Number(r.avg_session_duration_seconds || 0),
    'Bounce Rate': Number(r.bounce_rate || 0),
    'Pages/Session': Number(r.pages_per_session || 0),
    Signups: Number(r.signups || 0),
    'App Downloads': Number(r.app_downloads || 0),
    Purchases: Number(r.purchases || 0),
  }))
  const trafficSheet = XLSX.utils.json_to_sheet(trafficRows)
  trafficSheet['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 18 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 16 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, trafficSheet, 'Website Traffic')

  // 8. Umami sheet
  const umamiRows = umami.map(r => ({
    Date: r.date,
    App: appMap.get(r.app_id) || r.app_id,
    'Website ID': r.website_id || '',
    Pageviews: Number(r.pageviews || 0),
    Visitors: Number(r.visitors || 0),
    Visits: Number(r.visits || 0),
    'Bounce Rate': Number(r.bounce_rate || 0),
    'Avg Visit Duration': Number(r.avg_visit_duration || 0),
    'Top Pages': r.top_pages ? JSON.stringify(r.top_pages) : '',
    'Top Referrers': r.top_referrers ? JSON.stringify(r.top_referrers) : '',
    'Top Countries': r.top_countries ? JSON.stringify(r.top_countries) : '',
    'Top Browsers': r.top_browsers ? JSON.stringify(r.top_browsers) : '',
  }))
  const umamiSheet = XLSX.utils.json_to_sheet(umamiRows)
  umamiSheet['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 18 },
    { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, umamiSheet, 'Umami')

  // 9. Email sheet
  const emailRows = email.map((r: Record<string, unknown>) => ({
    Date: r.date,
    'Emails Sent': Number(r.emails_sent || 0),
    'Emails Delivered': Number(r.emails_delivered || 0),
    'Emails Opened': Number(r.emails_opened || 0),
    'Emails Clicked': Number(r.emails_clicked || 0),
    'Bounces': Number(r.bounces || 0),
    'Spam Reports': Number(r.spam_reports || 0),
    'Unsubscribes': Number(r.unsubscribes || 0),
    'Open Rate': Number(r.open_rate || 0),
    'Click Rate': Number(r.click_rate || 0),
    'Campaign': r.campaign_name || '',
  }))
  const emailSheet = XLSX.utils.json_to_sheet(emailRows)
  emailSheet['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 25 },
  ]
  XLSX.utils.book_append_sheet(wb, emailSheet, 'Email')

  const fmt = searchParams.get('format') || 'xlsx'

  if (fmt === 'csv') {
    // Generate a ZIP of CSVs, one per sheet
    const csvFiles: { name: string; data: Buffer }[] = []
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])
      csvFiles.push({
        name: `${sheetName.toLowerCase().replace(/\s+/g, '-')}.csv`,
        data: Buffer.from(csv, 'utf-8'),
      })
    }

    const zipBuf = buildZip(csvFiles)
    const filename = `business-metrics_${startDate}_${endDate}.zip`

    return new NextResponse(new Uint8Array(zipBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // Default: XLSX
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `business-metrics_${startDate}_${endDate}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/** Minimal ZIP file builder — no external dependencies */
function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const localHeaders: Buffer[] = []
  const centralEntries: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf-8')
    const crc = crc32(file.data)

    // Local file header (30 + nameLen + dataLen)
    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)   // signature
    local.writeUInt16LE(20, 4)           // version needed
    local.writeUInt16LE(0, 6)            // flags
    local.writeUInt16LE(0, 8)            // compression: stored
    local.writeUInt16LE(0, 10)           // mod time
    local.writeUInt16LE(0, 12)           // mod date
    local.writeUInt32LE(crc, 14)         // crc-32
    local.writeUInt32LE(file.data.length, 18) // compressed size
    local.writeUInt32LE(file.data.length, 22) // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26) // filename length
    local.writeUInt16LE(0, 28)           // extra field length
    nameBytes.copy(local, 30)

    localHeaders.push(local, file.data)

    // Central directory entry (46 + nameLen)
    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0) // signature
    central.writeUInt16LE(20, 4)         // version made by
    central.writeUInt16LE(20, 6)         // version needed
    central.writeUInt16LE(0, 8)          // flags
    central.writeUInt16LE(0, 10)         // compression: stored
    central.writeUInt16LE(0, 12)         // mod time
    central.writeUInt16LE(0, 14)         // mod date
    central.writeUInt32LE(crc, 16)       // crc-32
    central.writeUInt32LE(file.data.length, 20) // compressed size
    central.writeUInt32LE(file.data.length, 24) // uncompressed size
    central.writeUInt16LE(nameBytes.length, 28) // filename length
    central.writeUInt16LE(0, 30)         // extra field length
    central.writeUInt16LE(0, 32)         // file comment length
    central.writeUInt16LE(0, 34)         // disk number start
    central.writeUInt16LE(0, 36)         // internal file attributes
    central.writeUInt32LE(0, 38)         // external file attributes
    central.writeUInt32LE(offset, 42)    // relative offset of local header
    nameBytes.copy(central, 46)

    centralEntries.push(central)
    offset += local.length + file.data.length
  }

  const centralDir = Buffer.concat(centralEntries)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)         // signature
  eocd.writeUInt16LE(0, 4)                  // disk number
  eocd.writeUInt16LE(0, 6)                  // disk with central dir
  eocd.writeUInt16LE(files.length, 8)       // entries on this disk
  eocd.writeUInt16LE(files.length, 10)      // total entries
  eocd.writeUInt32LE(centralDir.length, 12) // central dir size
  eocd.writeUInt32LE(offset, 16)            // central dir offset
  eocd.writeUInt16LE(0, 20)                 // comment length

  return Buffer.concat([...localHeaders, centralDir, eocd])
}

/** CRC-32 implementation */
function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
