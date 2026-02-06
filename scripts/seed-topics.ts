#!/usr/bin/env tsx
/**
 * Seed blog topic queue from SEO guides
 * Usage: npm run content:seed
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Topics from SEO guides for each website
const TOPICS = {
  healthopenpage: [
    // Lab Analysis Pillar (already created)
    { topic: 'Understanding Ferritin Levels: Complete Guide', keyword: 'ferritin levels', volume: 2400, difficulty: 'easy', priority: 9, category: 'biomarkers' },
    { topic: 'Cholesterol vs Triglycerides: What\'s the Difference?', keyword: 'cholesterol vs triglycerides', volume: 1200, difficulty: 'easy', priority: 8, category: 'heart-health' },
    { topic: 'Complete Guide to HbA1c Testing', keyword: 'hba1c test', volume: 3600, difficulty: 'medium', priority: 9, category: 'diabetes' },
    { topic: 'How to Lower LDL Cholesterol Naturally', keyword: 'lower ldl cholesterol', volume: 4800, difficulty: 'medium', priority: 8, category: 'heart-health' },
    { topic: 'Normal Thyroid Levels: TSH, T3, T4 Explained', keyword: 'normal thyroid levels', volume: 2900, difficulty: 'easy', priority: 7, category: 'thyroid' },
    { topic: 'High Triglycerides: Causes and Treatment', keyword: 'high triglycerides', volume: 5400, difficulty: 'medium', priority: 7, category: 'heart-health' },
    { topic: 'Complete Blood Count (CBC) Results Explained', keyword: 'cbc results explained', volume: 1800, difficulty: 'easy', priority: 6, category: 'lab-analysis' },
    { topic: 'Low Ferritin: Symptoms and Treatment', keyword: 'low ferritin', volume: 3200, difficulty: 'easy', priority: 8, category: 'biomarkers' },
    { topic: 'Optimal Vitamin D Levels for Health', keyword: 'optimal vitamin d levels', volume: 2100, difficulty: 'easy', priority: 7, category: 'vitamins' },
    { topic: 'Understanding Liver Function Tests (LFT)', keyword: 'liver function test', volume: 4100, difficulty: 'medium', priority: 6, category: 'lab-analysis' },
  ],

  meditnation: [
    // AI Meditation Topics
    { topic: 'AI Meditation vs Traditional Meditation: Complete Comparison', keyword: 'ai meditation', volume: 500, difficulty: 'easy', priority: 10, category: 'ai-meditation' },
    { topic: '5-Minute Meditation Techniques That Actually Work', keyword: '5 minute meditation', volume: 12000, difficulty: 'hard', priority: 9, category: 'quick-meditation' },
    { topic: 'Meditation for Busy Professionals: Complete Guide', keyword: 'meditation for professionals', volume: 800, difficulty: 'medium', priority: 8, category: 'professional-wellness' },
    { topic: 'Multilingual Meditation: Benefits of Native Language Practice', keyword: 'multilingual meditation', volume: 200, difficulty: 'easy', priority: 9, category: 'multilingual' },
    { topic: 'How to Build a Daily Meditation Habit', keyword: 'daily meditation habit', volume: 1400, difficulty: 'easy', priority: 7, category: 'habit-building' },
    { topic: 'Meditation for Anxiety: Science-Backed Techniques', keyword: 'meditation for anxiety', volume: 6600, difficulty: 'hard', priority: 8, category: 'mental-health' },
    { topic: 'Guided Meditation vs Unguided: Which is Better?', keyword: 'guided meditation vs unguided', volume: 400, difficulty: 'easy', priority: 6, category: 'meditation-types' },
    { topic: 'Meditation in Spanish: Complete Beginner\'s Guide', keyword: 'meditation in spanish', volume: 300, difficulty: 'easy', priority: 7, category: 'multilingual' },
    { topic: 'Sleep Meditation Techniques for Insomnia', keyword: 'sleep meditation', volume: 8100, difficulty: 'hard', priority: 7, category: 'sleep' },
    { topic: 'Morning Meditation Routine: 10-Minute Practice', keyword: 'morning meditation', volume: 2400, difficulty: 'medium', priority: 6, category: 'daily-practice' },
  ],

  riffroutine: [
    // Famous Guitarist Practice Routines (highest priority - zero competition)
    { topic: 'John Mayer Practice Routine: How He Practices Guitar', keyword: 'john mayer practice routine', volume: 400, difficulty: 'easy', priority: 10, category: 'famous-guitarists' },
    { topic: 'Steve Vai Practice Routine: Complete Guide', keyword: 'steve vai practice routine', volume: 300, difficulty: 'easy', priority: 10, category: 'famous-guitarists' },
    { topic: 'Guthrie Govan Practice Routine Breakdown', keyword: 'guthrie govan practice', volume: 250, difficulty: 'easy', priority: 9, category: 'famous-guitarists' },
    { topic: 'John Petrucci Practice Routine: How Dream Theater\'s Guitarist Practices', keyword: 'john petrucci practice', volume: 350, difficulty: 'easy', priority: 9, category: 'famous-guitarists' },
    { topic: 'Mark Tremonti Practice Routine and Techniques', keyword: 'mark tremonti practice', volume: 200, difficulty: 'easy', priority: 8, category: 'famous-guitarists' },

    // Technique Guides
    { topic: 'How to Practice Alternate Picking: Complete Guide', keyword: 'how to practice alternate picking', volume: 800, difficulty: 'medium', priority: 8, category: 'techniques' },
    { topic: 'Sweep Picking Practice Guide for Beginners', keyword: 'sweep picking practice', volume: 600, difficulty: 'medium', priority: 7, category: 'techniques' },
    { topic: 'Legato Technique: Practice Exercises and Tips', keyword: 'legato technique guitar', volume: 500, difficulty: 'medium', priority: 7, category: 'techniques' },

    // Genre-Specific
    { topic: 'Metal Guitar Practice Routine: Complete Guide', keyword: 'metal guitar practice routine', volume: 400, difficulty: 'easy', priority: 8, category: 'genre' },
    { topic: 'Jazz Guitar Practice Schedule for Beginners', keyword: 'jazz guitar practice', volume: 700, difficulty: 'medium', priority: 7, category: 'genre' },
  ],
}

async function main() {
  console.log('🌱 Seeding Blog Topics...\n')

  for (const [website, topics] of Object.entries(TOPICS)) {
    console.log(`\n📝 Seeding ${website}...`)

    for (const topic of topics) {
      try {
        const { error } = await supabase
          .from('blog_topics')
          .insert({
            website,
            topic: topic.topic,
            target_keyword: topic.keyword,
            search_volume: topic.volume,
            difficulty: topic.difficulty,
            priority: topic.priority,
            category: topic.category,
            status: 'queued'
          })

        if (error) {
          // Ignore duplicate errors
          if (error.code !== '23505') {
            console.error(`  ❌ Error: ${topic.topic}`, error.message)
          }
        } else {
          console.log(`  ✅ Added: ${topic.topic}`)
        }
      } catch (error) {
        console.error(`  ❌ Failed: ${topic.topic}`, error)
      }
    }
  }

  // Print summary
  console.log('\n📊 Summary:')
  for (const website of Object.keys(TOPICS)) {
    const { count } = await supabase
      .from('blog_topics')
      .select('*', { count: 'exact', head: true })
      .eq('website', website)
      .eq('status', 'queued')

    console.log(`  ${website}: ${count} queued topics`)
  }

  console.log('\n✅ Topic seeding complete!')
}

main().catch(console.error)
