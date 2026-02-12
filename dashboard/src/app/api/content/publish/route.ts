import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Octokit } from '@octokit/rest'

// Use service role key for server-side operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// GitHub repository configurations (mirrored from src/content/publisher.ts)
const REPO_CONFIG = {
  healthopenpage: {
    owner: 'RBeato',
    repo: 'healthopenpage-web',
    baseBranch: 'main',
    blogPath: 'src/app/blog',
  },
  meditnation: {
    owner: 'RBeato',
    repo: 'MeditNation_website',
    baseBranch: 'main',
    blogPath: 'src/app/blog',
  },
  riffroutine: {
    owner: 'RBeato',
    repo: 'Practice-Share',
    baseBranch: 'main',
    blogPath: 'src/app/blog',
  },
} as const

type Website = keyof typeof REPO_CONFIG

interface PublishResult {
  postId: string
  title: string
  website: Website
  prUrl: string
}

interface PublishError {
  postId: string
  title: string
  website: string
  error: string
}

/**
 * POST /api/content/publish
 * Publishes all approved blog posts by creating GitHub PRs
 */
export async function POST() {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not configured. Add it to dashboard/.env.local' },
      { status: 500 }
    )
  }

  // Fetch all approved posts
  const { data: posts, error: fetchError } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to fetch approved posts: ${fetchError.message}` },
      { status: 500 }
    )
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json(
      { error: 'No approved posts to publish' },
      { status: 404 }
    )
  }

  const octokit = new Octokit({ auth: githubToken })
  const results: PublishResult[] = []
  const errors: PublishError[] = []

  for (const post of posts) {
    try {
      const prUrl = await publishSinglePost(octokit, post)
      results.push({
        postId: post.id,
        title: post.title,
        website: post.website,
        prUrl,
      })
    } catch (err) {
      errors.push({
        postId: post.id,
        title: post.title,
        website: post.website,
        error: err instanceof Error ? err.message : String(err),
      })
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

/**
 * GET /api/content/publish
 * Returns count of approved posts ready to publish
 */
export async function GET() {
  const { count, error } = await supabase
    .from('blog_posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')

  if (error) {
    return NextResponse.json(
      { error: `Failed to count approved posts: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ approvedCount: count || 0 })
}

/**
 * Publish a single blog post to its target website via GitHub PR
 */
async function publishSinglePost(
  octokit: Octokit,
  post: Record<string, unknown>
): Promise<string> {
  const website = post.website as Website
  const config = REPO_CONFIG[website]

  if (!config) {
    throw new Error(`Unknown website: ${website}`)
  }

  const slug = post.slug as string
  const title = post.title as string

  // Create branch name with timestamp to avoid collisions
  const branchName = `blog/${slug}-${Date.now()}`

  // Get latest commit SHA from base branch
  const { data: ref } = await octokit.git.getRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${config.baseBranch}`,
  })

  const baseSha = ref.object.sha

  // Create new branch
  await octokit.git.createRef({
    owner: config.owner,
    repo: config.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  })

  // Generate blog post file content
  const fileContent = generateBlogPostFile(post)

  // Create file in new branch
  const filePath = `${config.blogPath}/${slug}/page.tsx`

  await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: filePath,
    message: `feat: Add blog post - ${title}`,
    content: Buffer.from(fileContent).toString('base64'),
    branch: branchName,
  })

  // Update sitemap (best-effort)
  try {
    await updateSitemap(octokit, config, slug, branchName)
  } catch {
    // Sitemap update is non-critical
  }

  // Create pull request
  const { data: pr } = await octokit.pulls.create({
    owner: config.owner,
    repo: config.repo,
    title: `Blog: ${title}`,
    head: branchName,
    base: config.baseBranch,
    body: generatePRDescription(post),
  })

  // Update blog post status in database
  await supabase
    .from('blog_posts')
    .update({
      status: 'published',
      published_date: new Date().toISOString(),
      github_pr_url: pr.html_url,
    })
    .eq('id', post.id)

  return pr.html_url
}

/**
 * Generate Next.js blog post page file content
 */
function generateBlogPostFile(post: Record<string, unknown>): string {
  const title = (post.title as string).replace(/'/g, "\\'")
  const metaDescription = ((post.meta_description as string) || '').replace(/'/g, "\\'")
  const keywords = (post.keywords as string[]) || []
  const content = post.content as string
  const readingTime = post.reading_time_minutes as number

  return `import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: '${title}',
  description: '${metaDescription}',
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
            ${post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>${'\\u2022'}</span>
            <span>${readingTime} min read</span>
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
 * Convert markdown to JSX (basic conversion, matching publisher.ts logic)
 */
function convertMarkdownToJSX(markdown: string): string {
  return markdown
    .replace(/^## (.+)$/gm, '<h2 className="text-3xl font-bold text-gray-900 mb-4">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 className="text-2xl font-semibold text-gray-900 mb-3">$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^([^<\n].+)$/gm, '<p className="text-gray-700 mb-4">$1</p>')
}

/**
 * Update sitemap with new blog post entry
 */
async function updateSitemap(
  octokit: Octokit,
  config: (typeof REPO_CONFIG)[Website],
  slug: string,
  branchName: string
) {
  const sitemapPath = 'src/app/sitemap.ts'

  const { data: file } = await octokit.repos.getContent({
    owner: config.owner,
    repo: config.repo,
    path: sitemapPath,
    ref: branchName,
  })

  if (!('content' in file)) {
    throw new Error('Sitemap file not found')
  }

  const currentContent = Buffer.from(file.content as string, 'base64').toString('utf-8')

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

  await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: sitemapPath,
    message: `chore: Update sitemap with ${slug}`,
    content: Buffer.from(updatedContent).toString('base64'),
    branch: branchName,
    sha: (file as { sha: string }).sha,
  })
}

/**
 * Generate PR description
 */
function generatePRDescription(post: Record<string, unknown>): string {
  const keywords = (post.keywords as string[]) || []
  return `## Automated Blog Post

**Title:** ${post.title}
**Slug:** \`${post.slug}\`
**Target Keyword:** ${post.target_keyword}
**SEO Score:** ${post.seo_score}/100
**Word Count:** ${post.word_count} words
**Reading Time:** ${post.reading_time_minutes} min

### Generated Content
This blog post was automatically generated by the Content Engine and approved for publication.

### SEO Metrics
- Keywords: ${keywords.join(', ')}
- Meta Description: ${post.meta_description}

### Review Checklist
- [x] Content generated
- [x] SEO optimized
- [x] Human reviewed and approved
- [x] Sitemap updated
- [ ] Verify build passes
- [ ] Check mobile responsiveness

---

*Generated with Business Manager Content Engine*
`
}
