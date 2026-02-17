#!/usr/bin/env tsx
/**
 * Generate biomarker pages from topic queue (programmatic SEO)
 * Usage:
 *   npm run content:generate-biomarker healthopenpage        # Generate 1 page
 *   npm run content:generate-biomarker healthopenpage 5       # Generate 5 pages
 *   npm run content:generate-biomarker healthopenpage panel   # Generate 1 panel page
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { generateBiomarkerPage, saveBlogPost } from '../src/content/generator.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Website = 'healthopenpage' | 'meditnation' | 'riffroutine'

async function main() {
  const website = (process.argv[2] || 'healthopenpage') as Website
  const countOrCategory = process.argv[3]

  // Determine if second arg is a count or category filter
  let count = 1
  let categoryFilter: string | null = null

  if (countOrCategory) {
    const parsed = parseInt(countOrCategory)
    if (!isNaN(parsed)) {
      count = parsed
    } else {
      categoryFilter = countOrCategory
    }
  }

  console.log(`\n🧬 Generating biomarker pages for ${website}`)
  console.log(`   Count: ${count}`)
  if (categoryFilter) console.log(`   Category: ${categoryFilter}`)
  console.log()

  let generated = 0
  let failed = 0

  for (let i = 0; i < count; i++) {
    try {
      // Get next queued topic
      let query = supabase
        .from('blog_topics')
        .select('*')
        .eq('website', website)
        .eq('status', 'queued')
        .in('category', ['biomarker', 'panel', 'condition', 'results'])

      if (categoryFilter) {
        query = query.eq('category', categoryFilter)
      }

      const { data: topic, error } = await query
        .order('priority', { ascending: false })
        .order('search_volume', { ascending: false })
        .limit(1)
        .single()

      if (error || !topic) {
        console.log(`ℹ️  No more queued ${categoryFilter || 'biomarker'} topics for ${website}`)
        break
      }

      console.log(`\n[${i + 1}/${count}] 📝 "${topic.topic}" (${topic.category}, priority: ${topic.priority})`)

      const blogPost = await generateBiomarkerPage({
        website,
        topic: topic.topic,
        targetKeyword: topic.target_keyword || topic.topic,
        searchVolume: topic.search_volume || 0,
        difficulty: topic.difficulty as 'easy' | 'medium' | 'hard',
        category: topic.category
      })

      await saveBlogPost(
        website,
        topic.id,
        blogPost,
        `Biomarker: ${topic.topic}\nCategory: ${topic.category}\nKeyword: ${topic.target_keyword}\nGenerated: ${new Date().toISOString()}`
      )

      generated++

      // Small delay between generations to be polite to API
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error(`❌ Generation failed:`, error)
      failed++
    }
  }

  console.log('\n📊 Generation Summary:')
  console.log(`  ✅ Generated: ${generated}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log('\nNext: Review in Supabase, then run: npm run content:publish')
}

main().catch(console.error)
