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

// Analytics types
export interface DailySearchConsole {
  id: string
  app_id: string
  date: string
  query: string | null
  page: string | null
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export interface DailyWebsiteTraffic {
  id: string
  app_id: string
  date: string
  source: string | null
  medium: string | null
  sessions: number
  users: number
  new_users: number
  pageviews: number
  avg_session_duration_seconds: number
  bounce_rate: number
  pages_per_session: number
  signups: number
  app_downloads: number
  purchases: number
}

export interface DailyUmamiStats {
  id: string
  app_id: string
  date: string
  website_id: string
  pageviews: number
  visitors: number
  visits: number
  bounce_rate: number
  avg_visit_duration: number
  top_pages: Record<string, number> | null
  top_referrers: Record<string, number> | null
  top_countries: Record<string, number> | null
  top_browsers: Record<string, number> | null
}

// Content Engine types
export interface BlogPost {
  id: string
  website: 'healthopenpage' | 'meditnation' | 'riffroutine'
  title: string
  slug: string
  content: string
  meta_description: string | null
  keywords: string[] | null
  target_keyword: string | null
  seo_score: number | null
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected'
  scheduled_publish_date: string | null
  published_date: string | null
  ai_model: string | null
  generation_prompt: string | null
  review_notes: string | null
  image_url: string | null
  word_count: number | null
  reading_time_minutes: number | null
  created_at: string
  updated_at: string
}

export interface BlogTopic {
  id: string
  website: 'healthopenpage' | 'meditnation' | 'riffroutine'
  topic: string
  target_keyword: string | null
  search_volume: number | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  priority: number
  status: 'queued' | 'generated' | 'published' | 'skipped'
  notes: string | null
  category: string | null
  related_blog_post_id: string | null
  created_at: string
  updated_at: string
}

export interface ContentCalendar {
  id: string
  website: 'healthopenpage' | 'meditnation' | 'riffroutine'
  posts_per_week: number
  preferred_publish_days: string[]
  preferred_publish_time: string
  active: boolean
  created_at: string
  updated_at: string
}
