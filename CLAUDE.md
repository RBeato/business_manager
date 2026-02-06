# Claude Project Context

## Project Overview
Business Metrics Hub - A backend data aggregation and reporting system for tracking revenue, subscriptions, costs, and metrics across multiple apps and services.

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

## Key Files
- `.env` - All API keys and credentials
- `src/ingestion/` - Data source integrations
- `src/monitoring/credits.ts` - API credit checking
- `dashboard/src/app/api/credits/route.ts` - Dashboard credit API
