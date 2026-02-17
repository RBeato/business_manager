#!/usr/bin/env tsx
/**
 * Generate featured images for all existing blog posts using Gemini API
 * Scans all 3 website repos and generates images for posts that don't have them
 *
 * Usage:
 *   npx tsx scripts/generate-blog-images.ts                     # All websites
 *   npx tsx scripts/generate-blog-images.ts healthopenpage      # Single website
 *   npx tsx scripts/generate-blog-images.ts --dry               # Dry run
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { generateBlogImage, blogImageExists, sleep } from '../src/content/image-generator'

type Website = 'healthopenpage' | 'meditnation' | 'riffroutine'

interface BlogPostInfo {
  website: Website
  slug: string
  title: string
  targetKeyword?: string
}

const WEBSITE_BLOG_PATHS: Record<Website, { dir: string; pattern: 'tsx' | 'mdx' }> = {
  healthopenpage: {
    dir: '/Users/rbsou/Documents/CODE/open_page/src/app/blog',
    pattern: 'tsx',
  },
  meditnation: {
    dir: '/Users/rbsou/Documents/CODE/meditnation_website/app/blog',
    pattern: 'tsx',
  },
  riffroutine: {
    dir: '/Users/rbsou/Documents/CODE/riff_routine/content/blog',
    pattern: 'mdx',
  },
}

/**
 * Extract title from a TSX blog page (HOP / MeditNation)
 */
function extractTitleFromTsx(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Try metadata.title first
  const metadataMatch = content.match(/title:\s*['"`]([^'"`]+)['"`]/)
  if (metadataMatch) return metadataMatch[1]

  // Try h1 tag
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/)
  if (h1Match) return h1Match[1]

  return null
}

/**
 * Extract title from MDX frontmatter (RiffRoutine)
 */
function extractTitleFromMdx(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Parse frontmatter between --- markers
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return null

  const titleMatch = frontmatterMatch[1].match(/title:\s*["']([^"']+)["']/)
  if (titleMatch) return titleMatch[1]

  return null
}

/**
 * Discover all blog posts for a website
 */
function discoverPosts(website: Website): BlogPostInfo[] {
  const config = WEBSITE_BLOG_PATHS[website]
  const posts: BlogPostInfo[] = []

  if (!fs.existsSync(config.dir)) {
    console.log(`  Directory not found: ${config.dir}`)
    return posts
  }

  if (config.pattern === 'tsx') {
    // Scan subdirectories for page.tsx files
    const entries = fs.readdirSync(config.dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      // Skip non-blog directories (e.g., page.tsx at blog root)
      if (entry.name === 'biomarkers') continue

      const pagePath = path.join(config.dir, entry.name, 'page.tsx')
      if (!fs.existsSync(pagePath)) continue

      const title = extractTitleFromTsx(pagePath)
      if (title) {
        posts.push({
          website,
          slug: entry.name,
          title,
        })
      }
    }
  } else if (config.pattern === 'mdx') {
    // Scan MDX files
    const files = fs.readdirSync(config.dir).filter(f => f.endsWith('.mdx'))
    for (const file of files) {
      const filePath = path.join(config.dir, file)
      const title = extractTitleFromMdx(filePath)
      const slug = file.replace('.mdx', '')

      if (title) {
        posts.push({
          website,
          slug,
          title,
        })
      }
    }
  }

  return posts
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry')
  const websiteArg = args.find(a => !a.startsWith('--')) as Website | undefined

  const websites: Website[] = websiteArg
    ? [websiteArg]
    : ['healthopenpage', 'meditnation', 'riffroutine']

  console.log('=== Blog Image Generator ===')
  if (dryRun) console.log('[DRY RUN - no images will be generated]\n')

  let totalGenerated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const website of websites) {
    console.log(`\n--- ${website} ---`)
    const posts = discoverPosts(website)
    console.log(`  Found ${posts.length} blog posts`)

    for (const post of posts) {
      // Check if image already exists
      if (blogImageExists(website, post.slug)) {
        console.log(`  [skip] ${post.slug} (image exists)`)
        totalSkipped++
        continue
      }

      if (dryRun) {
        console.log(`  [would generate] ${post.slug}: "${post.title}"`)
        totalGenerated++
        continue
      }

      try {
        console.log(`  [generating] ${post.slug}: "${post.title}"`)
        const result = await generateBlogImage({
          title: post.title,
          website,
          slug: post.slug,
          targetKeyword: post.targetKeyword,
        })
        console.log(`  [done] ${result.relativePath}`)
        totalGenerated++

        // Rate limit: wait 3 seconds between API calls
        await sleep(3000)
      } catch (err: any) {
        console.error(`  [FAILED] ${post.slug}: ${err.message}`)
        totalFailed++
        // Wait before retrying next one
        await sleep(2000)
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Generated: ${totalGenerated}`)
  console.log(`  Skipped:   ${totalSkipped}`)
  console.log(`  Failed:    ${totalFailed}`)
  if (dryRun) console.log('\n  [DRY RUN - no images were actually generated]')
  if (!dryRun && totalGenerated > 0) {
    console.log(`  Est. cost: ~$${(totalGenerated * 0.03).toFixed(2)}`)
  }
}

main().catch(console.error)
