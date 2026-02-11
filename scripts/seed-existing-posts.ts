/**
 * Import existing blog posts from website repos into the blog_posts table.
 * These posts were created manually before the Content Engine existed.
 *
 * Usage: npx tsx scripts/seed-existing-posts.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface BlogPostInsert {
  website: string;
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  target_keyword: string;
  seo_score: number;
  status: string;
  word_count: number;
  reading_time_minutes: number;
  published_date: string;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function parseMdxFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

function loadRiffRoutinePosts(): BlogPostInsert[] {
  const blogDir = '/Users/rbsou/Documents/CODE/riff_routine/content/blog';
  if (!existsSync(blogDir)) {
    console.log('  RiffRoutine blog dir not found, skipping');
    return [];
  }

  const files = readdirSync(blogDir).filter(f => f.endsWith('.mdx'));
  const posts: BlogPostInsert[] = [];

  for (const file of files) {
    const raw = readFileSync(join(blogDir, file), 'utf-8');
    const fm = parseMdxFrontmatter(raw);
    // Content is everything after the frontmatter
    const contentStart = raw.indexOf('---', 4);
    const content = contentStart >= 0 ? raw.slice(contentStart + 3).trim() : raw;
    const wordCount = countWords(content);

    posts.push({
      website: 'riffroutine',
      title: fm.title || basename(file, '.mdx'),
      slug: basename(file, '.mdx'),
      content,
      meta_description: fm.description || '',
      target_keyword: fm.category || 'guitar practice',
      seo_score: 75,
      status: 'published',
      word_count: wordCount,
      reading_time_minutes: Math.ceil(wordCount / 250),
      published_date: fm.date || '2026-02-06',
    });
  }

  return posts;
}

function loadHealthOpenPagePosts(): BlogPostInsert[] {
  const posts: BlogPostInsert[] = [];

  // Lab analysis post
  const labPath = '/Users/rbsou/Documents/CODE/open_page/src/app/blog/lab-analysis/page.tsx';
  if (existsSync(labPath)) {
    const content = readFileSync(labPath, 'utf-8');
    const wordCount = countWords(content);
    posts.push({
      website: 'healthopenpage',
      title: 'How to Read Blood Test Results: Complete Lab Analysis Guide 2026',
      slug: 'lab-analysis',
      content: '(React component - see website repo)',
      meta_description: 'Learn how to understand your lab results, interpret biomarkers, and identify concerning values.',
      target_keyword: 'how to read blood test results',
      seo_score: 80,
      status: 'published',
      word_count: wordCount,
      reading_time_minutes: Math.ceil(wordCount / 250),
      published_date: '2026-02-05',
    });
  }

  // DNA analysis post
  const dnaPath = '/Users/rbsou/Documents/CODE/open_page/src/app/blog/dna-analysis-health-recommendations/page.tsx';
  if (existsSync(dnaPath)) {
    const content = readFileSync(dnaPath, 'utf-8');
    const wordCount = countWords(content);
    posts.push({
      website: 'healthopenpage',
      title: 'DNA Analysis for Health: How Genetic Testing Improves Wellness Recommendations',
      slug: 'dna-analysis-health-recommendations',
      content: '(React component - see website repo)',
      meta_description: 'Discover how DNA analysis can personalize your supplements, diet, and exercise.',
      target_keyword: 'DNA analysis health',
      seo_score: 85,
      status: 'published',
      word_count: wordCount,
      reading_time_minutes: Math.ceil(wordCount / 250),
      published_date: '2026-02-10',
    });
  }

  return posts;
}

function loadMeditNationPosts(): BlogPostInsert[] {
  const posts: BlogPostInsert[] = [];
  const blogDir = '/Users/rbsou/Documents/CODE/meditnation_website/app/blog';
  if (!existsSync(blogDir)) {
    console.log('  MeditNation blog dir not found, skipping');
    return [];
  }

  const postData = [
    {
      slug: '5-minute-meditation-techniques',
      title: '5-Minute Meditation Techniques for Busy Professionals',
      meta_description: 'Learn effective 5-minute meditation techniques that fit any schedule.',
      target_keyword: '5 minute meditation',
    },
    {
      slug: 'ai-meditation-vs-traditional',
      title: 'AI Meditation vs Traditional: Which Is Right for You?',
      meta_description: 'Discover how AI-powered meditation differs from traditional practices.',
      target_keyword: 'AI meditation',
    },
    {
      slug: 'multilingual-meditation-benefits',
      title: 'Why Meditation in Your Native Language Matters',
      meta_description: 'Research shows meditation is more effective in your native language.',
      target_keyword: 'multilingual meditation',
    },
  ];

  for (const post of postData) {
    const pagePath = join(blogDir, post.slug, 'page.tsx');
    if (existsSync(pagePath)) {
      const content = readFileSync(pagePath, 'utf-8');
      const wordCount = countWords(content);
      posts.push({
        website: 'meditnation',
        title: post.title,
        slug: post.slug,
        content: '(React component - see website repo)',
        meta_description: post.meta_description,
        target_keyword: post.target_keyword,
        seo_score: 75,
        status: 'published',
        word_count: wordCount,
        reading_time_minutes: Math.ceil(wordCount / 250),
        published_date: '2026-02-06',
      });
    }
  }

  return posts;
}

async function main() {
  console.log('Importing existing blog posts into Supabase...\n');

  const allPosts: BlogPostInsert[] = [];

  console.log('Loading RiffRoutine posts...');
  const rrPosts = loadRiffRoutinePosts();
  console.log(`  Found ${rrPosts.length} posts`);
  allPosts.push(...rrPosts);

  console.log('Loading HealthOpenPage posts...');
  const hopPosts = loadHealthOpenPagePosts();
  console.log(`  Found ${hopPosts.length} posts`);
  allPosts.push(...hopPosts);

  console.log('Loading MeditNation posts...');
  const mnPosts = loadMeditNationPosts();
  console.log(`  Found ${mnPosts.length} posts`);
  allPosts.push(...mnPosts);

  console.log(`\nTotal: ${allPosts.length} posts to import\n`);

  for (const post of allPosts) {
    const { error } = await supabase
      .from('blog_posts')
      .upsert(
        {
          website: post.website,
          slug: post.slug,
          title: post.title,
          content: post.content,
          meta_description: post.meta_description,
          target_keyword: post.target_keyword,
          seo_score: post.seo_score,
          status: post.status,
          word_count: post.word_count,
          reading_time_minutes: post.reading_time_minutes,
          published_date: post.published_date,
        },
        { onConflict: 'website,slug' }
      );

    if (error) {
      console.error(`  FAIL: ${post.website}/${post.slug} — ${error.message}`);
    } else {
      console.log(`  OK: ${post.website}/${post.slug} — "${post.title}" (${post.word_count} words)`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
