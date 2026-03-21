import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

export async function GET() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set' },
      { status: 500 }
    )
  }

  const port = process.env.PORT || '3002'
  const redirectUri = `http://localhost:${port}/api/youtube/callback`

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })

  return NextResponse.redirect(authUrl)
}
