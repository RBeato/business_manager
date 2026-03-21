import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/youtube?error=' + encodeURIComponent(error), url.origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/youtube?error=no_code', url.origin))
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/youtube?error=not_configured', url.origin))
  }

  const port = process.env.PORT || '3002'
  const redirectUri = `http://localhost:${port}/api/youtube/callback`

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelResponse = await youtube.channels.list({
      mine: true,
      part: ['snippet'],
    })

    const channel = channelResponse.data.items?.[0]
    if (!channel) {
      return NextResponse.redirect(new URL('/youtube?error=no_channel', url.origin))
    }

    const channelId = channel.id!
    const channelTitle = channel.snippet?.title || 'Unknown Channel'

    // Store tokens in SQLite
    const db = getDb()

    const existing = db.prepare('SELECT id FROM youtube_oauth_tokens WHERE channel_id = ?').get(channelId) as { id: string } | undefined

    if (existing) {
      db.prepare(`
        UPDATE youtube_oauth_tokens
        SET access_token = ?, refresh_token = ?, token_expiry = ?, channel_title = ?, scopes = ?, updated_at = datetime('now')
        WHERE channel_id = ?
      `).run(
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600000).toISOString(),
        channelTitle,
        JSON.stringify(tokens.scope?.split(' ') || []),
        channelId
      )
    } else {
      db.prepare(`
        INSERT INTO youtube_oauth_tokens (id, channel_id, channel_title, access_token, refresh_token, token_expiry, scopes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        channelId,
        channelTitle,
        tokens.access_token,
        tokens.refresh_token || '',
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600000).toISOString(),
        JSON.stringify(tokens.scope?.split(' ') || [])
      )
    }

    return NextResponse.redirect(new URL('/youtube?connected=true', url.origin))
  } catch (err) {
    console.error('YouTube OAuth callback error:', err)
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.redirect(new URL('/youtube?error=' + encodeURIComponent(message), url.origin))
  }
}
