# Business Metrics Hub

A centralized metrics aggregation system for tracking app portfolio performance across multiple platforms and services.

## Features

- **Multi-source Data Ingestion**: Pull data from App Store Connect, Google Play, RevenueCat, Firebase Analytics, and more
- **Provider Cost Tracking**: Monitor usage and costs across AI providers (Anthropic, ElevenLabs, Cartesia) and infrastructure (Google Cloud, Supabase, Neon)
- **Automated Metrics Calculation**: MRR, churn rate, retention, ARPU, and other key business metrics
- **AI-Powered Insights**: Daily reports with DeepSeek-generated analysis and recommendations
- **Credit Monitoring**: Real-time alerts when API credits run low
- **Email Delivery**: Automated daily report emails via Resend

## Apps Tracked

| App | Type | Platforms |
|-----|------|-----------|
| Guitar Progression Generator | Mobile | iOS, Android |
| SM Guitar | Mobile | iOS, Android |
| Ear N Play | Mobile | iOS, Android |
| Meditnation Mobile | Mobile | iOS, Android |
| Meditnation Website | Web | Web |

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Scheduling**: Supabase Edge Functions + pg_cron
- **Email**: Resend
- **AI Insights**: DeepSeek API (with Anthropic fallback)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Initialize Database

Run the schema in your Supabase SQL Editor:

```bash
# Contents of src/db/schema.sql
```

### 4. Run Setup

```bash
npm run setup
```

### 5. Test Ingestion

```bash
# Test all sources
npm run test:ingestion
```

### 6. Check API Credits

```bash
npm run check-credits
```

### 7. Run Full Pipeline

```bash
# Run ingestion, generate report, send email
npm run dev

# Or run specific steps
npm run dev -- --ingest          # Ingest only
npm run dev -- --report          # Generate report only
npm run dev -- --report --send   # Generate and send
```

## Project Structure

```
business_manager/
├── src/
│   ├── config/           # Environment configuration
│   ├── db/               # Database schema and client
│   ├── ingestion/        # Data source integrations
│   │   └── providers/    # AI/infrastructure provider ingestion
│   ├── metrics/          # Metrics calculations
│   ├── reports/          # Report generation
│   │   └── templates/    # Email templates
│   ├── delivery/         # Email delivery
│   ├── types/            # TypeScript types
│   └── index.ts          # Main entry point
├── supabase/
│   └── functions/        # Edge Functions
├── scripts/              # Setup and test scripts
└── package.json
```

## Configuration

### Required Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional Integrations

Each integration can be independently enabled by setting its environment variables:

- **App Store Connect**: `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_PRIVATE_KEY`
- **Google Play**: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- **RevenueCat**: `REVENUECAT_API_KEY`
- **Firebase/GA4**: `FIREBASE_SERVICE_ACCOUNT_JSON`
- **Anthropic**: `ANTHROPIC_API_KEY`
- **ElevenLabs**: `ELEVENLABS_API_KEY`
- **Cartesia**: `CARTESIA_API_KEY`
- **Google Cloud**: `GOOGLE_CLOUD_BILLING_ACCOUNT_ID`
- **Neon**: `NEON_API_KEY`
- **Resend**: `RESEND_API_KEY`, `REPORT_EMAIL_TO`

## Database Schema

Key tables:

- `apps` - Registry of tracked applications
- `providers` - Registry of service providers
- `daily_installs` - App installs by platform/country
- `daily_revenue` - Revenue by app/platform
- `daily_subscriptions` - Subscription events and MRR
- `daily_active_users` - DAU/WAU/MAU metrics
- `daily_feature_usage` - Feature-level analytics
- `daily_provider_costs` - Cost per provider
- `daily_website_traffic` - Website analytics
- `daily_reports` - Generated report archive
- `ingestion_logs` - Audit trail

## Automation

### Supabase Edge Functions

Deploy the Edge Functions:

```bash
supabase functions deploy daily-ingest
supabase functions deploy daily-report
```

### pg_cron Scheduling

Add to your Supabase SQL Editor:

```sql
-- Run ingestion daily at 6 AM UTC
SELECT cron.schedule(
  'daily-ingest',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/daily-ingest',
    headers := '{"Authorization": "Bearer your-anon-key"}'::jsonb
  )$$
);

-- Run report daily at 7 AM UTC
SELECT cron.schedule(
  'daily-report',
  '0 7 * * *',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/daily-report',
    headers := '{"Authorization": "Bearer your-anon-key"}'::jsonb
  )$$
);
```

## Adding New Apps

Insert a new row into the `apps` table:

```sql
INSERT INTO apps (slug, name, type, platforms, apple_app_id, google_package_name)
VALUES (
  'my-new-app',
  'My New App',
  'mobile',
  '["ios", "android"]',
  '123456789',
  'com.example.myapp'
);
```

## Adding New Providers

1. Add provider to database:

```sql
INSERT INTO providers (slug, name, category)
VALUES ('new-provider', 'New Provider', 'ai');
```

2. Create ingestion script in `src/ingestion/providers/`

3. Register in `src/ingestion/index.ts`

## License

MIT
