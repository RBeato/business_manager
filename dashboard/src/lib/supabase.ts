import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface App {
  id: string
  slug: string
  name: string
  type: 'mobile' | 'web' | 'desktop' | 'api'
  platforms: string[]
  icon_url?: string
  is_active: boolean
}

export interface DailyRevenue {
  id: string
  app_id: string
  date: string
  platform: string
  gross_revenue: number
  net_revenue: number
  subscription_revenue: number
  transaction_count: number
}

export interface DailySubscription {
  id: string
  app_id: string
  date: string
  platform: string
  active_subscriptions: number
  active_trials: number
  new_trials: number
  trial_conversions: number
  new_subscriptions?: number
  cancellations: number
  mrr: number
}

export interface DailyInstall {
  id: string
  app_id: string
  date: string
  platform: string
  installs: number
  uninstalls: number
  product_page_views: number
}

export interface DailyProviderCost {
  id: string
  provider_id: string
  app_id?: string
  date: string
  cost: number
  usage_quantity: number
  usage_unit?: string
}

export interface Provider {
  id: string
  slug: string
  name: string
  category: string
}
