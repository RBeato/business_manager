# Business Manager - Claude Project Context

## Project Overview
**Business Metrics Hub + Content Engine** - A dual-purpose system:
1. **Revenue Tracking**: Aggregates revenue, subscriptions, costs, and metrics across multiple apps
2. **Content Engine**: Automated blog generation for SEO optimization across 3 websites (healthopenpage.com, meditnation.org, riffroutine.com)

**Important**: This is a **local CLI tool**, NOT a hosted service. It runs on the user's Mac and manages content for separate hosted websites.

## Periodic Tasks

### Check for New Projects to Integrate
**At the start of each session**, scan `/Users/rbsou/Documents/CODE/` for new projects that could be integrated into business_manager.

For each new project found:
1. Check if it's an app that should be tracked (mobile, web, API)
2. Look for existing API keys/credentials in the project's `.env` or config files
3. If API keys are missing for required integrations, **request them from the user**:
   - RevenueCat v2 secret API key (for subscription/revenue tracking)
   - App Store Connect credentials (for iOS apps)
   - Google Play credentials (for Android apps)
   - Firebase/GA4 credentials (for analytics)
   - Any AI provider keys the project uses

**Key integrations to check:**
- RevenueCat (subscriptions, revenue, MRR)
- App Store Connect (iOS installs, revenue)
- Google Play Console (Android installs, revenue)
- Firebase/GA4 (analytics, DAU, sessions)
- AI providers (DeepSeek, ElevenLabs, Cartesia, OpenAI, etc.)

### Current Apps Tracked
- Guitar Progression Generator (`proj7de6dd64`)
- SM Guitar (`proj5354f5b1`)
- Ear N Play (`proja5c9fbee`)
- Meditnation Mobile (`proj01dc0e06`)
- Health Open Page (`proj0118fd68`)
- Meditnation Website (web only, no RevenueCat)

## Configuration Notes

### RevenueCat
- Uses **v2 API** - requires project-specific secret keys
- Legacy v1 keys don't work for metrics endpoints
- Each app needs its own `REVENUECAT_<APP>_SECRET_API_KEY` in `.env`
- Project IDs start with `proj` (not `appl_` which are iOS app IDs)

### Portugal Tax Assumptions
- Store fee: 15% (Apple/Google Small Business Program, <$1M revenue)
- IRS: ~25% effective on 75% of income (regime simplificado)
- Seguranca Social: 21.4% on 70% of income
- Combined effective tax rate: ~30-35%

## Dashboard
- Location: `/dashboard` (Next.js app)
- Run: `cd dashboard && npm run dev`
- Port: 3002 (default 3000 often in use)
- Shows: Revenue, MRR, costs, API credit status, per-app metrics
- **Future**: Content Engine UI for blog approval workflow

## Key Files

### Revenue Tracking
- `.env` - All API keys and credentials
- `src/ingestion/` - Data source integrations
- `src/monitoring/credits.ts` - API credit checking
- `dashboard/src/app/api/credits/route.ts` - Dashboard credit API

### Content Engine
- `src/content/generator.ts` - AI blog post generator (DeepSeek via OpenAI SDK)
- `src/content/publisher.ts` - GitHub PR publisher (needs token fix)
- `scripts/publish-local.ts` - Local publisher (creates page.tsx files directly in website repos)
- `scripts/generate-content.ts` - CLI: Generate general blog posts
- `scripts/generate-biomarker.ts` - CLI: Generate biomarker pages (programmatic SEO)
- `scripts/seed-biomarkers.ts` - CLI: Seed 162 biomarker topics
- `scripts/publish-scheduled.ts` - CLI: Publish approved posts via GitHub PRs
- `scripts/seed-topics.ts` - CLI: Populate general topic queues
- `supabase/migrations/003_content_engine.sql` - Database schema
- `docs/CONTENT_ENGINE.md` - Technical reference
- `docs/CONTENT_ENGINE_WORKFLOW.md` - Usage guide

### Project Status & TODOs
- `docs/TODO.md` - Complete project status, TODO list, known issues, and roadmap

---

# Content Engine Documentation

## Quick Start

**Status**: Phase 1 Complete ✅ (Backend + CLI)
**Next**: Phase 2 (Dashboard UI for approval workflow)

### Prerequisites
- ✅ Supabase configured: `ptndtjbyguhixwgbnfsm.supabase.co`
- ✅ DeepSeek API key configured
- ⏳ GitHub token needed (see setup below)
- ⏳ Database migration needed (see setup below)

### What It Does
Generates SEO-optimized blog posts for 3 websites using AI:
- **healthopenpage.com**: Lab analysis guides (e.g., "How to Read Ferritin Levels")
- **meditnation.org**: Meditation technique guides (e.g., "5-Minute Meditation for Beginners")
- **riffroutine.com**: Guitar practice guides (e.g., "Eddie Van Halen's Practice Routine")

### How It Works
```
Topic Queue (30+ SEO ideas)
  ↓
AI Generates Blog Post (DeepSeek, $0.001/post)
  ↓
AI Generates Featured Image (Gemini, $0.03/image)
  ↓
User Reviews & Approves (10 min)
  ↓
GitHub PR Created Automatically
  ↓
Published to Website (Vercel auto-deploy)
```

**Time Savings**: 3.5 hours → 10 minutes per post

### Blog Image Rules (MANDATORY)

**Every blog post MUST have a featured image.** Posts without images should not be published.

**Image sources by content type:**
- **Health/Medical content (HOP)**: AI-generated via Gemini API. Professional medical illustrations, lab equipment, biomarker visualizations. Blue/teal palette.
- **Meditation content (MeditNation)**: AI-generated via Gemini API. Serene scenes, nature, meditation poses. Golden/warm palette.
- **Guitar general content (RiffRoutine)**: AI-generated via Gemini API. Guitars, music studios, practice scenes. Violet/purple palette.
- **Guitarist-specific content (RiffRoutine)**: Use **copyright-free photos** of the actual guitarist from Wikimedia Commons (CC-BY, CC-BY-SA, CC0). Always add attribution to `public/images/blog/CREDITS.md`. Only fall back to AI-generated if no CC photo exists.

**Image specs:**
- Aspect ratio: 16:9 (hero image)
- Storage: `/public/images/blog/{slug}.png` (AI) or `.jpg` (photos)
- Displayed as hero image between header and article content
- Included in OpenGraph and Twitter metadata for social sharing
- Generated automatically during `npm run content:generate`
- Backfill existing posts: `npm run content:generate-images` + `npm run content:backfill-images`

---

## Setup Instructions (First Time Only)

### 1. Install Dependencies
```bash
cd /Users/rbsou/Documents/CODE/business_manager
npm install
```

**What it installs**: `@octokit/rest` (GitHub API for creating PRs)

### 2. Run Database Migration

**Location**: Open Supabase dashboard → SQL Editor
**Project**: `ptndtjbyguhixwgbnfsm.supabase.co`
**File to run**: `supabase/migrations/003_content_engine.sql`

**What it creates**:
- `blog_posts` - Generated content with approval workflow
- `blog_topics` - Queue of topics to write about
- `content_calendar` - Publishing schedule per website
- `blog_seo_metrics` - Performance tracking

**Pre-seeded data**:
- Content calendars for all 3 websites:
  - healthopenpage: 2 posts/week (Tuesday, Friday, 9am)
  - meditnation: 1 post/week (Wednesday, 9am)
  - riffroutine: 1 post/week (Monday, 9am)

### 3. Add GitHub Token to `.env`

**Generate token**:
1. Go to GitHub.com → Settings → Developer settings
2. Personal access tokens → Tokens (classic) → Generate new token
3. Select scope: `repo` (full control of private repositories)
4. Copy token (starts with `ghp_`)

**Add to `.env`**:
```bash
GITHUB_TOKEN="ghp_your_token_here"
```

**What it's used for**:
- Creating branches for blog posts
- Creating pull requests
- Updating sitemaps
- Optional auto-merge

### 4. Seed Topic Queues
```bash
npm run content:seed
```

**What it does**:
- Reads SEO guides from all 3 website projects
- Extracts 30+ blog topic ideas with target keywords
- Populates `blog_topics` table with priorities
- Topics come from existing SEO_OPTIMIZATION_GUIDE.md files

**Expected output**:
```
✓ Seeded 12 topics for healthopenpage
✓ Seeded 10 topics for meditnation
✓ Seeded 8 topics for riffroutine
```

### 5. Test Blog Generation
```bash
npm run content:generate healthopenpage
```

**What happens**:
1. Finds highest priority topic (e.g., "How to Read Ferritin Levels")
2. Calls DeepSeek AI with detailed SEO prompt
3. Generates 1,500+ word blog post
4. Scores content 0-100 (keyword density, headings, FAQs)
5. Saves to database with status = `pending_review`

**Expected output**:
```
✓ Generated: "How to Read Your Ferritin Blood Test Results"
  SEO Score: 87/100
  Word Count: 1,842
  Target Keyword: "ferritin blood test" (8,100 searches/month)
  Status: pending_review

  → Review in Supabase or wait for dashboard UI
```

---

## Daily Workflow (Manual Review - Phase 1)

### Step 1: Generate Blog Posts
```bash
# Generate for one website
npm run content:generate healthopenpage

# Or generate for all 3
npm run content:generate healthopenpage
npm run content:generate meditnation
npm run content:generate riffroutine
```

### Step 2: Review Content (Supabase SQL Editor)

**Check for pending drafts**:
```sql
SELECT id, website, title, seo_score, created_at
FROM blog_posts
WHERE status = 'pending_review'
ORDER BY created_at DESC;
```

**View content**:
```sql
SELECT content
FROM blog_posts
WHERE id = 'paste-id-here';
```

**Review checklist**:
- ✓ Keyword optimization (not stuffed)
- ✓ Accurate information (especially health content)
- ✓ Proper CTAs (trial signup, app download)
- ✓ Internal links to relevant pages

### Step 3: Approve or Reject

**Approve** (ready to publish):
```sql
UPDATE blog_posts
SET status = 'approved'
WHERE id = 'paste-id-here';
```

**Reject** (regenerate later):
```sql
UPDATE blog_posts
SET status = 'rejected'
WHERE id = 'paste-id-here';

-- Reset topic so it can be regenerated
UPDATE blog_topics
SET status = 'pending', assigned_post_id = NULL
WHERE assigned_post_id = 'paste-id-here';
```

### Step 4: Publish Approved Posts
```bash
npm run content:publish
```

**What happens**:
1. Finds all posts with status = `approved`
2. For each post:
   - Creates new Git branch (e.g., `blog/ferritin-test-results`)
   - Generates Next.js blog page file with metadata
   - Updates sitemap.ts with new blog URL
   - Creates GitHub Pull Request
3. Updates post status to `published`

**Example output**:
```
✓ Published: "How to Read Your Ferritin Blood Test Results"
  Website: healthopenpage.com
  PR: https://github.com/RBeato/open_page/pull/42
  Branch: blog/ferritin-test-results

  → Merge PR to deploy to production
```

### Step 5: Merge GitHub PR

1. Open PR link from output
2. Review changes (blog post file + sitemap update)
3. Merge PR
4. Vercel auto-deploys to production
5. Blog post live at `https://www.healthopenpage.com/blog/ferritin-test-results`

---

## CLI Commands Reference

### `npm run content:seed`
**When to use**: First setup, or when topic queue is empty
**What it does**: Populates blog_topics table from SEO guides
**Run frequency**: Once, or when adding new SEO guides

### `npm run content:generate <website>`
**When to use**: Generate new blog posts
**Options**: `healthopenpage`, `meditnation`, `riffroutine`
**What it does**: AI generates SEO-optimized blog post + featured image
**Cost**: ~$0.031 per post (DeepSeek text + Gemini image)

### `npm run content:generate-images [website] [--dry]`
**When to use**: Generate images for existing posts that don't have them
**What it does**: Scans website repos, generates Gemini AI images for posts missing images
**Cost**: ~$0.03 per image

### `npm run content:backfill-images [website] [--dry]`
**When to use**: After generating images, patches existing blog files to display them
**What it does**: Adds hero image, OpenGraph/Twitter image metadata to existing blog pages

### `npm run content:publish`
**When to use**: After approving posts in Supabase
**What it does**: Creates GitHub PRs for all approved posts
**Note**: Does NOT auto-merge by default (manual review required)

---

## Database Schema

### `blog_posts` Table
```typescript
{
  id: string;                    // UUID
  website: 'healthopenpage' | 'meditnation' | 'riffroutine';
  title: string;                 // "How to Read Your Ferritin Blood Test Results"
  slug: string;                  // "how-to-read-ferritin-test-results"
  content: string;               // Full markdown blog post
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected';
  seo_score: number;             // 0-100 (algorithm-calculated)
  target_keyword: string;        // "ferritin blood test"
  meta_description: string;      // SEO meta description
  scheduled_date: Date | null;   // Future: automated scheduling
  published_at: Date | null;     // When published to website
  github_pr_url: string | null;  // PR link
  created_at: Date;
  updated_at: Date;
}
```

**Status Flow**:
- `draft` → Initial AI generation
- `pending_review` → Ready for your approval
- `approved` → You approved, ready to publish
- `published` → Live on website
- `rejected` → Rejected, topic returns to queue

### `blog_topics` Table
```typescript
{
  id: string;                    // UUID
  website: 'healthopenpage' | 'meditnation' | 'riffroutine';
  topic: string;                 // "How to Read Ferritin Levels in Blood Tests"
  target_keyword: string;        // "ferritin blood test"
  search_volume: number;         // 8100 (monthly searches)
  priority: number;              // 1 = highest, 10 = lowest
  status: 'pending' | 'in_progress' | 'completed';
  assigned_post_id: string | null;
  created_at: Date;
}
```

### `content_calendar` Table
```typescript
{
  id: string;
  website: 'healthopenpage' | 'meditnation' | 'riffroutine';
  posts_per_week: number;        // healthopenpage = 2, others = 1
  target_weekdays: string[];     // ["Tuesday", "Friday"]
  target_hour: number;           // 9 (9am publish time)
  timezone: string;              // "America/New_York"
  auto_publish: boolean;         // false (manual approval for now)
  is_active: boolean;            // true
  created_at: Date;
  updated_at: Date;
}
```

---

## Website-Specific Configurations

### healthopenpage.com
**Focus**: Lab analysis and preventive health
**Target Audience**: Health-conscious users seeking lab test insights
**Tone**: Clinical but accessible, evidence-based
**Publishing**: 2 posts/week (Tuesday, Friday)

**Content Categories**:
- Lab result interpretation (ferritin, cholesterol, TSH, vitamin D)
- Biomarker guides (inflammation markers, metabolic health)
- Preventive health strategies

**CTAs**:
- "Try HOP Health Tracker free trial"
- "Upload your lab results for AI analysis"

**Internal Links**:
- `/labs/analyze` - Lab analysis tool
- `/subscription` - Pricing page
- `/blog` - Blog index

**Example Topics**:
- "How to Read Your Ferritin Blood Test Results" (8,100 searches/month)
- "Understanding Cholesterol Numbers: LDL, HDL, and Triglycerides" (5,400 searches/month)
- "Thyroid Test Results Explained: TSH, T3, and T4" (6,600 searches/month)

### meditnation.org
**Focus**: Meditation techniques and mindfulness
**Target Audience**: Meditation beginners and multilingual users
**Tone**: Calming, inclusive, evidence-based mindfulness
**Publishing**: 1 post/week (Wednesday)

**Content Categories**:
- Meditation techniques for beginners
- AI-powered personalization
- Multilingual meditation guides (10 languages)

**CTAs**:
- "Download MeditNation app"
- "Start your first 5-minute meditation"

**Internal Links**:
- `/features/ai-meditation` - AI personalization
- `/features/10-languages` - Language support
- `/download` - App download

**Example Topics**:
- "5-Minute Meditation Techniques for Busy Professionals" (3,200 searches/month)
- "AI Meditation Apps: How Personalization Improves Mindfulness" (1,800 searches/month)
- "Meditation in 10 Languages: Multilingual Mindfulness Guide" (900 searches/month)

### riffroutine.com
**Focus**: Guitar practice routines and techniques
**Target Audience**: Intermediate guitarists seeking structured practice
**Tone**: Enthusiastic, technical, musician-focused
**Publishing**: 1 post/week (Monday)

**Content Categories**:
- Famous guitarist practice routines
- Technique guides (alternate picking, legato, etc.)
- Practice optimization strategies

**CTAs**:
- "Download RiffRoutine app"
- "Try Eddie Van Halen's practice routine"

**Internal Links**:
- `/routines/famous-guitarists` - Guitarist routines
- `/features/practice-tracking` - Practice tracking
- `/download` - App download

**Example Topics**:
- "Eddie Van Halen's Daily Practice Routine (Revealed)" (2,400 searches/month)
- "Jimi Hendrix Guitar Techniques: Breaking Down the Master" (1,600 searches/month)
- "Blues Guitar Practice Routine: 30-Minute Daily Plan" (1,200 searches/month)

---

## SEO Optimization Details

### SEO Scoring Algorithm (0-100)
```typescript
function calculateSEOScore(post: BlogPost): number {
  let score = 0;

  // Keyword density: 5-8% (30 points)
  const density = calculateKeywordDensity(post.content, post.target_keyword);
  if (density >= 5 && density <= 8) score += 30;
  else if (density >= 3 && density <= 10) score += 20;
  else score += 10;

  // Heading structure (20 points)
  const hasH1 = post.content.includes('# ');
  const hasH2 = post.content.includes('## ');
  const hasH3 = post.content.includes('### ');
  if (hasH1 && hasH2 && hasH3) score += 20;
  else if (hasH1 && hasH2) score += 15;

  // FAQ section (20 points)
  const hasFAQ = post.content.toLowerCase().includes('## faq');
  if (hasFAQ) score += 20;

  // Word count (15 points)
  const wordCount = post.content.split(/\s+/).length;
  if (wordCount >= 1500) score += 15;
  else if (wordCount >= 1000) score += 10;

  // Internal links (15 points)
  const internalLinks = (post.content.match(/\[.*?\]\(\/.*?\)/g) || []).length;
  if (internalLinks >= 3) score += 15;
  else if (internalLinks >= 1) score += 10;

  return score;
}
```

**Target score**: 70+ (good), 85+ (excellent)

### Content Structure Template
```markdown
# Main Title (H1) - Includes target keyword
*Example: "How to Read Your Ferritin Blood Test Results"*

## Introduction (150 words)
- Hook with problem statement
- Promise of solution
- Target keyword in first paragraph

## Main Content Sections (H2)
### Subsections (H3)
- Step-by-step explanations
- Evidence-based information
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

---

## Cost & Time Analysis

### Manual Blog Creation (Old Way)
- Research: 1 hour
- Writing: 2 hours
- SEO optimization: 30 minutes
- **Total: 3.5 hours per post**

### Automated Blog Creation (New Way)
- AI generation: 30 seconds (DeepSeek API)
- Your review: 10 minutes
- **Total: 10 minutes per post**

### Cost Breakdown
- DeepSeek API: $0.001 per post (~1,500 tokens)
- GitHub API: Free (unlimited)
- **Total: ~$0.001 per post**

### Monthly Savings (All 3 Websites)
- Posts per month: 16 posts (HOP: 8, MeditNation: 4, RiffRoutine: 4)
- Old way: 16 × 3.5 hours = **56 hours/month**
- New way: 16 × 10 minutes = **2.67 hours/month**
- **Time saved: 53.33 hours/month**

### Annual Savings
- Time: 640 hours/year
- Cost: $192 (if paying $0.30/post manually vs $0.001 automated)

---

## Roadmap

### Phase 1 (Current) ✅
- AI blog generation with DeepSeek
- GitHub PR publishing
- Manual approval via SQL
- Topic queue management
- SEO scoring algorithm
- CLI commands for generation/publishing

### Phase 2 (Next)
- Dashboard UI at `/dashboard/content`
- One-click approve/reject buttons
- Content preview with SEO score
- Email notifications for new drafts
- Batch operations (approve 5 posts at once)

### Phase 3 (Future)
- Automated cron jobs:
  - Weekly generation based on content calendar
  - Daily publishing at scheduled times
- Google Search Console integration
- A/B testing for titles/descriptions
- Image generation (AI-powered featured images)
- Performance analytics dashboard

---

## Troubleshooting

### "No topics found in queue"
**Cause**: `blog_topics` table is empty
**Solution**: Run `npm run content:seed`

### "GitHub API error: Bad credentials"
**Cause**: Invalid or expired `GITHUB_TOKEN`
**Solution**: Regenerate token on GitHub.com, update `.env`

### "DeepSeek API error: Rate limit"
**Cause**: Too many requests (unlikely with generous limits)
**Solution**: Wait 1 minute, retry

### "Low SEO score (<70)"
**Possible causes**:
- Keyword density too low/high
- Missing FAQ section
- Word count under 1,500
- No internal links

**Solution**: Reject post, regenerate with better topic description

### "Blog post published but not in sitemap"
**Cause**: Sitemap update failed in GitHub PR
**Solution**: Manually add to `sitemap.ts` in website repo

---

## File Structure

```
business_manager/
├── src/
│   └── content/
│       ├── generator.ts         # AI blog post + image generator
│       ├── image-generator.ts   # Gemini API image generation service
│       └── publisher.ts         # GitHub PR publisher
├── scripts/
│   ├── generate-content.ts      # CLI: Generate posts
│   ├── generate-blog-images.ts  # CLI: Generate images for existing posts
│   ├── backfill-blog-images.ts  # CLI: Patch blog files with hero images
│   ├── publish-scheduled.ts     # CLI: Publish posts
│   └── seed-topics.ts           # CLI: Seed topics
├── supabase/
│   └── migrations/
│       └── 003_content_engine.sql  # Database schema
├── docs/
│   ├── CONTENT_ENGINE.md        # Technical reference
│   └── CONTENT_ENGINE_WORKFLOW.md  # Usage guide
├── dashboard/                   # Future: Approval UI
├── .env                         # API keys (incl. GOOGLE_AI_STUDIO_API_KEY for Gemini)
└── package.json                 # CLI commands
```

---

## Environment Variables

### Required for Content Engine
```bash
# Supabase (already configured)
SUPABASE_URL="https://ptndtjbyguhixwgbnfsm.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# DeepSeek AI (already configured)
DEEPSEEK_API_KEY="REDACTED"

# GitHub (need to add)
GITHUB_TOKEN="ghp_your_token_here"  # For creating PRs
```

### Optional (for future features)
```bash
# Email notifications (Phase 3)
RESEND_API_KEY="re_..."
REPORT_EMAIL_TO="your-email@example.com"

# Google Search Console (Phase 3)
GOOGLE_SEARCH_CONSOLE_KEY="..."
```

---

## Related Documentation

- **Technical Reference**: `/docs/CONTENT_ENGINE.md`
- **Usage Guide**: `/docs/CONTENT_ENGINE_WORKFLOW.md`
- **Database Schema**: `/supabase/migrations/003_content_engine.sql`
- **Generator Code**: `/src/content/generator.ts`
- **Publisher Code**: `/src/content/publisher.ts`

---

## Support & Contact

**Issues**: Check troubleshooting section above
**Feature Requests**: Add to Phase 3 roadmap
**Documentation**: All guides in `/docs/` folder

---

**Last Updated**: February 16, 2026
**Status**: Phase 1 Complete ✅
**Next Step**: Run setup instructions and generate first test post

---

## TODO: GA4 Mobile Streams Setup

All apps have iOS + Android versions. Each app's GA4 property should have iOS and Android data streams added so mobile analytics flow into the same property as web.

### Apps to configure:
- [ ] **MeditNation** (Property ID: 523819246) — add iOS + Android streams
- [ ] **Health Open Page** (Property ID: 492772686) — add iOS + Android streams
- [ ] **Guitar Progression Generator** — create GA4 property, add iOS + Android streams
- [ ] **SM Guitar** — create GA4 property, add iOS + Android streams
- [ ] **Ear N Play** — create GA4 property, add iOS + Android streams

### Steps per app:
1. Go to `analytics.google.com` → Admin → select the property (or create one)
2. Data Streams → **Add stream** → **iOS**
   - Enter Apple Bundle ID
   - Follow Firebase/GA4 SDK setup if not already integrated
3. Data Streams → **Add stream** → **Android**
   - Enter Google package name
   - Follow Firebase/GA4 SDK setup if not already integrated
4. Update `.env` with GA4 Property ID if new
5. Run `npm run setup:ga4` to sync to Supabase
