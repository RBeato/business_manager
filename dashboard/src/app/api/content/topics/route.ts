import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const status = searchParams.get('status')

  let query = supabase
    .from('blog_topics')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

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
