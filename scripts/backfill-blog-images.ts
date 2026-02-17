#!/usr/bin/env tsx
/**
 * Backfill existing blog files to display generated images
 * Patches page.tsx/mdx files to include hero images and OpenGraph metadata
 *
 * IMPORTANT: Run generate-blog-images.ts first to create the image files!
 *
 * Usage:
 *   npx tsx scripts/backfill-blog-images.ts                     # All websites
 *   npx tsx scripts/backfill-blog-images.ts healthopenpage      # Single website
 *   npx tsx scripts/backfill-blog-images.ts --dry               # Dry run
 */

import * as fs from 'fs'
import * as path from 'path'
import { getBlogImageExt } from '../src/content/image-generator'

type Website = 'healthopenpage' | 'meditnation' | 'riffroutine'

const WEBSITE_CONFIG: Record<Website, {
  blogDir: string
  imageBaseUrl: string
  pattern: 'tsx' | 'mdx'
}> = {
  healthopenpage: {
    blogDir: '/Users/rbsou/Documents/CODE/open_page/src/app/blog',
    imageBaseUrl: 'https://www.healthopenpage.com',
    pattern: 'tsx',
  },
  meditnation: {
    blogDir: '/Users/rbsou/Documents/CODE/meditnation_website/app/blog',
    imageBaseUrl: 'https://www.meditnation.org',
    pattern: 'tsx',
  },
  riffroutine: {
    blogDir: '/Users/rbsou/Documents/CODE/riff_routine/content/blog',
    imageBaseUrl: 'https://www.riffroutine.com',
    pattern: 'mdx',
  },
}

const WEBSITE_IMAGE_DIRS: Record<Website, string> = {
  healthopenpage: '/Users/rbsou/Documents/CODE/open_page/public/images/blog',
  meditnation: '/Users/rbsou/Documents/CODE/meditnation_website/public/images/blog',
  riffroutine: '/Users/rbsou/Documents/CODE/riff_routine/public/images/blog',
}

/**
 * Patch HOP blog pages (static TSX files)
 * Both generated and handwritten pages share the same pattern:
 * - Header in <div className="bg-white border-b">
 * - Content in <article className="max-w-4xl ...">
 * We insert the hero image between them.
 */
function patchHopPage(filePath: string, slug: string, dryRun: boolean): boolean {
  let content = fs.readFileSync(filePath, 'utf-8')

  // Skip if already has blog image
  if (content.includes('/images/blog/')) {
    return false
  }

  // Check if image file exists (.png or .jpg)
  const ext = getBlogImageExt('healthopenpage', slug)
  if (!ext) {
    console.log(`    [no image] ${slug}.png/.jpg not found, skipping`)
    return false
  }

  let modified = false

  // 1. Add Image import if not present
  if (!content.includes("from 'next/image'")) {
    content = content.replace(
      "import { Metadata } from 'next'",
      "import { Metadata } from 'next'\nimport Image from 'next/image'"
    )
    modified = true
  }

  // 2. Add images to openGraph metadata
  if (!content.includes('images:') || !content.match(/openGraph:[\s\S]*?images:/)) {
    const ogImageEntry = `\n    images: [{ url: '${WEBSITE_CONFIG.healthopenpage.imageBaseUrl}/images/blog/${slug}.${ext}', width: 1200, height: 675, alt: '' }],`

    // Insert after type: 'article',
    content = content.replace(
      /(openGraph:\s*\{[^}]*type:\s*'article',)/,
      `$1${ogImageEntry}`
    )
    modified = true
  }

  // 3. Add images to twitter metadata
  if (!content.match(/twitter:\s*\{[^}]*images:/)) {
    content = content.replace(
      /(twitter:\s*\{[^}]*card:\s*'summary_large_image',)/,
      `$1\n    images: ['${WEBSITE_CONFIG.healthopenpage.imageBaseUrl}/images/blog/${slug}.${ext}'],`
    )
    modified = true
  }

  // 4. Insert hero image between header and article
  if (!content.includes('hero-image')) {
    const heroImageJsx = `
      {/* Hero Image */}
      <div className="max-w-4xl mx-auto px-4 mt-8" data-hero-image>
        <Image
          src="/images/blog/${slug}.${ext}"
          alt=""
          width={1200}
          height={675}
          className="rounded-lg w-full h-auto"
          priority
        />
      </div>
`
    // Insert before <article
    content = content.replace(
      /(\s*)({\s*\/\*\s*Content\s*\*\/\s*}\s*)?(<article\s)/,
      `\n${heroImageJsx}\n$1$3`
    )
    modified = true
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  return modified
}

/**
 * Patch MeditNation blog pages (component-based TSX)
 * These pages import a component like <Blog5MinuteMeditation />
 * We add hero image in the page.tsx wrapper, before the component
 */
function patchMeditNationPage(filePath: string, slug: string, dryRun: boolean): boolean {
  let content = fs.readFileSync(filePath, 'utf-8')

  // Skip if already has blog image
  if (content.includes('/images/blog/')) {
    return false
  }

  // Check if image file exists (.png or .jpg)
  const ext = getBlogImageExt('meditnation', slug)
  if (!ext) {
    console.log(`    [no image] ${slug}.png/.jpg not found, skipping`)
    return false
  }

  let modified = false

  // 1. Add Image import
  if (!content.includes("from 'next/image'")) {
    content = content.replace(
      "import { Metadata } from 'next'",
      "import { Metadata } from 'next'\nimport Image from 'next/image'"
    )
    modified = true
  }

  // 2. Add images to openGraph metadata
  if (!content.match(/openGraph:[\s\S]*?images:/)) {
    content = content.replace(
      /(openGraph:\s*\{[^}]*type:\s*'article',)/,
      `$1\n    images: [{ url: '${WEBSITE_CONFIG.meditnation.imageBaseUrl}/images/blog/${slug}.${ext}', width: 1200, height: 675 }],`
    )
    modified = true
  }

  // 3. Add images to twitter metadata
  if (!content.match(/twitter:\s*\{[^}]*images:/)) {
    content = content.replace(
      /(twitter:\s*\{[^}]*card:\s*'summary_large_image',)/,
      `$1\n    images: ['${WEBSITE_CONFIG.meditnation.imageBaseUrl}/images/blog/${slug}.${ext}'],`
    )
    modified = true
  }

  // 4. Add hero image before the component in the return statement
  // Find the component render (e.g., <Blog5MinuteMeditation />)
  const componentMatch = content.match(/<(Blog\w+)\s*\/>/)
  if (componentMatch && !content.includes('data-hero-image')) {
    const componentTag = componentMatch[0]
    const heroImage = `<div className="max-w-4xl mx-auto px-4 pt-8" data-hero-image>
          <Image
            src="/images/blog/${slug}.${ext}"
            alt=""
            width={1200}
            height={675}
            className="rounded-lg w-full h-auto"
            priority
          />
        </div>
        ${componentTag}`

    content = content.replace(componentTag, heroImage)
    modified = true
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  return modified
}

/**
 * Patch RiffRoutine MDX files
 * Simply adds `image: "/images/blog/{slug}.png"` to frontmatter
 */
function patchRiffRoutineMdx(filePath: string, slug: string, dryRun: boolean): boolean {
  let content = fs.readFileSync(filePath, 'utf-8')

  // Skip if already has image in frontmatter
  if (content.match(/^image:/m)) {
    return false
  }

  // Check if image file exists (.png or .jpg)
  const ext = getBlogImageExt('riffroutine', slug)
  if (!ext) {
    console.log(`    [no image] ${slug}.png/.jpg not found, skipping`)
    return false
  }

  // Add image field to frontmatter (before the closing ---)
  const frontmatterEnd = content.indexOf('\n---', 4) // Skip the first ---
  if (frontmatterEnd === -1) return false

  content = content.slice(0, frontmatterEnd) +
    `\nimage: "/images/blog/${slug}.${ext}"` +
    content.slice(frontmatterEnd)

  if (!dryRun) {
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  return true
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry')
  const websiteArg = args.find(a => !a.startsWith('--')) as Website | undefined

  const websites: Website[] = websiteArg
    ? [websiteArg]
    : ['healthopenpage', 'meditnation', 'riffroutine']

  console.log('=== Blog Image Backfill ===')
  if (dryRun) console.log('[DRY RUN - no files will be modified]\n')

  let totalPatched = 0
  let totalSkipped = 0

  for (const website of websites) {
    console.log(`\n--- ${website} ---`)
    const config = WEBSITE_CONFIG[website]

    if (!fs.existsSync(config.blogDir)) {
      console.log(`  Directory not found: ${config.blogDir}`)
      continue
    }

    if (config.pattern === 'tsx') {
      const entries = fs.readdirSync(config.blogDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name === 'biomarkers') continue

        const pagePath = path.join(config.blogDir, entry.name, 'page.tsx')
        if (!fs.existsSync(pagePath)) continue

        const patchFn = website === 'healthopenpage' ? patchHopPage : patchMeditNationPage
        const patched = patchFn(pagePath, entry.name, dryRun)

        if (patched) {
          console.log(`  [${dryRun ? 'would patch' : 'patched'}] ${entry.name}/page.tsx`)
          totalPatched++
        } else {
          console.log(`  [skip] ${entry.name} (already patched or no image)`)
          totalSkipped++
        }
      }
    } else if (config.pattern === 'mdx') {
      const files = fs.readdirSync(config.blogDir).filter(f => f.endsWith('.mdx'))
      for (const file of files) {
        const filePath = path.join(config.blogDir, file)
        const slug = file.replace('.mdx', '')

        const patched = patchRiffRoutineMdx(filePath, slug, dryRun)
        if (patched) {
          console.log(`  [${dryRun ? 'would patch' : 'patched'}] ${file}`)
          totalPatched++
        } else {
          console.log(`  [skip] ${file} (already patched or no image)`)
          totalSkipped++
        }
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Patched: ${totalPatched}`)
  console.log(`  Skipped: ${totalSkipped}`)
  if (dryRun) console.log('\n  [DRY RUN - no files were modified]')
  if (!dryRun && totalPatched > 0) {
    console.log('\nNext steps:')
    console.log('  Review changes with: git diff (in each website repo)')
    console.log('  Then commit & push to deploy via Vercel')
  }
}

main().catch(console.error)
