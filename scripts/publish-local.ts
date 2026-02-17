#!/usr/bin/env tsx
/**
 * Publish approved blog posts directly to local website repos
 * Creates page.tsx files with full SEO metadata, structured data, and content
 * Usage: npx tsx scripts/publish-local.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { blogImageExists, getBlogImageExt } from '../src/content/image-generator'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEBSITE_PATHS: Record<string, { dir: string; baseUrl: string; siteName: string }> = {
  healthopenpage: {
    dir: '/Users/rbsou/Documents/CODE/open_page',
    baseUrl: 'https://www.healthopenpage.com',
    siteName: 'HOP Health Tracker'
  },
  meditnation: {
    dir: '/Users/rbsou/Documents/CODE/meditnation_website',
    baseUrl: 'https://www.meditnation.org',
    siteName: 'MeditNation'
  },
  riffroutine: {
    dir: '/Users/rbsou/Documents/CODE/practice_share',
    baseUrl: 'https://www.riffroutine.com',
    siteName: 'RiffRoutine'
  }
}

function escapeJsx(str: string): string {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"')
}

function escapeJsonString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/**
 * Convert markdown content to JSX-safe HTML string for dangerouslySetInnerHTML
 */
function markdownToHtml(markdown: string): string {
  let html = markdown

  // Tables: convert markdown tables to HTML tables
  html = html.replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, headerRow, _separator, bodyRows) => {
    const headers = headerRow.split('|').filter((c: string) => c.trim()).map((c: string) => `<th class="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b-2 border-gray-200">${c.trim()}</th>`).join('')
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td class="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">${c.trim()}</td>`).join('')
      return `<tr class="hover:bg-gray-50">${cells}</tr>`
    }).join('')
    return `<div class="overflow-x-auto my-6"><table class="min-w-full bg-white rounded-lg shadow-sm border border-gray-200"><thead class="bg-gray-50"><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`
  })

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-gray-900 mt-8 mb-3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-4">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '')  // Remove H1 (title is already shown)

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline">$1</a>')

  // Unordered lists: group consecutive lines starting with - or *
  html = html.replace(/^((?:[-*] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^[-*] /, '')
      return `<li class="ml-4 mb-1">${content}</li>`
    }).join('')
    return `<ul class="list-disc pl-6 my-4 text-gray-700 space-y-1">${items}</ul>`
  })

  // Ordered lists
  html = html.replace(/^((?:\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^\d+\. /, '')
      return `<li class="ml-4 mb-1">${content}</li>`
    }).join('')
    return `<ol class="list-decimal pl-6 my-4 text-gray-700 space-y-1">${items}</ol>`
  })

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 text-gray-700 italic">$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-8 border-gray-200" />')

  // Paragraphs: wrap remaining non-tag lines
  html = html.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<')) return trimmed
    return `<p class="text-gray-700 mb-4 leading-relaxed">${trimmed}</p>`
  }).join('\n')

  // Clean up extra blank lines
  html = html.replace(/\n{3,}/g, '\n\n')

  return html
}

/**
 * Extract FAQ items from markdown content
 */
function extractFaqs(content: string): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = []
  const faqSection = content.match(/## (?:Frequently Asked Questions|FAQ)([\s\S]*?)(?=\n## |$)/i)
  if (!faqSection) return faqs

  const faqContent = faqSection[1]
  const questions = faqContent.split(/\n### /).filter(q => q.trim())

  for (const q of questions) {
    const lines = q.trim().split('\n')
    const question = lines[0].replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/\??\s*$/, '?')
    const answer = lines.slice(1).join(' ').replace(/^[-\s]+/, '').trim()
    if (question && answer) {
      faqs.push({ question, answer })
    }
  }

  return faqs
}

/**
 * Generate a complete Next.js page.tsx for a blog post
 */
function generatePageFile(post: any, website: string): string {
  const config = WEBSITE_PATHS[website]
  const today = new Date().toISOString().split('T')[0] + 'T00:00:00Z'
  const faqs = extractFaqs(post.content)
  const contentHtml = markdownToHtml(post.content)

  const title = post.title.replace(/'/g, "\\'")
  const metaDesc = (post.meta_description || '').replace(/'/g, "\\'")
  const keywords = (post.keywords || []).join(', ')
  const hasImage = post.image_url || blogImageExists(website as any, post.slug)
  const imageExt = getBlogImageExt(website as any, post.slug) || 'png'

  const faqSchemaItems = faqs.map(f => `{
          "@type": "Question",
          "name": ${JSON.stringify(f.question)},
          "acceptedAnswer": {
            "@type": "Answer",
            "text": ${JSON.stringify(f.answer)}
          }
        }`).join(',\n        ')

  return `import { Metadata } from 'next'
import Link from 'next/link'${hasImage ? "\nimport Image from 'next/image'" : ''}

export const metadata: Metadata = {
  title: '${title}',
  description: '${metaDesc}',
  keywords: '${keywords}',
  alternates: {
    canonical: '${config.baseUrl}/blog/${post.slug}',
  },
  openGraph: {
    title: '${title}',
    description: '${metaDesc}',
    url: '${config.baseUrl}/blog/${post.slug}',
    siteName: '${config.siteName}',
    type: 'article',
    publishedTime: '${today}',
    modifiedTime: '${today}',
    authors: ['${config.siteName} Team'],${hasImage ? `\n    images: [{ url: '${config.baseUrl}/images/blog/${post.slug}.${imageExt}', width: 1200, height: 675 }],` : ''}
  },
  twitter: {
    card: 'summary_large_image',
    title: '${title}',
    description: '${metaDesc}',${hasImage ? `\n    images: ['${config.baseUrl}/images/blog/${post.slug}.${imageExt}'],` : ''}
  },
}`

export default function BlogPost() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Article Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "${title}",
            "description": "${metaDesc}",
            "author": {
              "@type": "Organization",
              "name": "${config.siteName} Team",
              "url": "${config.baseUrl}"
            },
            "publisher": {
              "@type": "Organization",
              "name": "${config.siteName}",
              "logo": {
                "@type": "ImageObject",
                "url": "${config.baseUrl}/hop-logo.png"
              }
            },
            "datePublished": "${today}",
            "dateModified": "${today}",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": "${config.baseUrl}/blog/${post.slug}"
            }
          })
        }}
      />
${faqs.length > 0 ? `
      {/* FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              ${faqSchemaItems}
            ]
          })
        }}
      />
` : ''}
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/blog" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ${post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>&bull;</span>
            <span>${post.reading_time_minutes} min read</span>
          </div>
        </div>
      </div>

${hasImage ? `      {/* Hero Image */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        <Image
          src="/images/blog/${post.slug}.${imageExt}"
          alt="${title}"
          width={1200}
          height={675}
          className="rounded-lg w-full h-auto"
          priority
        />
      </div>
` : ''}
      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        <div
          dangerouslySetInnerHTML={{
            __html: \`${contentHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`
          }}
        />
      </article>

      {/* Medical Disclaimer */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <p className="text-sm text-amber-800">
            <strong>Medical Disclaimer:</strong> This information is for educational purposes only and should not replace professional medical advice.
            Always consult your healthcare provider before making changes to your health routine or interpreting lab results.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Analyze Your Lab Results with AI</h2>
          <p className="mb-6 text-blue-100">
            Upload your blood test results and get instant, personalized insights powered by AI.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-blue-600 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50 transition"
          >
            Try HOP Free
          </Link>
        </div>
      </div>
    </div>
  )
}
`
}

async function main() {
  const website = process.argv[2] || 'healthopenpage'

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'approved')
    .eq('website', website)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  if (!posts || posts.length === 0) {
    console.log('No approved posts to publish')
    return
  }

  const config = WEBSITE_PATHS[website]
  if (!config) {
    console.error(`Unknown website: ${website}`)
    process.exit(1)
  }

  console.log(`📝 Publishing ${posts.length} posts to ${website}`)
  console.log(`   Target directory: ${config.dir}\n`)

  const blogDir = path.join(config.dir, 'src/app/blog')
  let published = 0

  for (const post of posts) {
    try {
      const postDir = path.join(blogDir, post.slug)

      // Skip if already exists
      if (fs.existsSync(path.join(postDir, 'page.tsx'))) {
        console.log(`⏭️  Skipping "${post.title}" (already exists)`)
        continue
      }

      // Create directory
      fs.mkdirSync(postDir, { recursive: true })

      // Generate and write page file
      const pageContent = generatePageFile(post, website)
      fs.writeFileSync(path.join(postDir, 'page.tsx'), pageContent, 'utf-8')

      console.log(`✅ Created: ${post.slug}/page.tsx`)
      console.log(`   Title: "${post.title}" (SEO: ${post.seo_score}/100, ${post.word_count} words)`)

      // Update status in database
      await supabase
        .from('blog_posts')
        .update({
          status: 'published',
          published_date: new Date().toISOString()
        })
        .eq('id', post.id)

      published++
    } catch (err: any) {
      console.error(`❌ Failed: ${post.title}`, err.message)
    }
  }

  // Update sitemap
  if (published > 0) {
    console.log(`\n📍 Updating sitemap...`)
    const sitemapPath = path.join(config.dir, 'src/app/sitemap.ts')

    if (fs.existsSync(sitemapPath)) {
      let sitemap = fs.readFileSync(sitemapPath, 'utf-8')

      for (const post of posts) {
        const entry = `\`\${baseUrl}/blog/${post.slug}\``
        if (!sitemap.includes(post.slug)) {
          const sitemapEntry = `    {
      url: \`\${baseUrl}/blog/${post.slug}\`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },`
          // Insert before the closing bracket
          sitemap = sitemap.replace(
            /(\s+)(]\s*\n})/,
            `\n${sitemapEntry}\n$1$2`
          )
          console.log(`   Added: /blog/${post.slug}`)
        }
      }

      fs.writeFileSync(sitemapPath, sitemap, 'utf-8')
      console.log(`   Sitemap updated ✅`)
    }
  }

  console.log(`\n📊 Summary: ${published} published, ${posts.length - published} skipped`)
  console.log(`\nNext steps:`)
  console.log(`  1. cd ${config.dir}`)
  console.log(`  2. Review the generated pages`)
  console.log(`  3. git add . && git commit && git push`)
}

main().catch(console.error)
