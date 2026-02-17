#!/usr/bin/env tsx
/**
 * Publish ALL approved blog posts (regardless of scheduled date)
 * Usage: npx tsx scripts/publish-all-approved.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { publishBlogPost } from '../src/content/publisher.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching posts:', error)
    process.exit(1)
  }

  console.log(`Found ${posts.length} approved posts to publish\n`)

  let published = 0
  let failed = 0

  for (const post of posts) {
    try {
      console.log('---')
      const prUrl = await publishBlogPost(post.id)
      published++
    } catch (err: any) {
      console.error(`❌ Failed: ${post.title}`, err.message || err)
      failed++
    }
  }

  console.log(`\n📊 Summary: ✅ ${published} published, ❌ ${failed} failed`)
}

main().catch(console.error)
