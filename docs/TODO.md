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
└─────────────────────────────────────────────────────────────────────────┘
```

### Files Created (42 total)

| Category | Files | Purpose |
|----------|-------|---------|
| Config | `src/config/index.ts` | Environment loading |
| Database | `src/db/client.ts`, `schema.sql` | Supabase client & schema |
| Types | `src/types/index.ts` | All TypeScript interfaces |
| Ingestion | 12 files in `src/ingestion/` | Data source integrations |
| Metrics | `calculator.ts`, `aggregator.ts` | Business calculations |
| Reports | `generator.ts`, `ai-insights.ts`, `daily-email.ts` | Report generation |
| Delivery | `src/delivery/email.ts` | Email sending |
| Monitoring | `src/monitoring/credits.ts` | Credit/quota alerts |
| Scripts | 4 files in `scripts/` | CLI utilities |
| Edge Functions | 2 files in `supabase/functions/` | Serverless deployment |
| Docs | `api-keys-setup.md` | Setup documentation |

---

## Current Status

### ✅ Working

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Database | ✅ Connected | `ptndtjbyguhixwgbnfsm` |
| Database Schema | ✅ Deployed | 12 tables, indexes, views |
| Email IMAP | ✅ Working | 3 records ingested |
| Cartesia | ✅ Working | 1 record ingested |
| DeepSeek | ✅ Configured | $10.39 balance |
| Resend | ✅ Configured | API key valid |
| OpenAI | ✅ Configured | API key valid |
| Credit Monitoring | ✅ Working | Checks 5 services |
| TypeScript | ✅ Compiles | No errors |
| Git Repository | ✅ Pushed | github.com/RBeato/business_manager |

### ⚠️ Configured But No Data

| Component | Status | Reason |
|-----------|--------|--------|
| RevenueCat | ⚠️ Connected | Apps need `revenuecat_app_id` in database |

### ❌ Not Configured

| Component | What's Missing |
|-----------|----------------|
| App Store Connect | `APP_STORE_CONNECT_KEY_ID`, `ISSUER_ID`, `PRIVATE_KEY` |
| Google Play | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| Firebase/GA4 | `FIREBASE_SERVICE_ACCOUNT_JSON`, GA4 Property IDs |
| ElevenLabs | API key needs `speech_history_read` permission |
| Anthropic | `ANTHROPIC_API_KEY` (optional, DeepSeek is primary) |
| Google Cloud | `GOOGLE_CLOUD_BILLING_ACCOUNT_ID` |
| Supabase Management | `SUPABASE_MANAGEMENT_API_KEY` |
| Neon | `NEON_API_KEY` |

---

## TODO

### 🔴 High Priority (Required for Core Functionality)

- [ ] **Get App Store Connect API credentials**
  - Go to: appstoreconnect.apple.com → Users and Access → Integrations → API
  - Generate key with "Sales and Reports" role
  - Add to `.env`: `APP_STORE_CONNECT_KEY_ID`, `ISSUER_ID`, `PRIVATE_KEY`

- [ ] **Get Google Play service account**
  - Go to: console.cloud.google.com → Service Accounts
  - Create service account with Play Developer API access
  - Download JSON and add to `.env`: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

- [ ] **Update apps table with RevenueCat IDs**
  ```sql
  UPDATE apps SET revenuecat_app_id = 'appl_prpApVWAYBlggmwrdRByOyHgaHR' WHERE slug = 'guitar_progression_generator';
  UPDATE apps SET revenuecat_app_id = 'appl_sgozdSqYlPHkHqlMAdZxvLdEHnx' WHERE slug = 'smguitar';
  UPDATE apps SET revenuecat_app_id = 'appl_RTTMGHqEhNeMPRFVLAlVKQcKtIo' WHERE slug = 'ear_n_play';
  UPDATE apps SET revenuecat_app_id = 'appl_zAOldDeDHiNaeSjrkyUOizPqjod' WHERE slug = 'meditnation_mobile';
  ```

- [ ] **Update apps table with bundle IDs and package names**
  ```sql
  UPDATE apps SET
    apple_bundle_id = 'com.romeubeato.guitar-progression-generator',
    google_package_name = 'com.romeubeato.chord_generator_for_guitar_v2'
  WHERE slug = 'guitar_progression_generator';
  -- Repeat for other apps...
  ```

- [ ] **Set up daily automation**
  ```bash
  crontab -e
  # Add:
  0 6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run ingest && npm run report -- --send >> /tmp/metrics.log 2>&1
  0 */6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run check-credits >> /tmp/credits.log 2>&1
  ```

### 🟡 Medium Priority (Enhanced Functionality)

- [ ] **Fix ElevenLabs API key**
  - Go to: elevenlabs.io → Profile → API key
  - Create new key with `speech_history_read` permission

- [ ] **Get Firebase service account**
  - Go to: console.firebase.google.com → Project Settings → Service Accounts
  - Generate new private key
  - Add to `.env`: `FIREBASE_SERVICE_ACCOUNT_JSON`

- [ ] **Get GA4 Property IDs**
  - Go to: analytics.google.com → Admin → Property Settings
  - Copy Property ID for each app
  - Update apps table with `ga4_property_id`

- [ ] **Verify Resend domain**
  - Go to: resend.com → Domains
  - Add `healthopenpage.com` (or your domain)
  - Add DNS records for verification
  - Currently limited to sending to your own email

- [ ] **Test full report generation**
  ```bash
  npm run report -- --send
  ```

### 🟢 Low Priority (Nice to Have)

- [ ] **Get Supabase Management API key**
  - Go to: supabase.com/dashboard → Account → Access Tokens
  - Enables tracking Supabase project usage/costs

- [ ] **Get Neon API key**
  - Go to: console.neon.tech → Account Settings → API Keys
  - Enables tracking Neon database costs

- [ ] **Get Google Cloud billing setup**
  - Enable BigQuery billing export
  - Get billing account ID

- [ ] **Add Anthropic API key** (optional fallback)
  - Go to: console.anthropic.com → API Keys

---

## Future Enhancements

### Phase 1: Dashboard (Web UI)

- [ ] Create Next.js dashboard
- [ ] Portfolio overview page with charts
- [ ] Per-app detail pages
- [ ] Cost breakdown visualizations
- [ ] Trend analysis graphs

### Phase 2: Advanced Analytics

- [ ] Cohort analysis
- [ ] LTV (Lifetime Value) calculations
- [ ] Predictive churn modeling
- [ ] A/B test result tracking
- [ ] Funnel analysis

### Phase 3: Alerts & Automation

- [ ] Anomaly detection (revenue drops, install spikes)
- [ ] Slack/Discord notifications
- [ ] Custom alert thresholds per app
- [ ] Weekly/monthly report options
- [ ] Competitor tracking

### Phase 4: Integrations

- [ ] Stripe (for web payments)
- [ ] Mixpanel/Amplitude
- [ ] Crashlytics/Sentry
- [ ] App Store reviews sentiment analysis
- [ ] Social media mentions

---

## Known Issues

1. **ElevenLabs 401 Error**: API key lacks `speech_history_read` permission
2. **Cartesia 404**: Usage endpoint may have changed, falls back to account endpoint
3. **RevenueCat 0 records**: Apps in database don't have `revenuecat_app_id` set
4. **App Store/Google Play stubs**: Some API methods are placeholders awaiting real credentials

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
- Set up uptime monitoring for Edge Functions if deployed

---

## Quick Reference

### Commands
```bash
npm run test:ingestion   # Test all data sources
npm run ingest           # Run full ingestion
npm run report           # Generate report (no send)
npm run report -- --send # Generate and email report
npm run check-credits    # Check API credit balances
npm run setup            # Validate configuration
```

### Key URLs
- Supabase Dashboard: https://supabase.com/dashboard/project/ptndtjbyguhixwgbnfsm
- GitHub Repo: https://github.com/RBeato/business_manager
- RevenueCat: https://app.revenuecat.com
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
