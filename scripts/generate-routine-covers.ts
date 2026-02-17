#!/usr/bin/env tsx
/**
 * Generate cover images for RiffRoutine practice routine cards
 * Uses Gemini API to create simple, clean covers for each routine
 *
 * Usage:
 *   npx tsx scripts/generate-routine-covers.ts              # All routines
 *   npx tsx scripts/generate-routine-covers.ts --dry         # Dry run
 *   npx tsx scripts/generate-routine-covers.ts --force       # Regenerate all (overwrite existing)
 *   npx tsx scripts/generate-routine-covers.ts --db          # Fetch routines from DB instead of hardcoded list
 */

import 'dotenv/config'
import { generateRoutineCover, routineCoverExists, sleep } from '../src/content/image-generator'

interface RoutineInfo {
  id: string
  title: string
  genre: string
  skillLevel: string
  templateCategory: string
}

// All known routines — templates + demo/seed routines
const KNOWN_ROUTINES: RoutineInfo[] = [
  // Template style routines
  { id: 'template-jazz-beginner', title: 'Jazz Foundations', genre: 'Jazz', skillLevel: 'BEGINNER', templateCategory: 'style' },
  { id: 'template-rock-beginner', title: 'Rock Foundations', genre: 'Rock', skillLevel: 'BEGINNER', templateCategory: 'style' },
  { id: 'template-blues-beginner', title: 'Blues Foundations', genre: 'Blues', skillLevel: 'BEGINNER', templateCategory: 'style' },
  { id: 'template-jazz-intermediate', title: 'Jazz Mastery', genre: 'Jazz', skillLevel: 'INTERMEDIATE', templateCategory: 'style' },
  { id: 'template-rock-intermediate', title: 'Rock Mastery', genre: 'Rock', skillLevel: 'INTERMEDIATE', templateCategory: 'style' },
  { id: 'template-blues-intermediate', title: 'Blues Mastery', genre: 'Blues', skillLevel: 'INTERMEDIATE', templateCategory: 'style' },
  // Template song routines
  { id: 'template-song-giant-steps', title: 'Learn "Giant Steps" by John Coltrane', genre: 'Jazz', skillLevel: 'INTERMEDIATE', templateCategory: 'song' },
  // Demo routines
  { id: 'demo-jazz-guitar-fundamentals', title: 'Jazz Guitar Fundamentals', genre: 'Jazz', skillLevel: 'INTERMEDIATE', templateCategory: 'style' },
  { id: 'demo-blues-improvisation-mastery', title: 'Blues Improvisation Mastery', genre: 'Blues', skillLevel: 'INTERMEDIATE', templateCategory: 'style' },
  { id: 'demo-advanced-jazz-standards', title: 'Advanced Jazz Standards', genre: 'Jazz', skillLevel: 'ADVANCED', templateCategory: 'style' },
  { id: 'demo-chopin-etudes-preparation', title: 'Chopin Etudes Preparation', genre: 'Classical', skillLevel: 'ADVANCED', templateCategory: 'style' },
  { id: 'demo-hanon-exercises-reimagined', title: 'Hanon Exercises Reimagined', genre: 'Classical', skillLevel: 'BEGINNER', templateCategory: 'style' },
]

async function fetchRoutinesFromDb(): Promise<RoutineInfo[]> {
  // Dynamic import to avoid requiring prisma when using hardcoded list
  const { PrismaClient } = await import('/Users/rbsou/Documents/CODE/riff_routine/node_modules/@prisma/client/index.js')
  const prisma = new PrismaClient({
    datasourceUrl: process.env.RIFF_ROUTINE_DATABASE_URL,
  })

  try {
    const routines = await prisma.practiceRoutine.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, genre: true, skillLevel: true, templateCategory: true },
    })
    return routines.map((r: any) => ({
      id: r.id,
      title: r.title,
      genre: r.genre || 'Various',
      skillLevel: r.skillLevel || 'INTERMEDIATE',
      templateCategory: r.templateCategory || 'style',
    }))
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry')
  const force = args.includes('--force')
  const useDb = args.includes('--db')

  const routines = useDb ? await fetchRoutinesFromDb() : KNOWN_ROUTINES

  console.log('=== Routine Cover Image Generator ===')
  console.log(`  Routines: ${routines.length}`)
  if (dryRun) console.log('[DRY RUN - no images will be generated]')
  if (force) console.log('[FORCE - overwriting existing images]\n')

  let generated = 0
  let skipped = 0
  let failed = 0

  for (const routine of routines) {
    if (!force && routineCoverExists(routine.id)) {
      console.log(`  [skip] ${routine.id} (image exists)`)
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  [would generate] ${routine.id}: "${routine.title}" (${routine.genre})`)
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
  }
}

main().catch(console.error)
