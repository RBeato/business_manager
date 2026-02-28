import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const status = searchParams.get('status')

  const db = getDb()
  const conditions: string[] = []
  const params: string[] = []

  if (website) { conditions.push('website = ?'); params.push(website) }
  if (status) { conditions.push('status = ?'); params.push(status) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(
    `SELECT * FROM blog_topics ${where} ORDER BY priority DESC, created_at ASC`
  ).all(...params)

  return NextResponse.json(rows)
}
