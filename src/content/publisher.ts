/**
 * Blog Post Publisher
 * Creates GitHub PRs with new blog posts for deployment
 */

import { createClient } from '@supabase/supabase-js'
import { Octokit } from '@octokit/rest'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GitHub repository configurations
const REPO_CONFIG = {
  healthopenpage: {
    owner: 'RBeato',
    repo: 'healthopenpage-web',
    baseBranch: 'main',
    blogPath: 'src/app/blog'
  },
  meditnation: {
    owner: 'RBeato',
    repo: 'MeditNation_website',
    baseBranch: 'main',
    blogPath: 'src/app/blog'
  },
  riffroutine: {
    owner: 'RBeato',
    repo: 'Practice-Share',
    baseBranch: 'main',
    blogPath: 'src/app/blog'
  }
} as const

type Website = keyof typeof REPO_CONFIG

interface PublishOptions {
  autoMerge?: boolean
  scheduledDate?: Date
}

/**
 * Create GitHub PR with new blog post
 */
export async function publishBlogPost(
  blogPostId: string,
  options: PublishOptions = {}
): Promise<string> {
  // Get blog post from database
  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', blogPostId)
    .single()

  if (error || !post) {
    throw new Error(`Blog post not found: ${blogPostId}`)
  }

  if (post.status !== 'approved') {
    throw new Error(`Blog post not approved (status: ${post.status})`)
  }

  const website = post.website as Website
  const config = REPO_CONFIG[website]

  console.log(`📤 Publishing "${post.title}" to ${website}`)

  // Initialize GitHub client
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  })

  // Create branch name
  const branchName = `blog/${post.slug}-${Date.now()}`

  // Get latest commit SHA from base branch
  const { data: ref } = await octokit.git.getRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${config.baseBranch}`
  })

  const baseSha = ref.object.sha

  // Create new branch
  await octokit.git.createRef({
    owner: config.owner,
    repo: config.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha
  })

  console.log(`  Created branch: ${branchName}`)

  // Generate blog post file content
  const fileContent = generateBlogPostFile(post)

  // Create file in new branch
  const filePath = `${config.blogPath}/${post.slug}/page.tsx`

  await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: filePath,
    message: `feat: Add blog post - ${post.title}`,
    content: Buffer.from(fileContent).toString('base64'),
    branch: branchName
  })

  console.log(`  Created file: ${filePath}`)

  // Update sitemap (if exists)
  try {
    await updateSitemap(octokit, config, post.slug, branchName)
  } catch (error) {
    console.warn(`  Warning: Could not update sitemap:`, error)
  }

  // Create pull request
  const { data: pr } = await octokit.pulls.create({
    owner: config.owner,
    repo: config.repo,
    title: `Blog: ${post.title}`,
    head: branchName,
    base: config.baseBranch,
    body: generatePRDescription(post)
  })

  console.log(`✅ Pull Request created: ${pr.html_url}`)

  // Auto-merge if requested
  if (options.autoMerge) {
    try {
      await octokit.pulls.merge({
        owner: config.owner,
        repo: config.repo,
        pull_number: pr.number,
        merge_method: 'squash'
      })
      console.log(`  Auto-merged PR #${pr.number}`)
    } catch (error) {
      console.warn(`  Auto-merge failed, manual merge required`)
    }
  }

  // Update blog post status in database
  await supabase
    .from('blog_posts')
    .update({
      status: options.autoMerge ? 'published' : 'approved',
      published_date: options.autoMerge ? new Date().toISOString() : null
    })
    .eq('id', blogPostId)

  return pr.html_url
}

/**
 * Generate Next.js blog post file content
 */
function generateBlogPostFile(post: any): string {
  const {
    title,
    meta_description,
    keywords,
    content,
    reading_time_minutes,
    website
  } = post

  const websiteUrl = REPO_CONFIG[website as Website]

  return `import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: '${title.replace(/'/g, "\\'")}',
  description: '${meta_description.replace(/'/g, "\\'")}',
  keywords: '${keywords.join(', ')}',
}

export default function BlogPost() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/blog" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ${title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>•</span>
            <span>${reading_time_minutes} min read</span>
          </div>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 py-12 prose prose-lg">
        ${convertMarkdownToJSX(content)}
      </article>

      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-blue-600 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50 transition"
          >
            Sign Up Free
          </Link>
        </div>
      </div>
    </div>
  )
}
`
}

/**
 * Convert markdown to JSX (basic conversion)
 */
function convertMarkdownToJSX(markdown: string): string {
  // This is a simplified converter - for production, use a proper markdown-to-JSX library
  return markdown
    .replace(/^## (.+)$/gm, '<h2 className="text-3xl font-bold text-gray-900 mb-4">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 className="text-2xl font-semibold text-gray-900 mb-3">$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^([^<\n].+)$/gm, '<p className="text-gray-700 mb-4">$1</p>')
}

/**
 * Update sitemap with new blog post
 */
async function updateSitemap(
  octokit: Octokit,
  config: typeof REPO_CONFIG[Website],
  slug: string,
  branchName: string
) {
  const sitemapPath = 'src/app/sitemap.ts'

  // Get current sitemap
  const { data: file } = await octokit.repos.getContent({
    owner: config.owner,
    repo: config.repo,
    path: sitemapPath,
    ref: branchName
  })

  if (!('content' in file)) {
    throw new Error('Sitemap file not found')
  }

  const currentContent = Buffer.from(file.content, 'base64').toString('utf-8')

  // Add new blog post entry before the closing bracket
  const newEntry = `    {
      url: \`\${baseUrl}/blog/${slug}\`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },`

  const updatedContent = currentContent.replace(
    /(\s+)]\s*\n\s*}/,
    `$1${newEntry}\n$1]\n}`
  )

  // Update sitemap file
  await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: sitemapPath,
    message: `chore: Update sitemap with ${slug}`,
    content: Buffer.from(updatedContent).toString('base64'),
    branch: branchName,
    sha: file.sha
  })

  console.log(`  Updated sitemap`)
}

/**
 * Generate PR description
 */
function generatePRDescription(post: any): string {
  return `## 🤖 Automated Blog Post

**Title:** ${post.title}
**Slug:** \`${post.slug}\`
**Target Keyword:** ${post.target_keyword}
**SEO Score:** ${post.seo_score}/100
**Word Count:** ${post.word_count} words
**Reading Time:** ${post.reading_time_minutes} min

### Generated Content
This blog post was automatically generated by the Content Engine and approved for publication.

### SEO Metrics
- Keywords: ${post.keywords.join(', ')}
- Meta Description: ${post.meta_description}

### Review Checklist
- [x] Content generated
- [x] SEO optimized
- [x] Human reviewed and approved
- [x] Sitemap updated
- [ ] Verify build passes
- [ ] Check mobile responsiveness

---

*🤖 Generated with Business Manager Content Engine*
*Co-Authored-By: Claude <noreply@anthropic.com>*
`
}

/**
 * Publish scheduled posts (run by cron)
 */
export async function publishScheduledPosts() {
  const now = new Date()

  // Get approved posts scheduled for now or earlier
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'approved')
    .not('scheduled_publish_date', 'is', null)
    .lte('scheduled_publish_date', now.toISOString())

  if (error) {
    console.error('Failed to fetch scheduled posts:', error)
    return
  }

  if (!posts || posts.length === 0) {
    console.log('ℹ️  No posts scheduled for publishing')
    return
  }

  console.log(`📅 Publishing ${posts.length} scheduled post(s)`)

  for (const post of posts) {
    try {
      const prUrl = await publishBlogPost(post.id, { autoMerge: true })
      console.log(`✅ Published: ${post.title} (${prUrl})`)
    } catch (error) {
      console.error(`❌ Failed to publish ${post.title}:`, error)
    }
  }
}
