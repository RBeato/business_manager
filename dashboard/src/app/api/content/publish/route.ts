import { NextResponse } from 'next/server'
import { getDb, parseJson } from '@/lib/db'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const SITE_CONFIG: Record<string, {
  repoPath: string
  blogDir: string
  imageDir: string
  category: (post: Record<string, unknown>) => string
}> = {
  riffroutine: {
    repoPath: '/Users/rbsou/Documents/CODE/riff_routine',
    blogDir: 'content/blog',
    imageDir: 'public/images/blog',
    category: (post) => {
      const kw = ((post.target_keyword as string) || '').toLowerCase()
      if (/routine|guitarist|practice routine/.test(kw)) return 'guitarist'
      if (/genre|blues|jazz|rock|metal|classical|country|funk/.test(kw)) return 'genre'
      return 'technique'
    },
  },
  healthopenpage: {
    repoPath: '/Users/rbsou/Documents/CODE/open_page',
    blogDir: 'content/blog',
    imageDir: 'public/images/blog',
    category: () => 'health',
  },
  meditnation: {
    repoPath: '/Users/rbsou/Documents/CODE/meditnation_website',
    blogDir: 'content/blog',
    imageDir: 'public/images/blog',
    category: () => 'meditation',
  },
}

type Website = keyof typeof SITE_CONFIG

interface PublishResult {
  postId: string
  title: string
  website: string
  prUrl: string
}

interface PublishError {
  postId: string
  title: string
  website: string
  error: string
}

export async function POST() {
  const db = getDb()
  const posts = db.prepare(
    "SELECT * FROM blog_posts WHERE status = 'approved' ORDER BY created_at ASC"
  ).all() as Record<string, unknown>[]

  if (posts.length === 0) {
    return NextResponse.json(
      { error: 'No approved posts to publish' },
      { status: 404 }
    )
  }

  for (const post of posts) {
    post.keywords = parseJson(post.keywords)
  }

  const results: PublishResult[] = []
  const errors: PublishError[] = []

  for (const post of posts) {
    try {
      await publishPostLocally(db, post)
      results.push({
        postId: post.id as string,
        title: post.title as string,
        website: post.website as string,
        prUrl: '',
      })
    } catch (err) {
      errors.push({
        postId: post.id as string,
        title: post.title as string,
        website: post.website as string,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Git commit + push all published posts at once (per repo)
  const reposPushed: string[] = []
  const websitesPublished = [...new Set(results.map(r => r.website))]

  for (const website of websitesPublished) {
    const config = SITE_CONFIG[website]
    if (!config) continue

    try {
      const filesToAdd = results
        .filter(r => r.website === website)
        .flatMap(r => {
          const post = posts.find(p => p.id === r.postId)!
          const slug = makeCleanSlug(post.slug as string)
          const files = [`${config.blogDir}/${slug}.mdx`]
          // Add image if it exists
          const imgPath = path.join(config.repoPath, config.imageDir, `${slug}.png`)
          if (fs.existsSync(imgPath)) {
            files.push(`${config.imageDir}/${slug}.png`)
          }
          return files
        })

      const titles = results
        .filter(r => r.website === website)
        .map(r => r.title)

      const commitMsg = titles.length === 1
        ? `feat: Add blog post - ${titles[0]}`
        : `feat: Add ${titles.length} blog posts\n\n${titles.map(t => `- ${t}`).join('\n')}`

      execSync(
        `git add ${filesToAdd.map(f => `"${f}"`).join(' ')} && git commit -m "${commitMsg.replace(/"/g, '\\"')}\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push`,
        { cwd: config.repoPath, timeout: 30000 }
      )

      reposPushed.push(website)
    } catch (gitErr) {
      // Git push failed — mark posts as errors
      for (const r of results.filter(r => r.website === website)) {
        const idx = results.indexOf(r)
        results.splice(idx, 1)
        errors.push({
          ...r,
          error: `Git push failed: ${gitErr instanceof Error ? gitErr.message : String(gitErr)}`,
        })
      }
    }
  }

  return NextResponse.json({
    published: results,
    errors,
    summary: {
      total: posts.length,
      succeeded: results.length,
      failed: errors.length,
    },
  })
}

export async function GET() {
  const db = getDb()
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM blog_posts WHERE status = 'approved'"
  ).get() as { count: number }

  return NextResponse.json({ approvedCount: row.count })
}

/**
 * Create a clean short slug from the DB slug (strip subtitle after colon dash)
 */
function makeCleanSlug(dbSlug: string): string {
  // DB slugs are often long like "how-to-improve-guitar-speed-10-proven-exercises"
  // Keep as-is since we need the file to match what the blog system expects
  return dbSlug
}

/**
 * Publish a single post by writing MDX file to the local website repo
 */
async function publishPostLocally(
  db: ReturnType<typeof getDb>,
  post: Record<string, unknown>
): Promise<void> {
  const website = post.website as string
  const config = SITE_CONFIG[website]

  if (!config) {
    throw new Error(`Unknown website: ${website}`)
  }

  const slug = makeCleanSlug(post.slug as string)
  const title = post.title as string
  const description = (post.meta_description as string) || ''
  const content = post.content as string
  const keywords = (post.keywords as string[]) || []
  const category = config.category(post)
  const imageUrl = post.image_url as string | null

  // Determine image path — check if image exists, copy with clean slug if needed
  let imagePath: string | null = null
  if (imageUrl) {
    const cleanImageFile = `${slug}.png`
    const destPath = path.join(config.repoPath, config.imageDir, cleanImageFile)

    if (fs.existsSync(destPath)) {
      imagePath = `/images/blog/${cleanImageFile}`
    } else {
      // Check if image exists with original long name
      const originalFile = path.basename(imageUrl)
      const originalPath = path.join(config.repoPath, config.imageDir, originalFile)
      if (fs.existsSync(originalPath)) {
        fs.copyFileSync(originalPath, destPath)
        imagePath = `/images/blog/${cleanImageFile}`
      }
    }
  }

  // Build MDX frontmatter + content
  const today = new Date().toISOString().split('T')[0]
  const tagsArray = keywords.map(k => `"${k}"`).join(', ')

  const mdxContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: "${today}"
author: "RiffRoutine Team"
category: "${category}"
tags: [${tagsArray}]
featured: true${imagePath ? `\nimage: "${imagePath}"` : ''}
---

${content}
`

  // Write MDX file
  const blogDir = path.join(config.repoPath, config.blogDir)
  fs.mkdirSync(blogDir, { recursive: true })
  const filePath = path.join(blogDir, `${slug}.mdx`)
  fs.writeFileSync(filePath, mdxContent)

  // Update DB
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE blog_posts SET status = ?, published_date = ?, updated_at = ? WHERE id = ?'
  ).run('published', now, now, post.id)
}
