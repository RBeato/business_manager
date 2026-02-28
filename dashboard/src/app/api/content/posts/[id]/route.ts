import { NextRequest, NextResponse } from 'next/server'
import { getDb, parseJson } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const row = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  row.keywords = parseJson(row.keywords)
  return NextResponse.json(row)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { status, review_notes } = body

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json(
      { error: 'Status must be "approved" or "rejected"' },
      { status: 400 }
    )
  }

  const db = getDb()
  db.prepare('UPDATE blog_posts SET status = ?, review_notes = ?, updated_at = ? WHERE id = ?')
    .run(status, review_notes || null, new Date().toISOString(), id)

  if (status === 'rejected') {
    db.prepare("UPDATE blog_topics SET status = 'queued', related_blog_post_id = NULL WHERE related_blog_post_id = ?")
      .run(id)
  }

  const updated = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (updated) updated.keywords = parseJson(updated.keywords)

  return NextResponse.json(updated)
}
