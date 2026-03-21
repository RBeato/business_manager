import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const token = db.prepare('SELECT channel_id, channel_title FROM youtube_oauth_tokens LIMIT 1').get() as
    | { channel_id: string; channel_title: string }
    | undefined

  if (!token) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    channelId: token.channel_id,
    channelTitle: token.channel_title,
  })
}
