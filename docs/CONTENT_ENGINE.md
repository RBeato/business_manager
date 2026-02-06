# Content Engine: Automated Blog Generation

## Overview

The Content Engine is an AI-powered blog post generation system that automatically creates, schedules, and publishes SEO-optimized blog posts for your websites with human review/approval workflow.

**Supported Websites:**
- healthopenpage.com (Health tracking & lab analysis)
- meditnation.org (AI meditation app)
- riffroutine.com (Guitar practice routines)

---

## Quick Start

### 1. Setup Database

Run the migration in Supabase SQL Editor:

```bash
# Copy contents of supabase/migrations/003_content_engine.sql
# Run in Supabase Dashboard → SQL Editor
```

### 2. Configure Environment Variables

Add to `.env`:

```bash
# Content Engine
GITHUB_TOKEN="ghp_your_github_personal_access_token"  # For creating PRs
DEEPSEEK_API_KEY="sk-your_deepseek_api_key"          # Already configured
```

**Generate GitHub Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Copy token to `.env`

### 3. Seed Topic Queue

Populate the topic queue with 100+ pre-defined topics from SEO guides:

```bash
npm run content:seed
```

**Output:**
```
📝 Seeding healthopenpage...
  ✅ Added: Understanding Ferritin Levels: Complete Guide
  ✅ Added: Cholesterol vs Triglycerides: What's the Difference?
  ...

📊 Summary:
  healthopenpage: 10 queued topics
  meditnation: 10 queued topics
  riffroutine: 10 queued topics
```

### 4. Generate First Blog Post

```bash
# Generate for all websites
npm run content:generate

# Generate for specific website
npm run content:generate healthopenpage
```

**What happens:**
1. Picks highest-priority topic from queue
2. Uses DeepSeek AI to generate 1800-word SEO-optimized post
3. Calculates SEO score (keyword density, structure, etc.)
4. Saves to database with status `pending_review`
5. Sends you an email notification (coming soon)

### 5. Review & Approve

**Manual Review (until dashboard is built):**

```sql
-- View pending posts
SELECT id, website, title, seo_score, created_at
FROM blog_posts
WHERE status = 'pending_review'
ORDER BY created_at DESC;

-- Approve a post
UPDATE blog_posts
SET status = 'approved',
    scheduled_publish_date = NOW() + INTERVAL '1 day'
WHERE id = 'your-post-id-here';

-- Reject a post
UPDATE blog_posts
SET status = 'rejected',
    review_notes = 'Needs more examples'
WHERE id = 'your-post-id-here';
```

### 6. Publish Approved Posts

```bash
npm run content:publish
```

**What happens:**
1. Finds approved posts with scheduled_publish_date <= now
2. Creates GitHub branch with new blog post file
3. Creates Pull Request to main branch
4. Updates sitemap
5. Auto-merges PR (optional) or waits for manual merge

---

## Workflow

### Daily Automated Workflow (Coming Soon - Cron Jobs)

**9:00 AM UTC - Content Generation**
1. Check content calendar for each website
2. Generate 1 post per website (if scheduled)
3. Save as `pending_review`
4. Email notification sent

**Your Review (10 minutes)**
1. Open dashboard at `/content`
2. Preview draft with SEO score
3. Quick edits if needed
4. Approve & schedule for Thursday 9am

**Thursday 9:00 AM UTC - Publishing**
1. Create GitHub PR with blog post
2. Auto-deploy via Vercel
3. Post goes live

---

## Content Calendar

Default publishing schedules:

| Website | Posts/Week | Days | Time (UTC) |
|---------|------------|------|------------|
| healthopenpage.com | 2 | Mon, Thu | 09:00 |
| meditnation.org | 1 | Wed | 10:00 |
| riffroutine.com | 3 | Mon, Wed, Fri | 08:00 |

**Modify schedule:**

```sql
UPDATE content_calendar
SET posts_per_week = 3,
    preferred_publish_days = ARRAY['tuesday', 'thursday', 'saturday']
WHERE website = 'healthopenpage';
```

---

## Topic Management

### Add Custom Topic

```sql
INSERT INTO blog_topics (website, topic, target_keyword, search_volume, difficulty, priority, category)
VALUES (
  'healthopenpage',
  'Complete Guide to Vitamin B12 Deficiency',
  'vitamin b12 deficiency',
  8100,
  'medium',
  9,
  'vitamins'
);
```

### Prioritize Topics

```sql
-- Boost priority (1-10, higher = more urgent)
UPDATE blog_topics
SET priority = 10
WHERE target_keyword = 'ferritin levels';

-- Skip a topic
UPDATE blog_topics
SET status = 'skipped',
    notes = 'Too technical for target audience'
WHERE id = 'topic-id';
```

### View Queue

```sql
-- Next topics to be generated
SELECT website, topic, target_keyword, search_volume, priority
FROM blog_topics
WHERE status = 'queued'
ORDER BY priority DESC, created_at ASC
LIMIT 10;
```

---

## SEO Optimization

### SEO Score Breakdown (0-100)

- **Title contains keyword** (20 points)
- **Meta description contains keyword** (10 points)
- **Keyword in first 100 words** (15 points)
- **Keyword density 1-2%** (25 points)
- **Word count 1500-2500** (15 points)
- **Has FAQ section** (10 points)
- **3+ H2 headings** (5 points)

**Minimum threshold:** 70/100 (posts below 70 should be reviewed)

### AI Generation Prompt

The system uses a comprehensive prompt that ensures:
- Target keyword optimization
- Proper heading structure (H1, H2, H3)
- FAQ section for Google featured snippets
- Conversational tone for AI search (ChatGPT, Perplexity)
- Internal links to website features
- Clear CTAs

---

## Publishing Options

### Option 1: Auto-Merge PRs (Fast, Risky)

```typescript
await publishBlogPost(postId, { autoMerge: true })
```

**Pros:**
- Fully automated
- No manual intervention

**Cons:**
- No final review before production
- Typos/errors go live immediately

### Option 2: Manual GitHub Merge (Safer)

```typescript
await publishBlogPost(postId, { autoMerge: false })
```

**Pros:**
- Final review in GitHub before merge
- Can test build locally
- Safer for production

**Cons:**
- Requires manual merge action
- Slower publishing

**Recommendation:** Use Option 2 until confident in quality

---

## Cost Analysis

### DeepSeek API Pricing

- **Input:** $0.14 per million tokens
- **Output:** $0.28 per million tokens
- **Average 1800-word post:** ~3,000 tokens = **$0.001** per post

### Monthly Costs (Based on Content Calendar)

| Metric | Value |
|--------|-------|
| Posts/month | ~26 (HOP: 8, MeditNation: 4, RiffRoutine: 14) |
| Cost/post | $0.001 |
| **Total/month** | **~$0.03** |

**Time Saved:**
- Manual writing: 26 posts × 3 hours = 78 hours
- Review/approve: 26 posts × 10 min = 4.3 hours
- **Savings:** 73.7 hours/month

**ROI:** Massive (automate 95% of blog writing for pennies)

---

## Monitoring & Analytics

### Track SEO Performance

```sql
-- Add manual metrics
INSERT INTO blog_seo_metrics (blog_post_id, date, impressions, clicks, ctr, average_position)
VALUES ('post-id', '2026-02-10', 150, 8, 5.33, 8.5);

-- View performance
SELECT
  bp.title,
  bsm.impressions,
  bsm.clicks,
  bsm.ctr,
  bsm.average_position
FROM blog_posts bp
JOIN blog_seo_metrics bsm ON bp.id = bsm.blog_post_id
WHERE bp.website = 'healthopenpage'
ORDER BY bsm.date DESC;
```

### Content Stats

```sql
-- Posts by status
SELECT status, COUNT(*) as count
FROM blog_posts
GROUP BY status;

-- Average SEO score by website
SELECT website, AVG(seo_score)::INTEGER as avg_seo_score
FROM blog_posts
WHERE status = 'published'
GROUP BY website;

-- Most popular topics by search volume
SELECT topic, target_keyword, search_volume
FROM blog_topics
WHERE status = 'published'
ORDER BY search_volume DESC
LIMIT 10;
```

---

## Troubleshooting

### "No queued topics for [website]"

**Solution:** Add more topics or re-seed

```bash
npm run content:seed
```

### "Failed to save blog post: duplicate key"

**Cause:** Slug already exists

**Solution:** Topic already generated, check existing posts:

```sql
SELECT * FROM blog_posts WHERE slug LIKE '%your-slug%';
```

### GitHub PR creation fails

**Common issues:**
1. Invalid `GITHUB_TOKEN` - regenerate token with `repo` scope
2. Branch already exists - delete old branch in GitHub
3. File path incorrect - verify `blogPath` in publisher.ts

### Low SEO scores (<70)

**Causes:**
- Keyword not prominent enough
- Content too short/long
- Missing FAQ section
- No headings

**Solution:** Regenerate or manually edit in database before approval

---

## Advanced Usage

### Custom Generation (Programmatic)

```typescript
import { generateBlogPost, saveBlogPost } from './src/content/generator'

const post = await generateBlogPost({
  website: 'healthopenpage',
  topic: 'Complete Guide to Iron Deficiency',
  targetKeyword: 'iron deficiency symptoms',
  searchVolume: 5400,
  difficulty: 'medium',
  wordCount: 2000
})

await saveBlogPost('healthopenpage', 'topic-id', post, 'Custom generation')
```

### Batch Generation

```typescript
// Generate 5 posts at once
for (let i = 0; i < 5; i++) {
  await generateFromQueue('healthopenpage')
  await new Promise(resolve => setTimeout(resolve, 2000)) // Rate limit
}
```

### Manual Publishing

```typescript
import { publishBlogPost } from './src/content/publisher'

// Publish specific post
await publishBlogPost('post-id', {
  autoMerge: false,
  scheduledDate: new Date('2026-02-10T09:00:00Z')
})
```

---

## Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Database schema
- [x] AI generation engine
- [x] GitHub publisher
- [x] CLI scripts
- [x] Topic seeding

### Phase 2: Dashboard UI (Next)
- [ ] `/dashboard/content` page
- [ ] Draft preview & editing
- [ ] One-click approve/reject
- [ ] Topic queue manager
- [ ] SEO score visualization

### Phase 3: Automation (After Dashboard)
- [ ] Daily cron job for generation
- [ ] Publishing cron job
- [ ] Email notifications (draft ready, published)
- [ ] Slack integration (optional)

### Phase 4: Enhancements
- [ ] Image generation (Cloudinary integration)
- [ ] Plagiarism checking
- [ ] Multi-language support (for MeditNation)
- [ ] A/B testing (multiple titles/descriptions)

---

## Best Practices

1. **Review Every Post:** Never auto-publish without human review initially
2. **Monitor SEO Scores:** Aim for 80+ on all posts
3. **Update Topics:** Add new high-volume keywords monthly
4. **Track Performance:** Log GSC metrics to `blog_seo_metrics` table
5. **Iterate Prompts:** Refine generation prompts based on quality

---

## Support

**Issues?**
- Check database logs in Supabase
- Verify environment variables
- Test with single website first
- Review generated content before approval

**Questions?**
- Email: [your-email]
- Slack: #business-manager-content

---

**Status:** Phase 1 Complete ✅
**Next Step:** Build dashboard UI for content management
**Ready for:** Manual testing and review workflow
