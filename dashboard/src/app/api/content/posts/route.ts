import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('blog_posts')
    .select('id, website, title, slug, meta_description, target_keyword, seo_score, status, word_count, reading_time_minutes, review_notes, created_at, updated_at, published_date')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (website) {
    query = query.eq('website', website)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
