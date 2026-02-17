# Business Metrics Hub - Project Analysis & TODO

## What We Built

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES (Read Only)                       │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│   App Stores    │    Analytics    │   Subscriptions │   Cost Tracking   │
│  - App Store    │  - Firebase     │  - RevenueCat   │  - DeepSeek       │
│  - Google Play  │  - GA4          │                 │  - ElevenLabs     │
│                 │  - Email IMAP   │                 │  - Cartesia       │
│                 │                 │                 │  - Supabase       │
│                 │                 │                 │  - Neon           │
│                 │                 │                 │  - Google Cloud   │
└────────┬────────┴────────┬────────┴────────┬────────┴─────────┬─────────┘
         │                 │                 │                  │
         ▼                 ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INGESTION LAYER (12 modules)                     │
│   src/ingestion/*.ts + src/ingestion/providers/*.ts                     │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE (Write)                          │
│   Project: ptndtjbyguhixwgbnfsm                                         │
│   Tables: apps, providers, daily_*, ingestion_logs, daily_reports       │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         METRICS LAYER                                    │
│   - MRR, Churn, Retention calculations                                  │
│   - Portfolio aggregations                                              │
│   - Cost per user metrics                                               │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         REPORTS & DELIVERY                               │
│   - AI Insights (DeepSeek)                                              │
│   - HTML Email Template                                                 │
│   - Resend Email Delivery                                               │
│   - Telegram Bot (webhook)                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Files Created (50+ total)

| Category | Files | Purpose |
|----------|-------|---------|
| Config | `src/config/index.ts` | Environment loading |
| Database | `src/db/client.ts`, `schema.sql` | Supabase client & schema |
| Types | `src/types/index.ts` | All TypeScript interfaces |
| Ingestion | 12 files in `src/ingestion/` | Data source integrations |
| Metrics | `calculator.ts`, `aggregator.ts` | Business calculations |
| Reports | `generator.ts`, `ai-insights.ts`, `daily-email.ts` | Report generation |
| Delivery | `src/delivery/email.ts`, `telegram.ts` | Email + Telegram sending |
| Monitoring | `src/monitoring/credits.ts` | Credit/quota alerts |
| Content Engine | `src/content/generator.ts`, `publisher.ts` | AI blog generation + publishing |
| Scripts | 10 files in `scripts/` | CLI utilities |
| Edge Functions | 2 files in `supabase/functions/` | Telegram + RevenueCat webhooks |
| Dashboard | `dashboard/` | Next.js web UI (port 3002) |
| Docs | `docs/` | Setup + workflow documentation |

---

## Current Status

### ✅ Working

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Database | ✅ Connected | `ptndtjbyguhixwgbnfsm` |
| Database Schema | ✅ Deployed | 12+ tables, indexes, views, 9 migrations |
| RevenueCat v2 API | ✅ Working | 6 apps tracked, Charts API for daily metrics |
| RevenueCat Webhook | ✅ Deployed | Real-time purchase notifications via Edge Function |
| Firebase/GA4 | ✅ Working | 4 properties (HOP, MeditNation, Ear N Play, GPG) |
| GA4 Retention | ✅ Fixed | Cohort report bug fixed (Feb 2026) |
| Email IMAP | ✅ Working | Cost tracking from receipts |
| Cartesia | ✅ Working | Credit tracking |
| DeepSeek | ✅ Working | Blog generation via OpenAI SDK |
| Resend | ✅ Configured | Email delivery |
| OpenAI | ✅ Configured | API key valid |
| Brevo | ✅ Configured | Email metrics tracking |
| Credit Monitoring | ✅ Working | Checks 5+ services |
| Telegram Bot | ✅ Deployed | Webhook-based, /revenue /mrr /costs /report /status |
| Content Engine | ✅ Working | 162 biomarker topics seeded, 7 posts generated & published |
| Dashboard | ✅ Working | Revenue, MRR, costs, credits, content approval UI |
| TypeScript | ✅ Compiles | `tsx` runs fine |
| Git Repository | ✅ Pushed | github.com/RBeato/business_manager |

### ⚠️ Needs Attention

| Component | Status | Issue |
|-----------|--------|-------|
| App Store Connect | ⚠️ 404 Error | Credentials may need refresh or key regeneration |
| ElevenLabs | ⚠️ 403 Error | API key lacks `speech_history_read` permission |
| GitHub Token | ⚠️ Limited | Fine-grained token missing private repo access (can't create PRs) |
| GA4 for GPG/Ear N Play | ⚠️ 403 | Service account needs viewer access to these properties |

### ❌ Not Configured

| Component | What's Missing |
|-----------|----------------|
| Google Play | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| Anthropic | `ANTHROPIC_API_KEY` (optional, DeepSeek is primary) |
| Google Cloud Billing | `GOOGLE_CLOUD_BILLING_ACCOUNT_ID` |
| Supabase Management | `SUPABASE_MANAGEMENT_API_KEY` |
| Neon | `NEON_API_KEY` |

---

## TODO

### 🔴 High Priority

- [ ] **Fix GitHub Token for PR publishing**
  - Current fine-grained token can't access private repos (`healthopenpage-web`, etc.)
  - Options:
    1. Update fine-grained token to include all repos with `Contents: Read/Write` and `Pull requests: Read/Write`
    2. Create a classic token with `repo` scope
  - Until fixed, use `npx tsx scripts/publish-local.ts` for local file publishing
  - After fixing, `npm run content:publish` will create GitHub PRs automatically

- [ ] **Push 7 published blog posts to HOP production**
  - Files are created locally in `/Users/rbsou/Documents/CODE/open_page/src/app/blog/`
  - Sitemap updated with 7 new URLs
  - Need to: `cd /Users/rbsou/Documents/CODE/open_page && git add . && git commit && git push`
  - Vercel will auto-deploy once pushed

- [ ] **Fix App Store Connect 404 error**
  - Go to: appstoreconnect.apple.com → Users and Access → Integrations → API
  - Regenerate key with "Sales and Reports" role
  - Update `.env`: `APP_STORE_CONNECT_KEY_ID`, `ISSUER_ID`, `PRIVATE_KEY`

- [ ] **Get Google Play service account**
  - Go to: console.cloud.google.com → Service Accounts
  - Create service account with Play Developer API access
  - Download JSON and add to `.env`: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

- [ ] **Set up daily automation (cron)**
  ```bash
  crontab -e
  # Add:
  0 6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run ingest && npm run report -- --send >> /tmp/metrics.log 2>&1
  0 */6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run check-credits >> /tmp/credits.log 2>&1
  ```

### 🟡 Medium Priority

- [ ] **Fix ElevenLabs API key**
  - Go to: elevenlabs.io → Profile → API key
  - Create new key with `speech_history_read` permission

- [ ] **Fix GA4 access for Guitar Progression Generator & Ear N Play**
  - Grant the Firebase service account viewer access to these GA4 properties
  - Or create new GA4 properties and link them

- [ ] **Continue biomarker content generation**
  - 163 topics remaining in queue (of 170 total)
  - Run: `npm run content:generate-biomarker healthopenpage 10`
  - Then: `npx tsx scripts/publish-local.ts` to create page files
  - Target: 50-100 biomarker pages for programmatic SEO

- [ ] **Verify Resend domain**
  - Go to: resend.com → Domains
  - Add `healthopenpage.com` (or your domain)
  - Add DNS records for verification

- [ ] **GSC indexing issues**
  - meditnation.org: 16 "Discovered – not indexed" pages
  - riffroutine.com: 1 "Blocked due to 4xx" page
  - Submit sitemaps in Google Search Console after publishing new content

### 🟢 Low Priority

- [ ] **Get Supabase Management API key**
  - Go to: supabase.com/dashboard → Account → Access Tokens

- [ ] **Get Neon API key**
  - Go to: console.neon.tech → Account Settings → API Keys

- [ ] **Get Google Cloud billing setup**
  - Enable BigQuery billing export

- [ ] **Add Anthropic API key** (optional fallback)
  - Go to: console.anthropic.com → API Keys

---

## Content Engine Status

### Completed
- [x] AI blog generation with DeepSeek (via OpenAI SDK)
- [x] Biomarker programmatic SEO templates (4 categories: biomarker, panel, condition, results)
- [x] 162 biomarker topics seeded (81 biomarkers, 20 panels, 30 conditions, 31 results)
- [x] 7 blog posts generated and published locally for HOP
- [x] Local publishing script (`scripts/publish-local.ts`) — creates page.tsx files with full SEO metadata, structured data, FAQ schema, medical disclaimer
- [x] Sitemap auto-update on publish
- [x] Telegram bot approval workflow (approve/reject/preview via Telegram)
- [x] Dashboard approval UI
- [x] RevenueCat webhook for real-time purchase notifications
- [x] HOP homepage: fixed language default (pt → en for SEO)
- [x] HOP homepage: added navigation bar + internal links to blog/features
- [x] HOP: created public `/features/lab-analysis` landing page with structured data
- [x] DeepSeek API: switched from Anthropic SDK to OpenAI SDK (404 fix)

### Published Blog Posts (HOP) — pending git push
| Slug | Title | SEO | Words |
|------|-------|-----|-------|
| ferritin-levels-your-complete-guide-to-understanding-iron-st | Ferritin Levels: Complete Guide to Iron Stores | 75 | 2,069 |
| hba1c-test-your-complete-guide-to-blood-sugar-health | HbA1c Test: Complete Guide to Blood Sugar Health | 90 | 1,913 |
| cbc-test-explained-your-complete-blood-count-guide | CBC Test Explained: Complete Blood Count Guide | 60 | 1,978 |
| testosterone-levels-normal-ranges-health-guide | Testosterone Levels: Normal Ranges & Health Guide | 75 | 2,499 |
| triglycerides-causes-risks-and-how-to-lower-them | Triglycerides: Causes, Risks, and How to Lower Them | 100 | 2,165 |
| tsh-levels-your-guide-to-the-master-thyroid-hormone-test | TSH Levels: Master Thyroid Hormone Test | 90 | 2,425 |
| blood-glucose-levels-fasting-random-sugar-explained | Blood Glucose Levels: Fasting & Random Sugar | 75 | 2,310 |

### Content Engine CLI Commands
```bash
npm run content:generate healthopenpage           # Generate 1 general blog post
npm run content:generate-biomarker healthopenpage  # Generate 1 biomarker page
npm run content:generate-biomarker healthopenpage 10  # Generate 10 biomarker pages
npm run content:generate-biomarker healthopenpage panel  # Generate 1 panel page
npm run content:seed                               # Seed general topics
npm run content:seed-biomarkers                    # Seed 162 biomarker topics
npm run content:publish                            # Publish via GitHub PRs (needs token fix)
npx tsx scripts/publish-local.ts                   # Publish locally (creates files directly)
```

### Publishing Workflow
1. **Generate**: `npm run content:generate-biomarker healthopenpage 5`
2. **Review**: Dashboard UI or Telegram bot (`/approve`, `/reject`)
3. **Publish locally**: `npx tsx scripts/publish-local.ts`
4. **Deploy**: `cd /Users/rbsou/Documents/CODE/open_page && git add . && git commit && git push`
5. Vercel auto-deploys on push

---

## Future Enhancements

### Phase 1: Dashboard (Web UI) — PARTIALLY DONE
- [x] Create Next.js dashboard
- [x] Portfolio overview page with charts
- [x] Per-app detail pages
- [x] Cost breakdown visualizations
- [x] Content approval UI
- [ ] Trend analysis graphs
- [ ] Content performance analytics (GSC integration)

### Phase 2: Advanced Analytics
- [ ] Cohort analysis
- [ ] LTV (Lifetime Value) calculations
- [ ] Predictive churn modeling
- [ ] A/B test result tracking
- [ ] Funnel analysis

### Phase 3: Alerts & Automation
- [ ] Anomaly detection (revenue drops, install spikes)
- [x] Telegram notifications (purchases, renewals, cancellations)
- [ ] Custom alert thresholds per app
- [ ] Weekly/monthly report options
- [ ] Automated content generation cron
- [ ] Competitor tracking

### Phase 4: Integrations
- [ ] Stripe (for web payments)
- [ ] Mixpanel/Amplitude
- [ ] Crashlytics/Sentry
- [ ] App Store reviews sentiment analysis
- [ ] Google Search Console API integration

---

## Known Issues

1. **App Store Connect 404**: Credentials may need regeneration
2. **ElevenLabs 403**: API key lacks `speech_history_read` permission
3. **GA4 403 on 2 properties**: Service account missing viewer access for GPG and Ear N Play
4. **GitHub Token**: Fine-grained token missing private repo access — use `publish-local.ts` instead
5. **Pre-existing type errors**: `src/content/generator.ts` — `tsc --noEmit` fails on Anthropic SDK types (non-blocking, `tsx` runs fine)

---

## Maintenance Notes

### Database Backups
Supabase handles automatic backups, but consider:
- Enable Point-in-Time Recovery (PITR) for production
- Export critical data periodically

### API Key Rotation
- Rotate keys periodically (every 90 days recommended)
- Update `.env` and test before deploying
- Never commit `.env` to git

### Monitoring
- Check `/tmp/metrics.log` and `/tmp/credits.log` for cron job output
- Monitor Supabase dashboard for database health
- Check Edge Function logs: `supabase functions logs telegram-webhook` / `revenuecat-webhook`

---

## Quick Reference

### Commands
```bash
npm run dev                 # Full ingestion + report
npm run ingest              # Run data ingestion only
npm run report              # Generate report (no send)
npm run report -- --send    # Generate and email report
npm run check-credits       # Check API credit balances
npm run setup               # Validate configuration

# Content Engine
npm run content:generate healthopenpage          # Generate blog post
npm run content:generate-biomarker healthopenpage 5  # Generate biomarker pages
npm run content:seed-biomarkers                  # Seed biomarker topics
npx tsx scripts/publish-local.ts                 # Publish to local repo

# Telegram & Webhooks
npm run telegram:deploy     # Deploy Telegram webhook
npm run revenuecat:deploy   # Deploy RevenueCat webhook
npm run revenuecat:logs     # View RevenueCat webhook logs
```

### Key URLs
- Supabase Dashboard: https://supabase.com/dashboard/project/ptndtjbyguhixwgbnfsm
- GitHub Repo: https://github.com/RBeato/business_manager
- RevenueCat: https://app.revenuecat.com
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
- Dashboard: http://localhost:3002 (run `cd dashboard && npm run dev`)

---

**Last Updated**: February 16, 2026
