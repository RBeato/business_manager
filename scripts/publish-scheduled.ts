#!/usr/bin/env tsx
/**
 * Publish scheduled blog posts
 * Usage: npm run content:publish
 */

import 'dotenv/config'
import { publishScheduledPosts } from '../src/content/publisher.js'

async function main() {
  console.log('📅 Publishing Scheduled Posts...\n')

  try {
    await publishScheduledPosts()
  } catch (error) {
    console.error('❌ Publishing failed:', error)
    process.exit(1)
  }

  console.log('\n✅ Publishing complete!')
}

main().catch(console.error)
