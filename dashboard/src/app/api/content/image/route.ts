import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const WEBSITE_REPOS: Record<string, string> = {
  riffroutine: '/Users/rbsou/Documents/CODE/riff_routine/public',
  healthopenpage: '/Users/rbsou/Documents/CODE/open_page/public',
  meditnation: '/Users/rbsou/Documents/CODE/meditnation_website/public',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const website = searchParams.get('website')
  const imagePath = searchParams.get('path')

  if (!website || !imagePath) {
    return NextResponse.json({ error: 'Missing website or path' }, { status: 400 })
  }

  const publicDir = WEBSITE_REPOS[website]
  if (!publicDir) {
    return NextResponse.json({ error: 'Unknown website' }, { status: 400 })
  }

  // Sanitize path to prevent directory traversal
  const normalized = path.normalize(imagePath).replace(/^(\.\.(\/|\\|$))+/, '')
  const fullPath = path.join(publicDir, normalized)

  // Ensure the resolved path is within the public directory
  if (!fullPath.startsWith(publicDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const ext = path.extname(fullPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : 'application/octet-stream'

  const imageBuffer = fs.readFileSync(fullPath)

  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
