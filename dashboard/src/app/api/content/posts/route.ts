import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')

  const db = getDb()
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (website) { conditions.push('website = ?'); params.push(website) }
  if (status) { conditions.push('status = ?'); params.push(status) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(
    `SELECT id, website, title, slug, meta_description, target_keyword, seo_score, status, word_count, reading_time_minutes, review_notes, image_url, created_at, updated_at, published_date FROM blog_posts ${where} ORDER BY created_at DESC LIMIT ?`
  ).all(...params, limit)

  return NextResponse.json(rows)
}
