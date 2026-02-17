#!/usr/bin/env tsx
/**
 * Generate cover images for RiffRoutine practice routine cards
 * Uses Gemini API to create simple, clean covers for each template routine
 *
 * Usage:
 *   npx tsx scripts/generate-routine-covers.ts          # All templates
 *   npx tsx scripts/generate-routine-covers.ts --dry     # Dry run
 */

import 'dotenv/config'
import { generateRoutineCover, routineCoverExists, sleep } from '../src/content/image-generator'

interface TemplateRoutine {
  id: string
  title: string
  genre: string
  skillLevel: string
  templateCategory: string
}

// Must match the IDs generated in riff_routine/prisma/seed-templates.ts
const TEMPLATE_ROUTINES: TemplateRoutine[] = [
  {
    id: 'template-jazz-beginner',
    title: 'Jazz Foundations',
    genre: 'Jazz',
    skillLevel: 'BEGINNER',
    templateCategory: 'style',
  },
  {
    id: 'template-rock-beginner',
    title: 'Rock Foundations',
    genre: 'Rock',
    skillLevel: 'BEGINNER',
    templateCategory: 'style',
  },
  {
    id: 'template-blues-beginner',
    title: 'Blues Foundations',
    genre: 'Blues',
    skillLevel: 'BEGINNER',
    templateCategory: 'style',
  },
  {
    id: 'template-jazz-intermediate',
    title: 'Jazz Mastery',
    genre: 'Jazz',
    skillLevel: 'INTERMEDIATE',
    templateCategory: 'style',
  },
  {
    id: 'template-rock-intermediate',
    title: 'Rock Mastery',
    genre: 'Rock',
    skillLevel: 'INTERMEDIATE',
    templateCategory: 'style',
  },
  {
    id: 'template-blues-intermediate',
    title: 'Blues Mastery',
    genre: 'Blues',
    skillLevel: 'INTERMEDIATE',
    templateCategory: 'style',
  },
  {
    id: 'template-song-giant-steps',
    title: 'Learn "Giant Steps" by John Coltrane',
    genre: 'Jazz',
    skillLevel: 'INTERMEDIATE',
    templateCategory: 'song',
  },
]

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry')

  console.log('=== Routine Cover Image Generator ===')
  if (dryRun) console.log('[DRY RUN - no images will be generated]\n')

  let generated = 0
  let skipped = 0
  let failed = 0

  for (const routine of TEMPLATE_ROUTINES) {
    if (routineCoverExists(routine.id)) {
      console.log(`  [skip] ${routine.id} (image exists)`)
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  [would generate] ${routine.id}: "${routine.title}"`)
      generated++
      continue
    }

    try {
      const result = await generateRoutineCover({
        routineId: routine.id,
        title: routine.title,
        genre: routine.genre,
        skillLevel: routine.skillLevel,
        templateCategory: routine.templateCategory,
      })
      console.log(`  [done] ${result.relativePath}`)
      generated++

      // Rate limit: wait 3 seconds between API calls
      await sleep(3000)
    } catch (err: any) {
      console.error(`  [FAILED] ${routine.id}: ${err.message}`)
      failed++
      await sleep(2000)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`  Generated: ${generated}`)
  console.log(`  Skipped:   ${skipped}`)
  console.log(`  Failed:    ${failed}`)
  if (dryRun) console.log('\n  [DRY RUN - no images were actually generated]')
  if (!dryRun && generated > 0) {
    console.log(`  Est. cost: ~$${(generated * 0.03).toFixed(2)}`)
    console.log('\nNext steps:')
    console.log('  1. Update DB: UPDATE practice_routines SET "coverImageUrl" = \'/images/routines/\' || id || \'.png\' WHERE "isTemplate" = true;')
    console.log('  2. Review images in: /riff_routine/public/images/routines/')
    console.log('  3. Commit & push riff_routine repo')
  }
}

main().catch(console.error)
