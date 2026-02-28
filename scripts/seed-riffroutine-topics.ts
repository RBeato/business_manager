/**
 * Seed high-priority RiffRoutine blog topics from keyword research
 */
import { getDb, newId } from '../src/db/sqlite-client.js'

const db = getDb()

const topics = [
  // Tier S - Priority 1 (highest volume + low competition + direct app conversion)
  { topic: "How Long Should You Practice Guitar? Science-Based Answer", keyword: "how long practice guitar", volume: 12000, priority: 1, difficulty: "medium", category: "fundamentals" },
  { topic: "10 Guitar Warm-Up Exercises You Should Do Every Day", keyword: "guitar warm up exercises", volume: 5000, priority: 1, difficulty: "easy", category: "technique" },
  { topic: "Guitar Scales for Beginners: The 5 Essential Scales You Need", keyword: "guitar scales beginners", volume: 4000, priority: 1, difficulty: "easy", category: "technique" },
  { topic: "The 15-Minute Guitar Practice Routine for Busy People", keyword: "15 minute guitar practice routine", volume: 2500, priority: 1, difficulty: "easy", category: "practice-routine" },
  { topic: "Guitar Practice Plateau: Why You're Stuck and How to Fix It", keyword: "guitar plateau", volume: 3500, priority: 1, difficulty: "medium", category: "fundamentals" },

  // Tier A - Priority 2 (quick wins, low competition, perfect app relevance)
  { topic: "How to Practice Barre Chords Until They Sound Clean", keyword: "how to practice barre chords", volume: 2500, priority: 2, difficulty: "easy", category: "technique" },
  { topic: "Acoustic Guitar Practice Routine: Complete Guide", keyword: "acoustic guitar practice routine", volume: 2500, priority: 2, difficulty: "easy", category: "practice-routine" },
  { topic: "Guitar Finger Independence Exercises: 7 Drills That Work", keyword: "guitar finger exercises", volume: 4500, priority: 2, difficulty: "easy", category: "technique" },
  { topic: "Best Guitar Practice Apps 2026: Honest Comparison", keyword: "best guitar practice app 2026", volume: 4000, priority: 2, difficulty: "medium", category: "commercial" },
  { topic: "30-Day Guitar Practice Challenge: Free Plan", keyword: "guitar practice challenge", volume: 1500, priority: 2, difficulty: "easy", category: "practice-routine" },

  // Tier B - Priority 3 (authority builders, establish topical depth)
  { topic: "How to Improve Guitar Speed: 10 Exercises That Actually Work", keyword: "how to improve guitar speed", volume: 2500, priority: 3, difficulty: "medium", category: "technique" },
  { topic: "Chord Transition Exercises: How to Switch Chords Faster", keyword: "chord transition exercises guitar", volume: 1500, priority: 3, difficulty: "easy", category: "technique" },
  { topic: "Fingerstyle Guitar Practice Routine for Beginners", keyword: "fingerstyle guitar practice", volume: 1500, priority: 3, difficulty: "easy", category: "practice-routine" },
  { topic: "Country Guitar Practice Routine: Twang, Chicken Picking and More", keyword: "country guitar practice routine", volume: 900, priority: 3, difficulty: "easy", category: "practice-routine" },
  { topic: "Funk Guitar Practice Routine: Rhythm, Chords and Groove", keyword: "funk guitar practice routine", volume: 900, priority: 3, difficulty: "easy", category: "practice-routine" },

  // Tier C - Priority 4 (blue ocean, zero competition, unique to RiffRoutine)
  { topic: "AI Guitar Practice: How Personalized Routines Beat Generic Plans", keyword: "AI guitar practice", volume: 500, priority: 4, difficulty: "easy", category: "commercial" },
  { topic: "Guitar Practice for Returning Players: Getting Back After Years Off", keyword: "picking up guitar again after years", volume: 800, priority: 4, difficulty: "easy", category: "fundamentals" },
  { topic: "The Science of Guitar Practice: What Research Says About Learning Guitar", keyword: "guitar practice science", volume: 600, priority: 4, difficulty: "medium", category: "fundamentals" },
  { topic: "How to Track Your Guitar Practice Progress and Why It Matters", keyword: "guitar practice tracker", volume: 700, priority: 4, difficulty: "easy", category: "fundamentals" },
  { topic: "Guitar Practice Schedule Template: Free Printable Weekly Plan", keyword: "guitar practice schedule template", volume: 1500, priority: 4, difficulty: "easy", category: "practice-routine" },
]

let inserted = 0
let skipped = 0

for (const t of topics) {
  const existing = db.prepare(
    "SELECT id FROM blog_topics WHERE website = 'riffroutine' AND target_keyword = ?"
  ).get(t.keyword) as any

  if (existing) {
    console.log(`  Skipped (exists): "${t.topic}"`)
    skipped++
    continue
  }

  const tierLabel = t.priority === 1 ? 'S' : t.priority === 2 ? 'A' : t.priority === 3 ? 'B' : 'C'

  db.prepare(`INSERT INTO blog_topics (id, website, topic, target_keyword, search_volume, difficulty, priority, status, category, notes)
    VALUES (?, 'riffroutine', ?, ?, ?, ?, ?, 'queued', ?, ?)`).run(
    newId(), t.topic, t.keyword, t.volume, t.difficulty, t.priority, t.category,
    `Tier ${tierLabel} - seeded from keyword research`
  )
  console.log(`  Seeded: "${t.topic}" (${t.keyword}, ${t.volume}/mo, P${t.priority})`)
  inserted++
}

console.log(`\nDone: ${inserted} new topics seeded, ${skipped} skipped (already exist)`)
