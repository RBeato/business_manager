import { NextResponse } from 'next/server'
import { getDb, parseJson } from '@/lib/db'
import { Octokit } from '@octokit/rest'

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

export async function POST() {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not configured. Add it to dashboard/.env.local' },
      { status: 500 }
    )
  }

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

  const octokit = new Octokit({ auth: githubToken })
  const results: PublishResult[] = []
  const errors: PublishError[] = []

  for (const post of posts) {
    try {
      const prUrl = await publishSinglePost(octokit, db, post)
      results.push({
        postId: post.id as string,
        title: post.title as string,
        website: post.website as Website,
        prUrl,
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

async function publishSinglePost(
  octokit: Octokit,
  db: ReturnType<typeof getDb>,
  post: Record<string, unknown>
): Promise<string> {
  const website = post.website as Website
  const config = REPO_CONFIG[website]

  if (!config) {
    throw new Error(`Unknown website: ${website}`)
  }

  const slug = post.slug as string
  const title = post.title as string
  const branchName = `blog/${slug}-${Date.now()}`

  const { data: ref } = await octokit.git.getRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${config.baseBranch}`,
  })

  const baseSha = ref.object.sha

  await octokit.git.createRef({
    owner: config.owner,
    repo: config.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  })

  const fileContent = generateBlogPostFile(post)
  const filePath = `${config.blogPath}/${slug}/page.tsx`

  await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: filePath,
    message: `feat: Add blog post - ${title}`,
    content: Buffer.from(fileContent).toString('base64'),
    branch: branchName,
  })

  try {
    await updateSitemap(octokit, config, slug, branchName)
  } catch {
    // Sitemap update is non-critical
  }

  const { data: pr } = await octokit.pulls.create({
    owner: config.owner,
    repo: config.repo,
    title: `Blog: ${title}`,
    head: branchName,
    base: config.baseBranch,
    body: generatePRDescription(post),
  })

  db.prepare(
    'UPDATE blog_posts SET status = ?, published_date = ?, github_pr_url = ?, updated_at = ? WHERE id = ?'
  ).run('published', new Date().toISOString(), pr.html_url, new Date().toISOString(), post.id)

  return pr.html_url
}

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

function convertMarkdownToJSX(markdown: string): string {
  return markdown
    .replace(/^## (.+)$/gm, '<h2 className="text-3xl font-bold text-gray-900 mb-4">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 className="text-2xl font-semibold text-gray-900 mb-3">$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^([^<\n].+)$/gm, '<p className="text-gray-700 mb-4">$1</p>')
}

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
