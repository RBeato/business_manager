/**
 * Blog Post Generator
 * Uses DeepSeek AI to generate SEO-optimized blog posts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Website configurations
const WEBSITE_CONFIG = {
  healthopenpage: {
    name: 'HOP Health Tracker',
    url: 'https://www.healthopenpage.com',
    audience: 'Health-conscious individuals, biohackers, people tracking bloodwork',
    tone: 'Authoritative but accessible, scientific but clear',
    cta: 'Sign up for HOP to analyze your labs with AI',
    features: ['AI lab analysis', 'health tracking', 'biomarker insights', 'personalized routines']
  },
  meditnation: {
    name: 'MeditNation',
    url: 'https://www.meditnation.org',
    audience: 'Busy professionals, stressed individuals seeking mindfulness',
    tone: 'Calm, supportive, encouraging',
    cta: 'Download MeditNation for AI-personalized meditation',
    features: ['AI meditation', '10-language support', '5-minute sessions', 'custom affirmations']
  },
  riffroutine: {
    name: 'RiffRoutine',
    url: 'https://www.riffroutine.com',
    audience: 'Guitarists of all levels seeking structured practice',
    tone: 'Enthusiastic, practical, musician-to-musician',
    cta: 'Browse practice routines from pro guitarists on RiffRoutine',
    features: ['practice routines from pros', 'progress tracking', 'session logging', 'routine builder']
  }
} as const

type Website = keyof typeof WEBSITE_CONFIG

interface GenerateBlogPostParams {
  website: Website
  topic: string
  targetKeyword: string
  searchVolume?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  wordCount?: number
}

interface BlogPostResult {
  title: string
  slug: string
  content: string
  metaDescription: string
  keywords: string[]
  seoScore: number
  wordCount: number
  readingTimeMinutes: number
}

/**
 * Generate SEO-optimized blog post using DeepSeek AI
 */
export async function generateBlogPost(params: GenerateBlogPostParams): Promise<BlogPostResult> {
  const {
    website,
    topic,
    targetKeyword,
    searchVolume = 0,
    difficulty = 'medium',
    wordCount = 1800
  } = params

  const config = WEBSITE_CONFIG[website]

  // Use DeepSeek via Anthropic-compatible API
  const client = new Anthropic({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com'
  })

  const prompt = buildGenerationPrompt({
    website,
    config,
    topic,
    targetKeyword,
    searchVolume,
    difficulty,
    wordCount
  })

  console.log(`🤖 Generating blog post for ${website}: "${topic}"`)
  console.log(`   Target keyword: "${targetKeyword}" (${searchVolume} searches/month)`)

  const message = await client.messages.create({
    model: 'deepseek-chat',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Parse the generated content
  const parsed = parseGeneratedContent(responseText)

  // Calculate SEO score
  const seoScore = calculateSEOScore({
    content: parsed.content,
    targetKeyword,
    title: parsed.title,
    metaDescription: parsed.metaDescription
  })

  // Generate slug from title
  const slug = generateSlug(parsed.title)

  // Calculate reading time (avg 200 words/minute)
  const actualWordCount = countWords(parsed.content)
  const readingTime = Math.ceil(actualWordCount / 200)

  console.log(`✅ Generated: "${parsed.title}" (${actualWordCount} words, SEO: ${seoScore}/100)`)

  return {
    ...parsed,
    slug,
    seoScore,
    wordCount: actualWordCount,
    readingTimeMinutes: readingTime
  }
}

/**
 * Build generation prompt for AI
 */
function buildGenerationPrompt(params: {
  website: Website
  config: typeof WEBSITE_CONFIG[Website]
  topic: string
  targetKeyword: string
  searchVolume: number
  difficulty: string
  wordCount: number
}): string {
  const { config, topic, targetKeyword, searchVolume, wordCount } = params

  return `You are an expert SEO content writer for ${config.name}, a ${config.audience} platform.

**Task**: Write a comprehensive, SEO-optimized blog post.

**Topic**: ${topic}
**Target Keyword**: "${targetKeyword}"
**Search Volume**: ${searchVolume} monthly searches
**Target Length**: ${wordCount} words
**Website**: ${config.url}
**Tone**: ${config.tone}

**Audience**:
${config.audience}

**Key Features to Mention**:
${config.features.map(f => `- ${f}`).join('\n')}

**SEO Requirements**:
1. **Title (H1)**: Include target keyword, make it compelling (60 chars max)
2. **Meta Description**: 150-160 chars, include keyword, CTA
3. **Structure**:
   - Introduction (hook + what reader will learn)
   - 3-5 main sections with H2 headings
   - Each section has 2-3 subsections with H3 headings
   - FAQ section at end (5-7 questions for Google featured snippets)
4. **Keyword Optimization**:
   - Target keyword in title, first paragraph, one H2
   - Keyword density: 1-2% (natural, not stuffed)
   - Use LSI keywords (synonyms, related terms)
5. **Readability**:
   - Short paragraphs (3-4 sentences max)
   - Bullet lists and numbered lists
   - Examples and actionable tips
6. **Engagement**:
   - Conversational tone (AI search-friendly)
   - Address reader directly ("you", "your")
   - Include statistics where relevant
7. **Call-to-Action**:
   - End with CTA: "${config.cta}"
   - Link to ${config.url}

**AI Search Optimization (ChatGPT/Perplexity)**:
- Format FAQ as Q&A (direct answers)
- Use bullet lists for scannability
- Include comparison tables if relevant
- Answer "how", "what", "why" questions directly

**Output Format**:
Return ONLY valid JSON with this structure (no markdown, no code blocks):
{
  "title": "Blog post title here",
  "metaDescription": "Meta description here",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "content": "Full blog post content in Markdown format here"
}

**Content Guidelines**:
- Write ${wordCount}+ words
- Use markdown: ## for H2, ### for H3, - for lists
- NO promotional fluff, focus on value
- Include real examples, not generic advice
- Cite sources where possible (studies, experts)
- End with FAQ section (## Frequently Asked Questions)

Generate the blog post now:`
}

/**
 * Parse AI-generated content from JSON response
 */
function parseGeneratedContent(response: string): {
  title: string
  content: string
  metaDescription: string
  keywords: string[]
} {
  try {
    // Try to extract JSON from response (sometimes wrapped in code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      title: parsed.title || 'Untitled',
      content: parsed.content || '',
      metaDescription: parsed.metaDescription || '',
      keywords: parsed.keywords || []
    }
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    // Fallback: treat entire response as content
    return {
      title: 'Generated Blog Post',
      content: response,
      metaDescription: response.slice(0, 160),
      keywords: []
    }
  }
}

/**
 * Calculate SEO score based on keyword optimization
 */
function calculateSEOScore(params: {
  content: string
  targetKeyword: string
  title: string
  metaDescription: string
}): number {
  const { content, targetKeyword, title, metaDescription } = params
  let score = 0

  const lowerContent = content.toLowerCase()
  const lowerKeyword = targetKeyword.toLowerCase()
  const wordCount = countWords(content)

  // Title contains keyword (20 points)
  if (title.toLowerCase().includes(lowerKeyword)) score += 20

  // Meta description contains keyword (10 points)
  if (metaDescription.toLowerCase().includes(lowerKeyword)) score += 10

  // Keyword in first 100 words (15 points)
  const first100Words = lowerContent.split(/\s+/).slice(0, 100).join(' ')
  if (first100Words.includes(lowerKeyword)) score += 15

  // Keyword density 1-2% (25 points)
  const keywordCount = (lowerContent.match(new RegExp(lowerKeyword, 'g')) || []).length
  const density = (keywordCount / wordCount) * 100
  if (density >= 1 && density <= 2) {
    score += 25
  } else if (density > 0.5 && density < 3) {
    score += 15
  }

  // Word count 1500-2500 (15 points)
  if (wordCount >= 1500 && wordCount <= 2500) score += 15

  // Has FAQ section (10 points)
  if (/## (frequently asked questions|faq)/i.test(content)) score += 10

  // Has headings (5 points)
  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count >= 3) score += 5

  return Math.min(score, 100)
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length
}

/**
 * Save generated blog post to database
 */
export async function saveBlogPost(
  website: Website,
  topicId: string,
  blogPost: BlogPostResult,
  generationPrompt: string
) {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      website,
      title: blogPost.title,
      slug: blogPost.slug,
      content: blogPost.content,
      meta_description: blogPost.metaDescription,
      keywords: blogPost.keywords,
      target_keyword: blogPost.keywords[0] || '',
      seo_score: blogPost.seoScore,
      status: 'pending_review',
      word_count: blogPost.wordCount,
      reading_time_minutes: blogPost.readingTimeMinutes,
      generation_prompt: generationPrompt,
      ai_model: 'deepseek-chat'
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to save blog post:', error)
    throw error
  }

  // Update topic status
  await supabase
    .from('blog_topics')
    .update({
      status: 'generated',
      related_blog_post_id: data.id
    })
    .eq('id', topicId)

  console.log(`💾 Saved to database: ${data.id}`)
  return data
}

/**
 * Generate blog post from topic queue
 */
export async function generateFromQueue(website: Website) {
  // Get highest priority queued topic
  const { data: topic, error } = await supabase
    .from('blog_topics')
    .select('*')
    .eq('website', website)
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !topic) {
    console.log(`ℹ️  No queued topics for ${website}`)
    return null
  }

  console.log(`📝 Generating from queue: "${topic.topic}" (priority: ${topic.priority})`)

  const blogPost = await generateBlogPost({
    website,
    topic: topic.topic,
    targetKeyword: topic.target_keyword || topic.topic,
    searchVolume: topic.search_volume || 0,
    difficulty: topic.difficulty as 'easy' | 'medium' | 'hard'
  })

  const savedPost = await saveBlogPost(
    website,
    topic.id,
    blogPost,
    `Topic: ${topic.topic}\nKeyword: ${topic.target_keyword}\nGenerated: ${new Date().toISOString()}`
  )

  return savedPost
}
