import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { website, customTopic, customKeyword, customNotes } = body as {
    website: string
    customTopic?: string
    customKeyword?: string
    customNotes?: string
  }

  if (!website || !(website in WEBSITE_CONFIG)) {
    return NextResponse.json(
      { error: 'Invalid website. Must be: healthopenpage, meditnation, or riffroutine' },
      { status: 400 }
    )
  }

  const site = website as Website
  const config = WEBSITE_CONFIG[site]

  let topicText: string
  let targetKeyword: string
  let searchVolume: number
  let topicId: string | null = null

  if (customTopic) {
    // Custom topic provided by user
    topicText = customTopic
    targetKeyword = customKeyword || customTopic
    searchVolume = 0
  } else {
    // Get highest priority queued topic
    const { data: topic, error: topicError } = await supabase
      .from('blog_topics')
      .select('*')
      .eq('website', site)
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (topicError || !topic) {
      return NextResponse.json(
        { error: `No queued topics for ${website}. Run 'npm run content:seed' to populate.` },
        { status: 404 }
      )
    }

    topicText = topic.topic
    targetKeyword = topic.target_keyword || topic.topic
    searchVolume = topic.search_volume || 0
    topicId = topic.id
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPSEEK_API_KEY not configured' },
      { status: 500 }
    )
  }
  const wordCount = 1800

  const notesSection = customNotes
    ? `\n**Additional Instructions from the Author**:\n${customNotes}\n`
    : ''

  const prompt = `You are an expert SEO content writer for ${config.name}, a ${config.audience} platform.

**Task**: Write a comprehensive, SEO-optimized blog post.

**Topic**: ${topicText}
**Target Keyword**: "${targetKeyword}"${notesSection}
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

  try {
    // Call DeepSeek API (OpenAI-compatible endpoint)
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `DeepSeek API error: ${response.status} ${errText}` },
        { status: 502 }
      )
    }

    const aiResult = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    const responseText = aiResult.choices[0]?.message?.content || ''

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    let parsed: { title: string; metaDescription: string; keywords: string[]; content: string }

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        parsed = {
          title: 'Generated Blog Post',
          content: responseText,
          metaDescription: responseText.slice(0, 160),
          keywords: []
        }
      }
    } else {
      parsed = {
        title: 'Generated Blog Post',
        content: responseText,
        metaDescription: responseText.slice(0, 160),
        keywords: []
      }
    }

    // Calculate SEO score
    const seoScore = calculateSEOScore(parsed.content, targetKeyword, parsed.title, parsed.metaDescription)
    const slug = generateSlug(parsed.title)
    const actualWordCount = parsed.content.split(/\s+/).filter((w: string) => w.length > 0).length
    const readingTime = Math.ceil(actualWordCount / 200)

    // Save to database
    const { data: savedPost, error: saveError } = await supabase
      .from('blog_posts')
      .insert({
        website: site,
        title: parsed.title,
        slug,
        content: parsed.content,
        meta_description: parsed.metaDescription,
        keywords: parsed.keywords,
        target_keyword: targetKeyword,
        seo_score: seoScore,
        status: 'pending_review',
        word_count: actualWordCount,
        reading_time_minutes: readingTime,
        generation_prompt: `Topic: ${topicText}\nKeyword: ${targetKeyword}${customNotes ? `\nNotes: ${customNotes}` : ''}`,
        ai_model: 'deepseek-chat'
      })
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    // Update topic status (only if we used a queued topic)
    if (topicId) {
      await supabase
        .from('blog_topics')
        .update({ status: 'generated', related_blog_post_id: savedPost.id })
        .eq('id', topicId)
    }

    return NextResponse.json(savedPost)
  } catch (err) {
    return NextResponse.json(
      { error: `Generation failed: ${err}` },
      { status: 500 }
    )
  }
}

function calculateSEOScore(content: string, targetKeyword: string, title: string, metaDescription: string): number {
  let score = 0
  const lowerContent = content.toLowerCase()
  const lowerKeyword = targetKeyword.toLowerCase()
  const words = content.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length

  if (title.toLowerCase().includes(lowerKeyword)) score += 20
  if (metaDescription.toLowerCase().includes(lowerKeyword)) score += 10

  const first100Words = words.slice(0, 100).join(' ').toLowerCase()
  if (first100Words.includes(lowerKeyword)) score += 15

  const keywordCount = (lowerContent.match(new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  const density = (keywordCount / wordCount) * 100
  if (density >= 1 && density <= 2) score += 25
  else if (density > 0.5 && density < 3) score += 15

  if (wordCount >= 1500 && wordCount <= 2500) score += 15

  if (/## (frequently asked questions|faq)/i.test(content)) score += 10

  const h2Count = (content.match(/^## /gm) || []).length
  if (h2Count >= 3) score += 5

  return Math.min(score, 100)
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
