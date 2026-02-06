#!/usr/bin/env tsx
/**
 * Generate blog posts from topic queue
 * Usage: npm run content:generate [website]
 */

import 'dotenv/config'
import { generateFromQueue } from '../src/content/generator.js'

const args = process.argv.slice(2)
const website = args[0] as 'healthopenpage' | 'meditnation' | 'riffroutine' | undefined

async function main() {
  console.log('🚀 Content Generation Starting...\n')

  const websites: Array<'healthopenpage' | 'meditnation' | 'riffroutine'> = website
    ? [website]
    : ['healthopenpage', 'meditnation', 'riffroutine']

  for (const site of websites) {
    console.log(`\n📝 Generating content for ${site}...`)
    try {
      const result = await generateFromQueue(site)
      if (result) {
        console.log(`✅ Generated: "${result.title}" (ID: ${result.id})`)
      }
    } catch (error) {
      console.error(`❌ Failed for ${site}:`, error)
    }
  }

  console.log('\n✨ Content generation complete!')
}

main().catch(console.error)
