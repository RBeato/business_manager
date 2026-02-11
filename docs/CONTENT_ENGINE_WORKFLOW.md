# Content Engine Workflow Guide

**Purpose**: Automated blog post generation for healthopenpage.com, meditnation.org, and riffroutine.com with AI-powered content creation and approval workflow.

**Problem Solved**: Writing SEO blog posts manually takes 3+ hours per post. This system generates SEO-optimized posts in minutes, you just review and approve.

---

## How It Works (Big Picture)

```
Topic Queue → AI Generation → Your Review → Approval → GitHub PR → Published Blog
```

### The 6-Step Process

1. **Topic Queue Populated** (one-time setup)
   - 30+ blog topics seeded from SEO guides
   - Topics prioritized by search volume and SEO value
   - Stored in `blog_topics` table

2. **AI Generates Content** (automated or manual)
   - DeepSeek AI writes 1,500+ word blog posts
   - Optimized for target keywords (e.g., "how to read ferritin levels")
   - Includes FAQs, step-by-step guides, CTAs
   - Cost: ~$0.001 per post

3. **SEO Scoring** (automatic)
   - Algorithm scores content 0-100 based on:
     - Keyword density (5-8% target)
     - Heading structure (H1, H2, H3 hierarchy)
     - FAQ section presence
     - Word count (1,500+ words)
     - Internal/external links
   - Posts with score <70 flagged for improvement

4. **Your Review** (manual approval)
   - System emails you: "New draft ready for healthopenpage.com"
   - You review content in dashboard (or SQL for now)
   - Options: Approve, Reject, Request edits
   - Average review time: 10 minutes

5. **Publishing** (automated)
   - Approved posts convert to Next.js blog page files
   - GitHub PR created automatically
   - Sitemap updated for SEO
   - Optional auto-merge if you trust the content

6. **Performance Tracking** (post-publish)
   - Google Search Console integration
   - Track impressions, clicks, rankings
   - Stored in `blog_seo_metrics` table

---

## Database Schema

### `blog_posts` - Generated Content
```sql
{
  id: "uuid",
  website: "healthopenpage" | "meditnation" | "riffroutine",
  title: "How to Read Your Ferritin Blood Test Results",
  slug: "how-to-read-ferritin-test-results",
  content: "# Full markdown blog post...",
  status: "draft" | "pending_review" | "approved" | "published" | "rejected",
  seo_score: 85,
  target_keyword: "ferritin blood test",
  scheduled_date: "2026-02-10",
  published_at: null,
  github_pr_url: null
}
```

**Status Flow:**
- `draft` → Initial AI generation
- `pending_review` → Ready for your approval
- `approved` → You approved, waiting for publish
- `published` → Live on website
- `rejected` → You rejected, topic returns to queue

### `blog_topics` - Topic Queue
```sql
{
  id: "uuid",
  website: "healthopenpage",
  topic: "How to Read Ferritin Levels in Blood Tests",
  target_keyword: "ferritin blood test",
  search_volume: 8100,
  priority: 1,  // 1 = highest
  status: "pending" | "in_progress" | "completed",
  assigned_post_id: null
}
```

### `content_calendar` - Publishing Schedule
```sql
{
  id: "uuid",
  website: "healthopenpage",
  posts_per_week: 2,
  target_weekdays: ["Tuesday", "Friday"],
  target_hour: 9,  // 9am publish time
  timezone: "America/New_York",
  auto_publish: false  // Manual approval for now
}
```

### `blog_seo_metrics` - Performance Tracking
```sql
{
  id: "uuid",
  blog_post_id: "uuid",
  date: "2026-02-10",
  impressions: 234,
  clicks: 12,
  average_position: 15.3,
  ctr: 5.1
}
```

---

## CLI Commands

### 1. Seed Topics (One-Time Setup)
```bash
npm run content:seed
```

**What it does:**
- Reads SEO guides from all 3 websites
- Extracts 30+ blog topics with keywords
- Populates `blog_topics` table
- Sets priority based on search volume

**When to run:**
- Initial setup (now)
- After creating new SEO guides
- When topic queue is empty

### 2. Generate Blog Posts (Manual or Cron)
```bash
# Generate one post for specific website
npm run content:generate healthopenpage

# Generate for all websites
npm run content:generate healthopenpage
npm run content:generate meditnation
npm run content:generate riffroutine
```

**What it does:**
1. Finds highest priority topic in queue
2. Calls DeepSeek AI with detailed prompt:
   - Target keyword and search intent
   - Website-specific tone (clinical for HOP, calming for MeditNation)
   - Required sections (intro, FAQ, CTA)
   - Word count target (1,500+)
3. Scores generated content (SEO algorithm)
4. Saves as `pending_review` in database
5. Marks topic as `in_progress`

**Output example:**
```
✓ Generated: "How to Read Your Ferritin Blood Test Results"
  SEO Score: 87/100
  Word Count: 1,842
  Target Keyword: "ferritin blood test" (8,100 searches/month)
  Status: pending_review

  → Review at: http://localhost:3000/dashboard/content
```

### 3. Publish Approved Posts (Manual or Cron)
```bash
npm run content:publish
```

**What it does:**
1. Finds all posts with status = `approved`
2. For each post:
   - Creates new Git branch (e.g., `blog/ferritin-test-results`)
   - Generates Next.js blog page file with metadata
   - Updates sitemap.ts with new blog URL
   - Creates GitHub Pull Request
   - Optionally auto-merges if `auto_publish: true`
3. Updates post status to `published`
4. Sets `published_at` timestamp

**Output example:**
```
✓ Published: "How to Read Your Ferritin Blood Test Results"
  Website: healthopenpage.com
  PR: https://github.com/RBeato/open_page/pull/42
  Auto-merged: No (manual merge required)
  Live URL: https://www.healthopenpage.com/blog/ferritin-test-results
```

---

## Manual Review Workflow (Until Dashboard UI Built)

### Step 1: Check for Pending Drafts
```sql
SELECT id, website, title, seo_score, created_at
FROM blog_posts
WHERE status = 'pending_review'
ORDER BY created_at DESC;
```

### Step 2: Review Content
```sql
SELECT content
FROM blog_posts
WHERE id = 'your-post-id-here';
```

Copy content to markdown editor and review:
- ✓ Keyword optimization (not stuffed)
- ✓ Accurate information (especially for health content)
- ✓ Proper CTAs (trial signup for HOP, app download for MeditNation)
- ✓ Internal links to relevant pages

### Step 3: Approve or Reject

**Approve:**
```sql
UPDATE blog_posts
SET status = 'approved'
WHERE id = 'your-post-id-here';
```

**Reject (topic returns to queue):**
```sql
UPDATE blog_posts
SET status = 'rejected'
WHERE id = 'your-post-id-here';

-- Reset topic so it can be regenerated
UPDATE blog_topics
SET status = 'pending', assigned_post_id = NULL
WHERE assigned_post_id = 'your-post-id-here';
```

### Step 4: Publish
```bash
npm run content:publish
```

---

## Automation (Phase 3 - Future)

### Scheduled Generation (Cron Job)
```typescript
// Vercel cron: Every Monday 9am
// /api/cron/generate-weekly-posts

async function generateWeeklyPosts() {
  const websites = ['healthopenpage', 'meditnation', 'riffroutine'];

  for (const website of websites) {
    const calendar = await getContentCalendar(website);
    const postsNeeded = calendar.posts_per_week;

    for (let i = 0; i < postsNeeded; i++) {
      await generateBlogPost({ website });
    }
  }

  // Email: "5 new drafts ready for review"
}
```

### Scheduled Publishing (Cron Job)
```typescript
// Vercel cron: Daily at configured publish time
// /api/cron/publish-scheduled-posts

async function publishScheduledPosts() {
  const today = new Date();

  const readyPosts = await prisma.blog_posts.findMany({
    where: {
      status: 'approved',
      scheduled_date: today,
    }
  });

  for (const post of readyPosts) {
    await publishBlogPost(post.id);
  }
}
```

---

## Website-Specific Configurations

### healthopenpage.com
```typescript
{
  tone: "Clinical but accessible, evidence-based",
  audience: "Health-conscious users seeking lab test insights",
  ctas: [
    "Try HOP Health Tracker free trial",
    "Upload your lab results for AI analysis"
  ],
  internalLinks: [
    "/labs/analyze",
    "/subscription",
    "/blog"
  ],
  contentCalendar: {
    posts_per_week: 2,
    target_weekdays: ["Tuesday", "Friday"],
    categories: ["Lab Analysis", "Biomarkers", "Preventive Health"]
  }
}
```

### meditnation.org
```typescript
{
  tone: "Calming, inclusive, evidence-based mindfulness",
  audience: "Meditation beginners and multilingual users",
  ctas: [
    "Download MeditNation app",
    "Start your first 5-minute meditation"
  ],
  internalLinks: [
    "/features/ai-meditation",
    "/features/10-languages",
    "/download"
  ],
  contentCalendar: {
    posts_per_week: 1,
    target_weekdays: ["Wednesday"],
    categories: ["Meditation Techniques", "Mindfulness Science", "AI Personalization"]
  }
}
```

### riffroutine.com
```typescript
{
  tone: "Enthusiastic, technical, musician-focused",
  audience: "Intermediate guitarists seeking structured practice",
  ctas: [
    "Download RiffRoutine app",
    "Try Eddie Van Halen's practice routine"
  ],
  internalLinks: [
    "/routines/famous-guitarists",
    "/features/practice-tracking",
    "/download"
  ],
  contentCalendar: {
    posts_per_week: 1,
    target_weekdays: ["Monday"],
    categories: ["Famous Guitarist Routines", "Technique Guides", "Practice Tips"]
  }
}
```

---

## SEO Optimization Details

### Keyword Optimization
- **Target Density**: 5-8% (not stuffed)
- **Placement**: Title, H1, first paragraph, conclusion
- **Variations**: Long-tail keywords included (e.g., "how to read ferritin test results" + "understanding ferritin levels")

### Content Structure
```markdown
# Main Title (H1) - Includes target keyword
## Introduction (150 words)
- Hook with problem statement
- Promise of solution
- Target keyword in first paragraph

## Main Content Sections (H2)
### Subsections (H3)
- Step-by-step explanations
- Visual descriptions (for future images)
- Internal links to related pages

## FAQ Section (H2)
### Question 1 (H3) - Long-tail keyword
Answer with target keyword

### Question 2 (H3) - Related query
Answer with semantic variations

## Conclusion (H2)
- Summary of key points
- Strong CTA with internal link
- Final keyword mention
```

### Internal Linking Strategy
- **HOP**: Link lab analysis posts to `/labs/analyze`, `/subscription`
- **MeditNation**: Link meditation technique posts to `/features/ai-meditation`
- **RiffRoutine**: Link guitarist routine posts to `/routines/[guitarist-name]`

### Meta Tags (Auto-Generated)
```typescript
export const metadata = {
  title: "How to Read Your Ferritin Blood Test Results | HOP Health",
  description: "Learn to interpret ferritin levels in blood tests. Expert guide with normal ranges, symptoms of deficiency, and when to see a doctor.",
  keywords: ["ferritin blood test", "ferritin levels", "iron deficiency"],
  openGraph: {
    title: "How to Read Your Ferritin Blood Test Results",
    description: "Expert guide to understanding ferritin in lab tests",
    images: ['/og-image-ferritin.jpg']
  }
}
```

---

## Cost & Time Analysis

### Manual Blog Post Creation (Old Way)
- Research: 1 hour
- Writing: 2 hours
- SEO optimization: 30 minutes
- **Total: 3.5 hours per post**

### Automated Blog Post Creation (New Way)
- AI generation: 30 seconds
- Your review: 10 minutes
- **Total: 10 minutes per post**

### Cost Breakdown
- DeepSeek API: $0.001 per post (~1,500 tokens)
- GitHub API: Free (unlimited)
- **Total: ~$0.001 per post**

### Monthly Savings (All 3 Websites)
- Posts per month: 4 * 4 weeks = 16 posts
- Old way: 16 posts × 3.5 hours = **56 hours/month**
- New way: 16 posts × 10 minutes = **2.67 hours/month**
- **Time saved: 53.33 hours/month**

---

## Troubleshooting

### "No topics found in queue"
**Solution:** Run `npm run content:seed` to populate topic queue

### "GitHub API error: Bad credentials"
**Solution:** Check `GITHUB_TOKEN` in `.env` - regenerate if expired

### "DeepSeek API error: Rate limit"
**Solution:** DeepSeek has generous limits, but if hit, wait 1 minute

### "Low SEO score (<70)"
**Possible causes:**
- Keyword density too low/high
- Missing FAQ section
- Word count under 1,500
- No internal links

**Solution:** Reject post and regenerate with better prompt

### "Blog post published but not in sitemap"
**Solution:** Check `sitemap.ts` in website repo - should be auto-updated by publisher

---

## Roadmap

### Phase 1 (Current) ✅
- AI blog generation
- GitHub PR publishing
- Manual approval via SQL
- Topic queue management

### Phase 2 (Next)
- Dashboard UI at `/dashboard/content`
- One-click approve/reject buttons
- Content preview with SEO score
- Email notifications for new drafts

### Phase 3 (Future)
- Automated cron jobs (weekly generation, daily publishing)
- Google Search Console integration
- A/B testing for titles/descriptions
- Image generation (AI-powered featured images)
- Bulk operations (approve 5 posts at once)

---

## Quick Reference

### Common Tasks

**Generate 1 post for HOP:**
```bash
npm run content:generate healthopenpage
```

**Check pending drafts:**
```sql
SELECT * FROM blog_posts WHERE status = 'pending_review';
```

**Approve post:**
```sql
UPDATE blog_posts SET status = 'approved' WHERE id = 'xxx';
```

**Publish all approved:**
```bash
npm run content:publish
```

**Check topic queue:**
```sql
SELECT * FROM blog_topics WHERE status = 'pending' ORDER BY priority;
```

**Add new topic manually:**
```sql
INSERT INTO blog_topics (website, topic, target_keyword, search_volume, priority)
VALUES ('healthopenpage', 'Understanding TSH Levels', 'tsh blood test', 5400, 2);
```

---

## Support

- **Documentation**: `/docs/CONTENT_ENGINE.md` (technical reference)
- **Workflow Guide**: This file (how to use)
- **Database Schema**: `/supabase/migrations/003_content_engine.sql`
- **Generator Code**: `/src/content/generator.ts`
- **Publisher Code**: `/src/content/publisher.ts`

---

**Status**: Phase 1 Complete ✅
**Ready for**: Manual testing and review workflow
**Next**: Run setup instructions and generate first test post
